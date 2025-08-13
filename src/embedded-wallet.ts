import {
  Fr,
  AztecAddress,
  getContractInstanceFromDeployParams,
  ContractFunctionInteraction,
  SponsoredFeePaymentMethod,
  type AccountWallet,
} from '@aztec/aztec.js';
import { type ContractArtifact, getDefaultInitializer } from '@aztec/stdlib/abi';
import { AztecStorageService } from './services/storage';
import { AztecWalletService } from './services/aztec/core';



// This is a minimal implementation of an Aztec wallet, that saves the private keys in local storage.
// This does not implement `@aztec.js/Wallet` interface though
// This is not meant for production use
export class EmbeddedWallet {
  private walletService: AztecWalletService;
  private storageService: AztecStorageService;
  connectedAccount: AccountWallet | null = null;

  constructor(private nodeUrl: string) {
    this.storageService = new AztecStorageService();
    this.walletService = new AztecWalletService();
  }

  async initialize() {
    await this.walletService.initialize(this.nodeUrl);
  }



  getConnectedAccount() {
    if (!this.connectedAccount) {
      return null;
    }
    return this.connectedAccount;
  }

  async connectTestAccount(index: number) {
    const wallet = await this.walletService.connectTestAccount(index);
    this.connectedAccount = wallet;
    return wallet;
  }

  // Create a new account
  async createAccountAndConnect() {
    const result = await this.walletService.createEcdsaAccount();
    
    // Store the account in local storage
    this.storageService.saveAccount({
      address: result.wallet.getAddress().toString(),
      signingKey: result.signingKey.toString('hex'),
      secretKey: result.secretKey.toString(),
      salt: result.salt.toString(),
    });

    this.connectedAccount = result.wallet;
    return result.wallet;
  }

  async connectExistingAccount() {
    // Read key from local storage and create the account
    const account = this.storageService.getAccount();
    if (!account) {
      return null;
    }
    const parsed = account;

    const ecdsaWallet = await this.walletService.createEcdsaAccountFromCredentials(
      Fr.fromString(parsed.secretKey),
      Buffer.from(parsed.signingKey, 'hex'),
      Fr.fromString(parsed.salt)
    );

    this.connectedAccount = ecdsaWallet;
    return ecdsaWallet;
  }

  // Register a contract with PXE
  async registerContract(
    artifact: ContractArtifact,
    deployer: AztecAddress,
    deploymentSalt: Fr,
    constructorArgs: any[]
  ) {
    const instance = await getContractInstanceFromDeployParams(artifact, {
      constructorArtifact: getDefaultInitializer(artifact),
      constructorArgs: constructorArgs,
      deployer: deployer,
      salt: deploymentSalt,
    });

    await this.walletService.getPXE().registerContract({
      instance,
      artifact,
    });
  }

  // Send a transaction with the Sponsored FPC Contract for fee payment
  async sendTransaction(interaction: ContractFunctionInteraction) {
    const sponsoredPFCContract = await this.walletService.getSponsoredPFCContract();
    const provenInteraction = await interaction.prove({
      fee: {
        paymentMethod: new SponsoredFeePaymentMethod(
          sponsoredPFCContract.address
        ),
      },
    });

    await provenInteraction.send().wait({ timeout: 120 });
  }

  // Simulate a transaction
  async simulateTransaction(interaction: ContractFunctionInteraction) {
    const res = await interaction.simulate();
    return res;
  }
}
