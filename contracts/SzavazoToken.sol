// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts@5.6.1/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts@5.6.1/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts@5.6.1/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts@5.6.1/access/Ownable.sol";

contract SzavazoToken is ERC20, ERC20Votes, Ownable {
    constructor()
        ERC20("Iskola Governance", "IGOV")
        EIP712("Iskola Governance", "1")
        Ownable(msg.sender)
    {}

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function mintBatch(address[] calldata to, uint256[] calldata amounts) external onlyOwner {
        require(to.length == amounts.length, "Eltero hosszu listak");
        for (uint256 i = 0; i < to.length; i++) {
            _mint(to[i], amounts[i]);
        }
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
        if (to != address(0) && delegates(to) == address(0)) {
            _delegate(to, to);
        }
    }
}
