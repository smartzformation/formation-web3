// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract PolarVote is ERC20 {
    using EnumerableSet for EnumerableSet.AddressSet;

    address public immutable governance;
    address public immutable treasury;
    EnumerableSet.AddressSet private holders;

    error GovernanceOnly();
    error InvalidSupply();
    error ReserveControlledByGovernance();

    constructor(address treasury_, uint256 supply) ERC20("Polar Vote", "POLARVOTE") {
        if (supply < 3 || supply > 100) revert InvalidSupply();
        governance = msg.sender;
        treasury = treasury_;
        _mint(treasury_, supply);
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function holderCount() external view returns (uint256) {
        return holders.length();
    }

    function holderAt(uint256 index) external view returns (address) {
        return holders.at(index);
    }

    function distribute(address recipient) external {
        if (msg.sender != governance) revert GovernanceOnly();
        _transfer(treasury, recipient, 1);
    }

    function recallAll() external returns (uint256 recovered) {
        if (msg.sender != governance) revert GovernanceOnly();
        while (holders.length() != 0) {
            address holder = holders.at(holders.length() - 1);
            uint256 balance = balanceOf(holder);
            recovered += balance;
            _transfer(holder, treasury, balance);
        }
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from == treasury && msg.sender != governance) revert ReserveControlledByGovernance();
        super._update(from, to, amount);
        if (from != address(0) && from != treasury && balanceOf(from) == 0) {
            holders.remove(from);
        }
        if (to != address(0) && to != treasury && balanceOf(to) != 0) {
            holders.add(to);
        }
    }
}

