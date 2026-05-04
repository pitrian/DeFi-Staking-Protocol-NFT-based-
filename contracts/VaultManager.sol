// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract VaultManager is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant VAULT_MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20 public immutable usdc;
    address public feeReceiver;
    uint256 public totalInterestWithdrawn;

    event VaultFunded(address indexed funder, uint256 amount);
    event VaultWithdrawn(address indexed recipient, uint256 amount);
    event InterestPaid(address indexed recipient, uint256 amount);
    event FeeReceiverSet(address indexed newFeeReceiver);
    event VaultManagerRoleGranted(address indexed manager);

    constructor(address _usdc, address _admin, address _feeReceiver) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_admin != address(0), "Invalid admin address");

        usdc = IERC20(_usdc);
        feeReceiver = _feeReceiver;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
    }

    function setFeeReceiver(address _feeReceiver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeReceiver != address(0), "Invalid fee receiver");
        feeReceiver = _feeReceiver;
        emit FeeReceiverSet(_feeReceiver);
    }

    function grantVaultManagerRole(address _manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_manager != address(0), "Invalid manager");
        _grantRole(VAULT_MANAGER_ROLE, _manager);
        emit VaultManagerRoleGranted(_manager);
    }

    function fundVault(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit VaultFunded(msg.sender, amount);
    }

    function withdrawVault(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be > 0");
        uint256 available = availableBalance();
        require(available >= amount, "Insufficient available balance");

        totalInterestWithdrawn += amount;
        usdc.safeTransfer(msg.sender, amount);
        emit VaultWithdrawn(msg.sender, amount);
    }

    function withdrawInterest(uint256 amount, address recipient) external onlyRole(VAULT_MANAGER_ROLE) whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(recipient != address(0), "Invalid recipient");
        require(availableBalance() >= amount, "Insufficient vault balance for interest");

        totalInterestWithdrawn += amount;
        usdc.safeTransfer(recipient, amount);
        emit InterestPaid(recipient, amount);
    }

    function availableBalance() public view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        return balance >= totalInterestWithdrawn ? balance - totalInterestWithdrawn : 0;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}