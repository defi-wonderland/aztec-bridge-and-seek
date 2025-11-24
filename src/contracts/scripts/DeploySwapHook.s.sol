// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Script.sol";

import {SwapHook} from "../SwapHook.sol";

contract DeploySwapHook is Script {
    function run() external returns (SwapHook swapHook) {
        uint256 deployerPrivateKey = vm.envUint("PK_EVM");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying SwapHook from:", deployer);
        console.log("Target chain id:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);
        swapHook = new SwapHook();
        vm.stopBroadcast();

        console.log("SwapHook deployed at:", address(swapHook));
    }
}

// forge script script/DeploySwapHook.s.sol --rpc-url base_sepolia --broadcast --verify