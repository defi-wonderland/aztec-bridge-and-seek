import { AztecAddress, createAztecNodeClient, Fr } from '@aztec/aztec.js';
import { AztecWalletService, AztecContractService } from '../core';
import { AztecStorageService } from '../storage';
import { DripperContract } from '../../../artifacts/Dripper';
import { TokenContract } from '@defi-wonderland/aztec-standards/current/artifacts/artifacts/Token.js';
import { TokenContractArtifact as AztecTokenContractArtifact } from '@aztec/noir-contracts.js/Token';
import { AppConfig } from '../../../config/networks';
import { AztecGateway7683ContractArtifact } from '../../../artifacts/AztecGateway7683';

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
  // Register Dripper contract
  const dripperDeploymentSalt = Fr.fromString(config.dripperDeploymentSalt);
  
  await contractService.registerContract(
    DripperContract.artifact,
    AztecAddress.ZERO,
    dripperDeploymentSalt,
    [], // No constructor args for Dripper
    'constructor' // Pass the specific constructor artifact
  );

  // Register Token contract
  const tokenDeploymentSalt = Fr.fromString(config.tokenDeploymentSalt);

  await contractService.registerContract(
    TokenContract.artifact,
    AztecAddress.ZERO,
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

  // Register WETH contract if on testnet
  if (config.isTestnet) {
    console.log('Registering WETH contract...');
    try {
      const wethAddress = AztecAddress.fromString('0x143c799188d6881bff72012bebb100d19b51ce0c90b378bfa3ba57498b5ddeeb');
      await contractService.pxe.registerContract({
        instance: (await createAztecNodeClient(config.nodeUrl).getContract(
          wethAddress,
        ))!,
        artifact: AztecTokenContractArtifact,
      })
    } catch (error) {
      // Don't fail initialization if WETH registration fails
    }

    // Register Gateway contract
    try {
      // todo: add to config
      const gatewayAddress = AztecAddress.fromString('0x1b4f272b622a493184f6fbb83fc7631f1ce9bad68d4d4c150dc55eed5f100d73');
      await contractService.pxe.registerContract({
        instance: (await createAztecNodeClient(config.nodeUrl).getContract(
          gatewayAddress,
        ))!,
        artifact: AztecGateway7683ContractArtifact,
      })
    } catch (error) {
      console.log('error', error);
    }
  }
};
