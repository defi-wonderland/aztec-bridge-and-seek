// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Script.sol";

import {SwapHook} from "../src/SwapHook.sol";

contract DeploySwapHook is Script {
    address constant L2_GATEWAY_7683 = 0x85752d27D29FF5D0683b8aE1B60705080CA7142f;
    address constant UNISWAP_ROUTER_V2 = 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602;
    address constant DEFAULT_OUTPUT_TOKEN = 0xA52B8d7D08f2aC091feE807fCc7FD20D1da05bB1; // USDC
    bytes32 constant DEFAULT_OUTPUT_TOKEN_AZTEC = bytes32(0x212028585111d48bdb2b447c070d44acd5c5c10dc6973879f7a128d631f4dcb4); // USDC in Aztec
    bytes32 constant AZTEC_GATEWAY_7683 = bytes32(0x1931c3d70613e1110df9740c46383a909acbe1c2a84ee6597099e6bfb6588c73);

    function run() external returns (SwapHook swapHook) {
        uint256 deployerPrivateKey = vm.envUint("PK_EVM");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying SwapHook from:", deployer);
        console.log("Target chain id:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);
        swapHook = new SwapHook(
            L2_GATEWAY_7683,
            UNISWAP_ROUTER_V2,
            DEFAULT_OUTPUT_TOKEN,
            DEFAULT_OUTPUT_TOKEN_AZTEC,
            AZTEC_GATEWAY_7683
        );
        vm.stopBroadcast();

        console.log("SwapHook deployed at:", address(swapHook));
    }
}

// forge script script/DeploySwapHook.s.sol:DeploySwapHook --rpc-url base_sepolia --broadcast --verify