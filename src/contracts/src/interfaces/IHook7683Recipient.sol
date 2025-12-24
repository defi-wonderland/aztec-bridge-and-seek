pragma solidity 0.8.28;

import {OrderData} from "../libs/OrderEncoder.sol";

interface IHook7683Recipient {
    function onFilledOrder(OrderData memory orderData) external;
}
