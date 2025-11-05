import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {
  getContractInstanceFromInstantiationParams,
  DeployMethod,
  Contract,
  DeployOptions,
} from '@aztec/aztec.js/contracts';
import { PublicKeys } from '@aztec/aztec.js/keys';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { AccountWithSecretKey, Account } from '@aztec/aztec.js/account';
import { AccountManager, BaseWallet, type Wallet } from '@aztec/aztec.js/wallet';
import { createAztecNodeClient, type AztecNode } from '@aztec/aztec.js/node';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import type { PXE } from '@aztec/pxe/server';
import { getPXEConfig } from '@aztec/pxe/config';
import { createPXE } from '@aztec/pxe/server';
import { EcdsaRAccountContract } from '@aztec/accounts/ecdsa';
import { createStore } from '@aztec/kv-store/lmdb';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { DripperContractArtifact } from '../src/artifacts/Dripper.js';
import { TokenContractArtifact } from '../src/artifacts/Token.js';
import { poseidon2Hash } from '@aztec/foundation/crypto';

const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL || 'http://localhost:8080';
const PROVER_ENABLED = process.env.PROVER_ENABLED === 'false' ? false : true;

const DEPLOY_TIMEOUT = 960;

const PXE_STORE_DIR = path.join(import.meta.dirname, '.store');

async function setupPXE() {
  const aztecNode = createAztecNodeClient(AZTEC_NODE_URL);

  fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });

  const store = await createStore('pxe', {
    dataDirectory: PXE_STORE_DIR,
    dataStoreMapSizeKb: 1e6,
  });
  const config = {
    ...getPXEConfig(),
    proverEnabled: PROVER_ENABLED,
  };

  const pxe = await createPXE(aztecNode, config, 
    {
      store,
      useLogSuffix: true,
    },);
  return { pxe, aztecNode };
}

async function getSponsoredFPCContract() {
  const instance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    {
      salt: new Fr(SPONSORED_FPC_SALT),
    }
  );

  return instance;
}

const getSponsoredFeePaymentMethod = async () => {
  const sponsoredPFCContract = await getSponsoredFPCContract();
  return new SponsoredFeePaymentMethod(
    sponsoredPFCContract.address
  );
}

async function generateCredentials() {
  if (process.env.DEPLOYER_SECRET_PHRASE) {
    // If we have a secret phrase, we use it to generate the credentials
    const secretKey = await poseidon2Hash([
      Fr.fromBufferReduce(Buffer.from(process.env.DEPLOYER_SECRET_PHRASE.padEnd(32, '#'), 'utf8')),
    ]);
    return {
      secretKey,
      salt: Fr.fromString(process.env.DEPLOYER_SALT || '1337'),
      signingKey: Buffer.from(secretKey.toBuffer().subarray(0, 32))
    };
  } else if (process.env.DEPLOYER_SECRET_KEY && process.env.DEPLOYER_SALT) {
    // If we have a secret key and salt, we use them to generate the credentials
    return {
      salt: Fr.fromString(process.env.DEPLOYER_SALT),
      secretKey: Fr.fromString(process.env.DEPLOYER_SECRET_KEY),
      signingKey: Buffer.from(process.env.DEPLOYER_SIGNING_KEY, 'hex'),
    };
  } else {
    // Otherwise, we generate random credentials
    return {
      salt: Fr.random(),
      secretKey: Fr.random(),
      signingKey: Buffer.alloc(32, Fr.random().toBuffer()),
    };
  }
}

class MinimalWallet extends BaseWallet {
  private readonly addressToAccount = new Map<string, AccountWithSecretKey>();

  constructor(pxe: PXE, aztecNode: AztecNode) {
    super(pxe as unknown as any, aztecNode);
  }

  public addAccount(account: AccountWithSecretKey) {
    this.addressToAccount.set(account.getAddress().toString(), account);
  }

  protected async getAccountFromAddress(address: AztecAddress): Promise<Account> {
    const acc = this.addressToAccount.get(address.toString());
    if (!acc) throw new Error(`Account not found in wallet for address: ${address.toString()}`);
    return acc;
  }

  async getAccounts(): Promise<{ alias: string; item: AztecAddress }[]> {
    return Array.from(this.addressToAccount.values()).map((acc) => ({ alias: '', item: acc.getAddress() }));
  }
}

async function createAccount(pxe: PXE, node: AztecNode) {
  const { secretKey, salt, signingKey } = await generateCredentials();
  console.log({
    secretKey: secretKey.toString(),
    salt: salt.toString(),
    signingKey: signingKey.toString('hex'),
  })

  const wallet = new MinimalWallet(pxe, node);
  const accountContract = new EcdsaRAccountContract(signingKey);
  const manager = await AccountManager.create(wallet, secretKey, accountContract, salt);
  const account = await manager.getAccount();
  const instance = manager.getInstance();
  const artifact = await manager.getAccountContract().getContractArtifact();
  wallet.registerContract(instance, artifact, manager.getSecretKey());
  (wallet as MinimalWallet).addAccount(account);
  console.log(`Account created: ${account.getAddress().toString()}`);

  const metadata = await wallet.getContractMetadata(account.getAddress());
  if (!metadata.isContractInitialized) {
    const sponsoredFeePaymentMethod = await getSponsoredFeePaymentMethod();
    const deployOpts = {
      from: AztecAddress.ZERO,
      contractAddressSalt: salt,
      fee: {
        paymentMethod: sponsoredFeePaymentMethod,
      },
      universalDeploy: true,
      skipClassRegistration: true,
      skipPublicDeployment: true
    };
    const deployMethod = await manager.getDeployMethod();
    await deployMethod.send(deployOpts).wait({ timeout: DEPLOY_TIMEOUT });
  }

  return {
    wallet,
    account,
  };
}

