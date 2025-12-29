// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {TypeCasts} from "@hyperlane-xyz/libs/TypeCasts.sol";
import {OrderData, OrderEncoder} from "./libs/OrderEncoder.sol";
import {BytesReader} from "./libs/BytesReader.sol";
import {IHook7683Recipient} from "./interfaces/IHook7683Recipient.sol";
import {IOriginSettler, OnchainCrossChainOrder} from "./interfaces/IERC7683.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SwapHook is IHook7683Recipient {
    using BytesReader for bytes;

    address public immutable L2_GATEWAY_7683;
    address public immutable UNISWAP_ROUTER_V2;
    address public immutable DEFAULT_OUTPUT_TOKEN;
    bytes32 public immutable DEFAULT_OUTPUT_TOKEN_AZTEC;
    bytes32 public immutable AZTEC_GATEWAY_7683;
    uint256 public nonce;

    mapping(bytes32 => bytes32) public orderIdMapping;
    mapping(address => bytes32) public aztecTokenMapping;

    constructor(
        address l2Gateway7683,
        address uniswapRouterV2,
        address defaultOutputToken,
        bytes32 defaultOutputTokenAztec,
        bytes32 aztecGateway7683
    ) {
        L2_GATEWAY_7683 = l2Gateway7683;
        UNISWAP_ROUTER_V2 = uniswapRouterV2;
        DEFAULT_OUTPUT_TOKEN = defaultOutputToken;
        DEFAULT_OUTPUT_TOKEN_AZTEC = defaultOutputTokenAztec;
        AZTEC_GATEWAY_7683 = aztecGateway7683;
        aztecTokenMapping[defaultOutputToken] = defaultOutputTokenAztec;
    }

    function setAztecTokenMapping(address evmToken, bytes32 aztecToken) external {
        aztecTokenMapping[evmToken] = aztecToken;
    }

    function _parseHookData(bytes memory data) internal pure returns (
        bytes32 secretHash,
        uint256 minAmountOut,
        address outputToken
    ) {
        secretHash = data.readBytes32(0);
        minAmountOut = data.readUint256(32);
        outputToken = address(uint160(uint256(data.readBytes32(64))));
    }

    function onFilledOrder(OrderData memory orderData) external override {
        require(msg.sender == L2_GATEWAY_7683, "not gateway");

        (bytes32 secretHash, uint256 minAmountOut, address customOutputToken) = _parseHookData(orderData.data);

        address swapOutputToken = customOutputToken != address(0) ? customOutputToken : DEFAULT_OUTPUT_TOKEN;
        bytes32 swapOutputTokenAztec = aztecTokenMapping[swapOutputToken];
        require(swapOutputTokenAztec != bytes32(0), "output token not mapped");

        address swapInputToken = TypeCasts.bytes32ToAddress(orderData.outputToken);
        address[] memory path = new address[](2);
        path[0] = swapInputToken;
        path[1] = swapOutputToken;
        IERC20(swapInputToken).approve(UNISWAP_ROUTER_V2, orderData.amountOut);
        IUniswapV2Router02(UNISWAP_ROUTER_V2).swapExactTokensForTokens(
            orderData.amountOut,
            minAmountOut,
            path,
            address(this),
            block.timestamp
        );

        uint256 balanceOfSwapOutputToken = IERC20(swapOutputToken).balanceOf(address(this));
        IERC20(swapOutputToken).approve(L2_GATEWAY_7683, balanceOfSwapOutputToken);

        OrderData memory returnedOrderData = OrderData({
            sender: bytes32(0),
            recipient: secretHash,
            inputToken: bytes32(uint256(uint160(swapOutputToken))),
            outputToken: swapOutputTokenAztec,
            amountIn: balanceOfSwapOutputToken,
            amountOut: balanceOfSwapOutputToken,
            senderNonce: nonce++,
            originDomain: uint32(block.chainid),
            destinationDomain: orderData.originDomain,
            destinationSettler: AZTEC_GATEWAY_7683,
            fillDeadline: orderData.fillDeadline,
            orderType: OrderEncoder.PRIVATE_ORDER,
            data: new bytes(128)
        });

        OnchainCrossChainOrder memory returnedOrder = OnchainCrossChainOrder({
            fillDeadline: returnedOrderData.fillDeadline,
            orderDataType: OrderEncoder.orderDataType(),
            orderData: OrderEncoder.encode(returnedOrderData)
        });

        IOriginSettler(L2_GATEWAY_7683).open(returnedOrder);

        returnedOrderData.sender = bytes32(uint256(uint160(address(this))));
        orderIdMapping[OrderEncoder.id(orderData)] = OrderEncoder.id(returnedOrderData);
    }
}
