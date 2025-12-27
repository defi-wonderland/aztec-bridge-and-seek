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

    address public constant L2_GATEWAY_7683 = 0x85752d27D29FF5D0683b8aE1B60705080CA7142f;
    address public constant UNISWAP_ROUTER_V2 = 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602;
    address public constant DEFAULT_OUTPUT_TOKEN = 0xA52B8d7D08f2aC091feE807fCc7FD20D1da05bB1; // USDC
    bytes32 public constant DEFAULT_OUTPUT_TOKEN_AZTEC = bytes32(0x212028585111d48bdb2b447c070d44acd5c5c10dc6973879f7a128d631f4dcb4); // USDC in Aztec
    bytes32 public constant AZTEC_GATEWAY_7683 = bytes32(0x1931c3d70613e1110df9740c46383a909acbe1c2a84ee6597099e6bfb6588c73);
    uint256 public nonce;

    mapping(bytes32 => bytes32) public orderIdMapping;
    mapping(address => bytes32) public aztecTokenMapping;

    constructor() {
        aztecTokenMapping[DEFAULT_OUTPUT_TOKEN] = DEFAULT_OUTPUT_TOKEN_AZTEC;
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
