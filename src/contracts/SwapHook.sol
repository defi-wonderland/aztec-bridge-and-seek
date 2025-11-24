// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {TypeCasts} from "@hyperlane-xyz/libs/TypeCasts.sol";
import {OrderData, OrderEncoder} from "./libs/OrderEncoder.sol";
import {IHook7683Recipient} from "./interfaces/IHook7683Recipient.sol";
import {IOriginSettler, OnchainCrossChainOrder} from "./interfaces/IERC7683.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SwapHook is IHook7683Recipient {
    address public constant L2_GATEWAY_7683 = 0x85752d27D29FF5D0683b8aE1B60705080CA7142f;
    address public constant UNISWAP_ROUTER_V2 = 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602;
    address public constant SWAP_OUTPUT_TOKEN = 0x036CbD53842c5426634e7929541eC2318f3dCF7e; // USDC
    bytes32 public constant SWAP_OUTPUT_TOKEN_AZTEC = bytes32(0x089d76aaa3261376f2073894cddff9a070c1ca2c3ae2a2b25fcce25d68caae81); // USDC in Aztec
    bytes32 public constant AZTEC_GATEWAY_7683 = bytes32(0x1d00eed278af1188812a21fa4c2e38034424e166196229a25026ecc35c1502b9);
    uint256 public nonce;

    mapping(bytes32 => bytes32) public orderIdMapping;

    function onFilledOrder(OrderData memory orderData) external override {
        require(msg.sender == L2_GATEWAY_7683, "not gateway");

        // Swap
        address swapInputToken = TypeCasts.bytes32ToAddress(orderData.outputToken);
        address[] memory path = new address[](2);
        path[0] = swapInputToken;
        path[1] = SWAP_OUTPUT_TOKEN;
        uint256 amountOutMin = 0; // Trust for now
        IERC20(swapInputToken).approve(UNISWAP_ROUTER_V2, orderData.amountOut);
        IUniswapV2Router02(UNISWAP_ROUTER_V2).swapExactTokensForTokens(orderData.amountOut, amountOutMin, path, address(this), block.timestamp);
        
        // Bridge in
        uint256 balanceOfSwapOutputToken = IERC20(SWAP_OUTPUT_TOKEN).balanceOf(address(this));
        IERC20(SWAP_OUTPUT_TOKEN).approve(L2_GATEWAY_7683, balanceOfSwapOutputToken);

        OrderData memory returnedOrderData = OrderData({
            sender: bytes32(0), // This gets completed with msg.sender in the L2Gateway7683 contract open() --> _resolvedOrder()
            recipient: orderData.data, // the secret hash should be encoded in the data bytes32 variable
            inputToken: bytes32(uint256(uint160(SWAP_OUTPUT_TOKEN))),
            outputToken: SWAP_OUTPUT_TOKEN_AZTEC,
            amountIn: balanceOfSwapOutputToken,
            amountOut: balanceOfSwapOutputToken,
            senderNonce: nonce++,
            originDomain: uint32(block.chainid),
            destinationDomain: orderData.originDomain,
            destinationSettler: AZTEC_GATEWAY_7683,
            fillDeadline: orderData.fillDeadline,
            orderType: OrderEncoder.PRIVATE_ORDER,
            data: bytes32(0)
        });

        OnchainCrossChainOrder memory returnedOrder = OnchainCrossChainOrder({
            fillDeadline: returnedOrderData.fillDeadline,
            orderDataType: OrderEncoder.orderDataType(),
            orderData: OrderEncoder.encode(returnedOrderData)
        });

        IOriginSettler(L2_GATEWAY_7683).open(returnedOrder);

        // Register bridge out --> bridge in order ids
        returnedOrderData.sender = bytes32(uint256(uint160(address(this))));
        orderIdMapping[OrderEncoder.id(orderData)] = OrderEncoder.id(returnedOrderData);
    }
}
