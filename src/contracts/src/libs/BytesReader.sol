// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

library BytesReader {
    error OutOfRange();

    function readBytes32(bytes memory data, uint256 offset) internal pure returns (bytes32 result) {
        require(data.length >= offset + 32, OutOfRange());
        assembly {
            result := mload(add(data, add(32, offset)))
        }
    }

    function readUint256(bytes memory data, uint256 offset) internal pure returns (uint256 result) {
        require(data.length >= offset + 32, OutOfRange());
        assembly {
            result := mload(add(data, add(32, offset)))
        }
    }

    function readUint32(bytes memory data, uint256 offset) internal pure returns (uint32 result) {
        require(data.length >= offset + 4, OutOfRange());
        assembly {
            let word := mload(add(data, add(32, offset)))
            result := shr(224, word) // shift down to get the top 4 bytes
        }
    }

    function readUint8(bytes memory data, uint256 offset) internal pure returns (uint8 result) {
        require(data.length > offset, OutOfRange());
        assembly {
            result := byte(0, mload(add(add(data, 32), offset)))
        }
    }

    function readBytes(bytes memory data, uint256 offset, uint256 length) internal pure returns (bytes memory result) {
        require(data.length >= offset + length, OutOfRange());
        result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[offset + i];
        }
    }
}
