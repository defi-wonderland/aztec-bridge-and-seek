import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {
  AztecAddress,
  createAztecNodeClient,
  Fr,
  getContractInstanceFromDeployParams,
  type PXE,
  SponsoredFeePaymentMethod,
  type Wallet,
} from '@aztec/aztec.js';
import { createPXEService, getPXEServiceConfig } from '@aztec/pxe/server';
import { getEcdsaRAccount } from '@aztec/accounts/ecdsa';
import { createStore } from '@aztec/kv-store/lmdb';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { DripperContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Dripper.js';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Token.js';
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
    dataStoreMapSizeKB: 1e6,
  });

  const config = getPXEServiceConfig();
  config.dataDirectory = 'pxe';
  config.proverEnabled = PROVER_ENABLED;
  const configWithContracts = {
    ...config,
  };

  const pxe = await createPXEService(
    aztecNode,
    configWithContracts,
    {
      store,
      useLogSuffix: true,
    },
  );
  return pxe;
}

async function getSponsoredFPCContract() {
  const instance = await getContractInstanceFromDeployParams(
    SponsoredFPCContractArtifact,
    {
      salt: new Fr(SPONSORED_FPC_SALT),
    }
  );

  return instance;
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

async function createAccount(pxe: PXE) {
  const { secretKey, salt, signingKey } = await generateCredentials();
  console.log({
    secretKey: secretKey.toString(),
    salt: salt.toString(),
    signingKey: signingKey.toString('hex'),
  })
  const ecdsaAccount = await getEcdsaRAccount(pxe, secretKey, signingKey, salt);

  const metadata = await pxe.getContractMetadata(ecdsaAccount.getAddress())
  
  if (!metadata.isContractInitialized) {
    const deployMethod = await ecdsaAccount.getDeployMethod();
    const sponsoredPFCContract = await getSponsoredFPCContract();
    const deployOpts = {
      contractAddressSalt: salt,
      fee: {
        paymentMethod: await ecdsaAccount.getSelfPaymentMethod(
          new SponsoredFeePaymentMethod(sponsoredPFCContract.address)
        ),
      },
      universalDeploy: true,
      skipClassRegistration: true,
      skipPublicDeployment: true
    };
    const provenInteraction = await deployMethod.prove(deployOpts);
    await provenInteraction.send().wait({ timeout: DEPLOY_TIMEOUT });
  }

  await ecdsaAccount.register();
  const wallet = await ecdsaAccount.getWallet();

  return {
    wallet,
    signingKey,
  };
}

const getSponsoredFeePaymentMethod = async () => {
  const sponsoredPFCContract = await getSponsoredFPCContract();
  return new SponsoredFeePaymentMethod(
    sponsoredPFCContract.address
  );
}

async function deployDripperContract(pxe: PXE, deployer: Wallet) {
  const deployMethod = DripperContract.deployWithOpts<"constructor">({
      wallet: deployer,
      method: 'constructor',

  });

  const salt = Fr.random();
  const provenInteraction = await deployMethod.prove({
    contractAddressSalt: salt,
    fee: {
      paymentMethod: await getSponsoredFeePaymentMethod(),
    },
    universalDeploy: true,
  });
  console.log('Dripper deployment tx hash:', await provenInteraction.getTxHash())

  const receipt = await provenInteraction.send().wait({ timeout: DEPLOY_TIMEOUT });
  console.log('Mined at block:', receipt.blockNumber)

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

async function deployTokenContract(pxe: PXE, deployer: Wallet, dripperAddress: AztecAddress) {
  const salt = Fr.random();
  const deployMethod = TokenContract.deployWithOpts<"constructor_with_minter">(
    {
      wallet: deployer,
      method: 'constructor_with_minter',
    },
    'Yield Token', // name
    'YT', // symbol
    18, // decimals
    dripperAddress, // minter (Dripper address)
    AztecAddress.ZERO, // upgrade_authority (zero address for non-upgradeable)
  );

  const provenInteraction = await deployMethod.prove({
    contractAddressSalt: salt,
    fee: {
      paymentMethod: await getSponsoredFeePaymentMethod(),
    },
    universalDeploy: true,
    skipClassRegistration: false,
    skipInitialization: false,
  });
  console.log('Token deployment tx hash:', await provenInteraction.getTxHash())

  const receipt = await provenInteraction.send().wait({ timeout: DEPLOY_TIMEOUT });
  console.log('Mined at block:', receipt.blockNumber)

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
  const pxe = await setupPXE();

  // Register the SponsoredFPC contract (for sponsored fee payments)
  await pxe.registerContract({
    instance: await getSponsoredFPCContract(),
    artifact: SponsoredFPCContractArtifact,
  });

  // Create a new account
  const { wallet } = await createAccount(pxe);

  // Deploy the Dripper contract first
  const dripperDeploymentInfo = await deployDripperContract(pxe, wallet);
  console.log({dripperDeploymentInfo})

  // Deploy the Token contract with Dripper as minter
  const tokenDeploymentInfo = await deployTokenContract(pxe, wallet, AztecAddress.fromString(dripperDeploymentInfo.address));
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
