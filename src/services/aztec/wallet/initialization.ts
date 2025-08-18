import { AztecAddress, Fr } from '@aztec/aztec.js';
import { AztecWalletService, AztecContractService } from '../core';
import { AztecStorageService } from '../storage';
import { EasyPrivateVotingContract } from '../../../artifacts/EasyPrivateVoting';
import { DripperContract } from '../../../artifacts/Dripper';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Token.js';
import { AppConfig } from '../../../config/networks';

export interface WalletServices {
  storageService: AztecStorageService;
  walletService: AztecWalletService;
  contractService: AztecContractService;
}

export const initializeWalletServices = async (
  nodeUrl: string,
  config: AppConfig
): Promise<WalletServices> => {
  // Initialize storage service
  const storageService = new AztecStorageService();

  // Initialize wallet service
  const walletService = new AztecWalletService();
  await walletService.initialize(nodeUrl);

  // Initialize contract service
  const contractService = new AztecContractService(walletService.getPXE());

  // Register contracts
  await registerContracts(contractService, config);

  return {
    storageService,
    walletService,
    contractService,
  };
};

const registerContracts = async (
  contractService: AztecContractService,
  config: AppConfig
): Promise<void> => {
  // Register EasyPrivateVoting contract
  const deployerAddress = AztecAddress.fromString(config.deployerAddress);
  const deploymentSalt = Fr.fromString(config.deploymentSalt);
  
  await contractService.registerContract(
    EasyPrivateVotingContract.artifact,
    deployerAddress,
    deploymentSalt,
    [deployerAddress] // Constructor args
  );

  // Register Dripper contract
  const dripperDeploymentSalt = Fr.fromString(config.dripperDeploymentSalt);
  
  await contractService.registerContract(
    DripperContract.artifact,
    deployerAddress,
    dripperDeploymentSalt,
    [] // No constructor args for Dripper
  );

  // Register Token contract
  const tokenDeploymentSalt = Fr.fromString(config.tokenDeploymentSalt);

  await contractService.registerContract(
    TokenContract.artifact,
    deployerAddress,
    tokenDeploymentSalt,
    [
      "Yield Token", // name
      "YT", // symbol
      18, // decimals
      AztecAddress.fromString(config.dripperContractAddress), // minter (Dripper address)
      AztecAddress.ZERO, // upgrade_authority (zero address for non-upgradeable)
    ],
    'constructor_with_minter' // Pass the specific constructor artifact
  );
};
