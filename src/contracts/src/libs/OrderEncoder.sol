// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {BytesReader} from "./BytesReader.sol";
import {Poseidon2} from "./Poseidon2.sol";
import {Field} from "./Field.sol";

struct OrderData {
    bytes32 sender;
    bytes32 recipient;
    bytes32 inputToken;
    bytes32 outputToken;
    uint256 amountIn;
    uint256 amountOut;
    uint256 senderNonce;
    uint32 originDomain;
    uint32 destinationDomain;
    bytes32 destinationSettler;
    uint32 fillDeadline;
    uint8 orderType;
    bytes32 data;
}

library OrderEncoder {
    using BytesReader for bytes;

    error InvalidOrderLength();

    bytes constant ORDER_DATA_TYPE = abi.encodePacked(
        "OrderData(",
        "bytes32 sender,",
        "bytes32 recipient,",
        "bytes32 inputToken,",
        "bytes32 outputToken,",
        "uint256 amountIn,",
        "uint256 amountOut,",
        "uint256 senderNonce,",
        "uint32 originDomain,",
        "uint32 destinationDomain,",
        "bytes32 destinationSettler,",
        "uint32 fillDeadline,",
        "uint8 orderType,",
        "bytes32 data)"
    );

    uint8 constant PUBLIC_ORDER = 0;
    uint8 constant PRIVATE_ORDER = 1;
    uint8 constant PUBLIC_ORDER_WITH_HOOK = 2;
    uint8 constant PRIVATE_ORDER_WITH_HOOK = 3;
    bytes32 constant ORDER_DATA_TYPE_HASH = sha256(ORDER_DATA_TYPE);

    function orderDataType() internal pure returns (bytes32) {
        return ORDER_DATA_TYPE_HASH;
    }

    function id(OrderData memory order) internal pure returns (bytes32) {
        Field.Type[] memory inputs = new Field.Type[](13);
        inputs[0] = Field.toFieldReduce(order.sender);
        inputs[1] = Field.toFieldReduce(order.recipient);
        inputs[2] = Field.toFieldReduce(order.inputToken);
        inputs[3] = Field.toFieldReduce(order.outputToken);
        inputs[4] = Field.toFieldReduce(order.amountIn);
        inputs[5] = Field.toFieldReduce(order.amountOut);
        inputs[6] = Field.toFieldReduce(order.senderNonce);
        inputs[7] = Field.toField(order.originDomain);
        inputs[8] = Field.toField(order.destinationDomain);
        inputs[9] = Field.toFieldReduce(order.destinationSettler);
        inputs[10] = Field.toField(order.fillDeadline);
        inputs[11] = Field.toField(order.orderType);
        inputs[12] = Field.toFieldReduce(order.data);
        return Field.toBytes32(Poseidon2.hash(inputs, inputs.length, false));
    }

    function encode(OrderData memory order) internal pure returns (bytes memory) {
        return abi.encodePacked(
            order.sender,
            order.recipient,
            order.inputToken,
            order.outputToken,
            order.amountIn,
            order.amountOut,
            order.senderNonce,
            order.originDomain,
            order.destinationDomain,
            order.destinationSettler,
            order.fillDeadline,
            order.orderType,
            order.data
        );
    }

    function decode(bytes memory orderBytes) internal pure returns (OrderData memory order) {
        require(orderBytes.length == 301, InvalidOrderLength());

        order.sender = orderBytes.readBytes32(0);
        order.recipient = orderBytes.readBytes32(32);
        order.inputToken = orderBytes.readBytes32(64);
        order.outputToken = orderBytes.readBytes32(96);
        order.amountIn = orderBytes.readUint256(128);
        order.amountOut = orderBytes.readUint256(160);
        order.senderNonce = orderBytes.readUint256(192);
        order.originDomain = orderBytes.readUint32(224);
        order.destinationDomain = orderBytes.readUint32(228);
        order.destinationSettler = orderBytes.readBytes32(232);
        order.fillDeadline = orderBytes.readUint32(264);
        order.orderType = orderBytes.readUint8(268);
        order.data = orderBytes.readBytes32(269);

        return order;
    }
}
