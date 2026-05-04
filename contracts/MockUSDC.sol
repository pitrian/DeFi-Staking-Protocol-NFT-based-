// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    uint8 private immutable _decimals;
    uint256 public constant FAUCET_AMOUNT = 1000 * 10**6;
    mapping(address => bool) public hasUsedFaucet;

    constructor() ERC20("Mock USDC", "MUSDC") Ownable() {
        _decimals = 6;
        _transferOwnership(msg.sender);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function faucet() external {
        require(!hasUsedFaucet[msg.sender], "Faucet already used");
        hasUsedFaucet[msg.sender] = true;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}