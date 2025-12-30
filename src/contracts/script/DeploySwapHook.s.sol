// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Script.sol";

import {SwapHook} from "../src/SwapHook.sol";

contract DeploySwapHook is Script {
    function run() external returns (SwapHook swapHook) {
        uint256 deployerPrivateKey = vm.envUint("PK_EVM");
        address deployer = vm.addr(deployerPrivateKey);

        // Read config from env vars with defaults
        address l2Gateway7683 = vm.envOr("L2_GATEWAY_7683", address(0xC36E784E1dff616bDae4EAc7B310F0934FaF04a4));
        address uniswapRouterV2 = vm.envOr("UNISWAP_ROUTER_V2", address(0x1689E7B1F10000AE47eBfE339a4f69dECd19F602));
        address defaultOutputToken = vm.envOr("DEFAULT_OUTPUT_TOKEN", address(0xA52B8d7D08f2aC091feE807fCc7FD20D1da05bB1)); // USDC
        bytes32 defaultOutputTokenAztec = vm.envOr("DEFAULT_OUTPUT_TOKEN_AZTEC", bytes32(0x212028585111d48bdb2b447c070d44acd5c5c10dc6973879f7a128d631f4dcb4)); // USDC in Aztec
        bytes32 aztecGateway7683 = vm.envOr("AZTEC_GATEWAY_7683", bytes32(0x26e6a88465a1ef77f9ff026fa16ec0b1397d67914f74785be6913767eb54b85b));

        console.log("Deploying SwapHook from:", deployer);
        console.log("Target chain id:", block.chainid);
        console.log("L2 Gateway 7683:", l2Gateway7683);
        console.log("Uniswap Router V2:", uniswapRouterV2);
        console.log("Default Output Token:", defaultOutputToken);

        vm.startBroadcast(deployerPrivateKey);
        swapHook = new SwapHook(
            l2Gateway7683,
            uniswapRouterV2,
            defaultOutputToken,
            defaultOutputTokenAztec,
            aztecGateway7683
        );
        vm.stopBroadcast();

        console.log("SwapHook deployed at:", address(swapHook));
    }
}

// forge script script/DeploySwapHook.s.sol:DeploySwapHook --rpc-url base_sepolia --broadcast --verify