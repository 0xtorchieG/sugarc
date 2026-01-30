// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Sugarc {
    string public name = "Sugarc";
    string public symbol = "SUGAR";

    event GreetingSet(string greeting);

    string public greeting = "Tokenized invoice factoring on Arc";

    function setGreeting(string calldata _greeting) external {
        greeting = _greeting;
        emit GreetingSet(_greeting);
    }
}