async function deployDripperContract(pxe: PXE, deployer: Wallet, options: DeployOptions) {
  const deployMethod = new DeployMethod(
    PublicKeys.default(),
    deployer,
    DripperContractArtifact,
    (address) => Contract.at(address, DripperContractArtifact, deployer),
    [],
    'constructor',
  );

  const salt = process.env.DRIPPER_SALT ? Fr.fromString(process.env.DRIPPER_SALT) : Fr.random();

  const receipt = await deployMethod.send({
    ...options,
    contractAddressSalt: salt,
    fee: {
      paymentMethod: await getSponsoredFeePaymentMethod(),
    },
    universalDeploy: true,
    skipInitialization: false,
  }).wait({ timeout: DEPLOY_TIMEOUT });
  console.log('Mined at block:', receipt.blockNumber)
  console.log('Dripper deployment tx hash:', receipt.txHash);

  const contract = receipt.contract;
  console.log(`Dripper deployed at: ${contract.address.toString()}`);

  const {instance, artifact } = receipt.contract;
 
  await pxe.registerContract({
    instance,
    artifact,
  });

  return {
    instance: instance,
    address: instance.address.toString(),
    salt: salt.toString(),
  };
}

async function deployTokenContract(pxe: PXE, deployer: Wallet, 
  options: DeployOptions, dripperAddress: AztecAddress) {
  const salt = process.env.TOKEN_SALT ? Fr.fromString(process.env.TOKEN_SALT) : Fr.random();

  // TokenContract.deploy() does not work, as it uses by default constructor_with_asset
  const deployMethod = new DeployMethod(
    PublicKeys.default(),
    deployer,
    TokenContractArtifact,
    (address) => Contract.at(address, TokenContractArtifact, deployer),
    [
      'Yield Token', // name
      'YT', // symbol
      18, // decimals
      dripperAddress, // minter (Dripper address)
      AztecAddress.ZERO, // upgrade_authority (zero address for non-upgradeable)
    ],
    'constructor_with_minter',
  );

  const receipt = await deployMethod.send({
    ...options,
    contractAddressSalt: salt,
    fee: {
      paymentMethod: await getSponsoredFeePaymentMethod(),
    },
    universalDeploy: true,
    skipInitialization: false,
  }).wait({ timeout: DEPLOY_TIMEOUT });
  console.log('Mined at block:', receipt.blockNumber)
  console.log('Token deployment tx hash:', receipt.txHash);

  const contract = receipt.contract;
  console.log(`Token deployed at: ${contract.address.toString()}`);

  const {instance, artifact } = receipt.contract;

  await pxe.registerContract({
    instance,
    artifact,
  });

  return {
    instance: instance,
    address: instance.address.toString(),
    salt: salt.toString(),
  };
}

async function createAccountAndDeployContract() {
  const { pxe, aztecNode } = await setupPXE();

  // Register the SponsoredFPC contract (for sponsored fee payments)
  await pxe.registerContract({
    instance: await getSponsoredFPCContract(),
    artifact: SponsoredFPCContractArtifact,
  });

  // Create a new account
  const deployer = await createAccount(pxe, aztecNode);

  const deployOptions: DeployOptions = {
    from: deployer.account.getAddress(),
  };

  // Deploy the Dripper contract first
  const dripperDeploymentInfo = await deployDripperContract(pxe, deployer.wallet, deployOptions);
  console.log({dripperDeploymentInfo})

  // Deploy the Token contract with Dripper as minter
  const tokenDeploymentInfo = await deployTokenContract(pxe, deployer.wallet, deployOptions, AztecAddress.fromString(dripperDeploymentInfo.address));
  console.log({tokenDeploymentInfo})

  console.log({
    DRIPPER_CONTRACT_ADDRESS: dripperDeploymentInfo.address,
    DRIPPER_DEPLOYMENT_SALT: dripperDeploymentInfo.salt,
    TOKEN_CONTRACT_ADDRESS: tokenDeploymentInfo.address,
    TOKEN_DEPLOYMENT_SALT: tokenDeploymentInfo.salt,
    AZTEC_NODE_URL,
  });

  // Clean up the PXE store
  fs.rmSync(PXE_STORE_DIR, { recursive: true, force: true });
}


createAccountAndDeployContract().catch((error) => {
  console.error(error);
  process.exit(1);
});

export { createAccountAndDeployContract };
