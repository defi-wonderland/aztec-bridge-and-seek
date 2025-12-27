// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

interface IUniswapV2Router02 {
    function factory() external view returns (address);
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

interface IERC20Mintable {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function mint(address to, uint256 amount) external;
}

/// @title CreateUniV2Pair
/// @notice Forge script to create a UniswapV2 pair and add initial liquidity
/// @dev Run with: forge script script/CreateUniV2Pair.s.sol --rpc-url base-sepolia --broadcast
contract CreateUniV2Pair is Script {
    // Base Sepolia UniV2 Router
    address constant ROUTER = 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602;

    // TWETH (18 decimals)
    address constant TWETH = 0x13B8A81197E987e50872faBB9D59Dbae5C4B1907;
    // TUSDC (6 decimals)
    address constant TUSDC = 0xA52B8d7D08f2aC091feE807fCc7FD20D1da05bB1;

    // Initial liquidity amounts (1 TWETH = 3000 TUSDC)
    uint256 constant AMOUNT_TWETH = 1_000 * 1e18;     // 1K TWETH (18 decimals)
    uint256 constant AMOUNT_TUSDC = 3_000_000 * 1e6;  // 3M TUSDC (6 decimals)

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Router:", ROUTER);
        console.log("TWETH:", TWETH);
        console.log("TUSDC:", TUSDC);

        IUniswapV2Router02 router = IUniswapV2Router02(ROUTER);
        address factory = router.factory();
        console.log("Factory:", factory);

        IUniswapV2Factory uniFactory = IUniswapV2Factory(factory);

        // Check if pair already exists
        address existingPair = uniFactory.getPair(TWETH, TUSDC);
        console.log("Existing pair:", existingPair);

        vm.startBroadcast(deployerPrivateKey);

        // Create pair if it doesn't exist
        address pair;
        if (existingPair == address(0)) {
            console.log("Creating new pair...");
            pair = uniFactory.createPair(TWETH, TUSDC);
            console.log("Pair created at:", pair);
        } else {
            pair = existingPair;
            console.log("Using existing pair:", pair);
        }

        IERC20Mintable tweth = IERC20Mintable(TWETH);
        IERC20Mintable tusdc = IERC20Mintable(TUSDC);

        // Mint tokens
        console.log("Minting tokens...");
        tweth.mint(deployer, AMOUNT_TWETH);
        tusdc.mint(deployer, AMOUNT_TUSDC);

        console.log("TWETH balance:", tweth.balanceOf(deployer));
        console.log("TUSDC balance:", tusdc.balanceOf(deployer));

        // Approve router to spend tokens
        console.log("Approving tokens...");
        tweth.approve(ROUTER, AMOUNT_TWETH);
        tusdc.approve(ROUTER, AMOUNT_TUSDC);

        // Add liquidity
        console.log("Adding liquidity...");
        (uint256 amountTWETH, uint256 amountTUSDC, uint256 liquidity) = router.addLiquidity(
            TWETH,
            TUSDC,
            AMOUNT_TWETH,
            AMOUNT_TUSDC,
            0, // amountAMin - accept any amount for initial liquidity
            0, // amountBMin - accept any amount for initial liquidity
            deployer,
            block.timestamp + 1 hours
        );

        console.log("Liquidity added!");
        console.log("TWETH deposited:", amountTWETH);
        console.log("TUSDC deposited:", amountTUSDC);
        console.log("LP tokens received:", liquidity);
        console.log("Pair address:", pair);

        vm.stopBroadcast();
    }

    /// @notice Alternative function to add liquidity with custom amounts
    function runCustom(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        IUniswapV2Router02 router = IUniswapV2Router02(ROUTER);
        IUniswapV2Factory uniFactory = IUniswapV2Factory(router.factory());

        vm.startBroadcast(deployerPrivateKey);

        // Create pair if needed
        address pair = uniFactory.getPair(tokenA, tokenB);
        if (pair == address(0)) {
            pair = uniFactory.createPair(tokenA, tokenB);
        }

        // Mint, approve and add liquidity
        IERC20Mintable(tokenA).mint(deployer, amountA);
        IERC20Mintable(tokenB).mint(deployer, amountB);
        IERC20Mintable(tokenA).approve(ROUTER, amountA);
        IERC20Mintable(tokenB).approve(ROUTER, amountB);

        router.addLiquidity(
            tokenA,
            tokenB,
            amountA,
            amountB,
            0,
            0,
            deployer,
            block.timestamp + 1 hours
        );

        vm.stopBroadcast();

        console.log("Pair:", pair);
    }
}
