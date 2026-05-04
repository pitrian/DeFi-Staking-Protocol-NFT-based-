// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./VaultManager.sol";

contract SavingCore is ERC721, ERC721Enumerable, Ownable, Pausable, ReentrancyGuard {
    uint256 public constant GRACE_PERIOD_SECONDS = 3 days;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    string private _baseTokenURI;

    VaultManager public immutable vaultManager;
    IERC20 public immutable usdc;

    uint256 private _nextDepositId;
    uint256 private _nextPlanId;

    struct Plan {
        uint256 tenorDays;
        uint256 aprBps;
        uint256 minDeposit;
        uint256 maxDeposit;
        uint256 penaltyBps;
        bool enabled;
    }

    struct Deposit {
        address owner;
        uint256 principal;
        uint256 planId;
        uint256 aprBpsAtOpen;
        uint256 penaltyBpsAtOpen;
        uint256 startAt;
        uint256 maturityAt;
        DepositStatus status;
    }

    enum DepositStatus {
        Active,
        Withdrawn,
        ManualRenewed,
        AutoRenewed
    }

    mapping(uint256 => Plan) public plans;
    mapping(uint256 => Deposit) public deposits;

    event PlanCreated(uint256 indexed planId, uint256 tenorDays, uint256 aprBps);
    event PlanUpdated(uint256 indexed planId, uint256 newAprBps);
    event PlanEnabled(uint256 indexed planId);
    event PlanDisabled(uint256 indexed planId);
    event DepositOpened(
        uint256 indexed depositId,
        address indexed owner,
        uint256 planId,
        uint256 principal,
        uint256 maturityAt,
        uint256 aprBpsAtOpen,
        uint256 penaltyBpsAtOpen
    );
    event Withdrawn(
        uint256 indexed depositId,
        address indexed owner,
        uint256 principal,
        uint256 interest,
        bool isEarly
    );
    event Renewed(
        uint256 indexed oldDepositId,
        uint256 indexed newDepositId,
        uint256 newPrincipal,
        uint256 newPlanId,
        bool isAuto
    );
    event BaseURISet(string baseURI);

    constructor(
        address _vaultManager,
        address _usdc,
        string memory baseURI_,
        address _admin
    ) ERC721("Term Deposit NFT", "TDNFT") Ownable() {
        require(_vaultManager != address(0), "Invalid vault manager");
        require(_usdc != address(0), "Invalid USDC");

        vaultManager = VaultManager(_vaultManager);
        usdc = IERC20(_usdc);
        _baseTokenURI = baseURI_;
        _transferOwnership(_admin);
        _nextDepositId = 1;
        _nextPlanId = 1;
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURISet(newBaseURI);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function createPlan(
        uint256 tenorDays,
        uint256 aprBps,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 penaltyBps
    ) external onlyOwner returns (uint256 planId) {
        require(tenorDays > 0, "Invalid tenor");
        require(aprBps > 0 && aprBps <= 10000, "Invalid APR");
        require(maxDeposit == 0 || minDeposit <= maxDeposit, "Invalid deposit range");
        require(penaltyBps <= 10000, "Invalid penalty");

        planId = _nextPlanId++;
        plans[planId] = Plan({
            tenorDays: tenorDays,
            aprBps: aprBps,
            minDeposit: minDeposit,
            maxDeposit: maxDeposit,
            penaltyBps: penaltyBps,
            enabled: true
        });

        emit PlanCreated(planId, tenorDays, aprBps);
    }

    function updatePlan(uint256 planId, uint256 newAprBps) external onlyOwner {
        require(newAprBps > 0 && newAprBps <= 10000, "Invalid APR");
        Plan storage plan = plans[planId];
        require(plan.tenorDays > 0, "Plan does not exist");

        plan.aprBps = newAprBps;
        emit PlanUpdated(planId, newAprBps);
    }

    function enablePlan(uint256 planId) external onlyOwner {
        require(plans[planId].tenorDays > 0, "Plan does not exist");
        plans[planId].enabled = true;
        emit PlanEnabled(planId);
    }

    function disablePlan(uint256 planId) external onlyOwner {
        require(plans[planId].tenorDays > 0, "Plan does not exist");
        plans[planId].enabled = false;
        emit PlanDisabled(planId);
    }

    function openDeposit(uint256 planId, uint256 amount) external whenNotPaused nonReentrant {
        Plan storage plan = plans[planId];
        require(plan.tenorDays > 0, "Plan does not exist");
        require(plan.enabled, "Plan is disabled");
        require(amount >= plan.minDeposit, "Below min deposit");
        require(plan.maxDeposit == 0 || amount <= plan.maxDeposit, "Above max deposit");

        uint256 allowance = usdc.allowance(msg.sender, address(this));
        require(allowance >= amount, "Insufficient allowance");

        usdc.transferFrom(msg.sender, address(this), amount);

        uint256 depositId = _nextDepositId++;
        uint256 maturityAt = block.timestamp + (plan.tenorDays * 1 days);

        deposits[depositId] = Deposit({
            owner: msg.sender,
            principal: amount,
            planId: planId,
            aprBpsAtOpen: plan.aprBps,
            penaltyBpsAtOpen: plan.penaltyBps,
            startAt: block.timestamp,
            maturityAt: maturityAt,
            status: DepositStatus.Active
        });

        _mint(msg.sender, depositId);

        emit DepositOpened(
            depositId,
            msg.sender,
            planId,
            amount,
            maturityAt,
            plan.aprBps,
            plan.penaltyBps
        );
    }

    function withdraw(uint256 depositId) external whenNotPaused nonReentrant {
        Deposit storage deposit = deposits[depositId];
        require(deposit.owner == msg.sender, "Not owner");
        require(deposit.status == DepositStatus.Active, "Not active");

        bool isEarly = block.timestamp < deposit.maturityAt;
        uint256 principal = deposit.principal;
        uint256 interest = 0;
        uint256 penalty = 0;

        if (isEarly) {
            penalty = (principal * deposit.penaltyBpsAtOpen) / 10000;
            if (penalty > 0) {
                usdc.transfer(vaultManager.feeReceiver(), penalty);
            }
        } else {
            interest = _calculateInterest(principal, deposit.aprBpsAtOpen, deposit.startAt, deposit.maturityAt);
            _payInterest(msg.sender, interest);
        }

        uint256 userReceives = principal - penalty;
        usdc.transfer(msg.sender, userReceives);

        deposit.status = DepositStatus.Withdrawn;
        _burn(depositId);

        emit Withdrawn(depositId, msg.sender, principal, interest, isEarly);
    }

    function renewDeposit(uint256 depositId, uint256 newPlanId) external whenNotPaused nonReentrant {
        Deposit storage oldDeposit = deposits[depositId];
        require(oldDeposit.owner == msg.sender, "Not owner");
        require(oldDeposit.status == DepositStatus.Active, "Not active");
        require(block.timestamp >= oldDeposit.maturityAt, "Cannot renew before maturity");
        require(block.timestamp <= oldDeposit.maturityAt + GRACE_PERIOD_SECONDS, "Use auto-renew");

        Plan storage newPlan = plans[newPlanId];
        require(newPlan.tenorDays > 0, "New plan does not exist");
        require(newPlan.enabled, "New plan is disabled");

        uint256 interest = _calculateInterest(
            oldDeposit.principal,
            oldDeposit.aprBpsAtOpen,
            oldDeposit.startAt,
            oldDeposit.maturityAt
        );
        uint256 newPrincipal = oldDeposit.principal + interest;

        require(newPrincipal >= newPlan.minDeposit, "New principal below min");
        require(newPlan.maxDeposit == 0 || newPrincipal <= newPlan.maxDeposit, "Above max");

        uint256 newMaturityAt = block.timestamp + (newPlan.tenorDays * 1 days);

        uint256 newDepositId = _nextDepositId++;
        deposits[newDepositId] = Deposit({
            owner: msg.sender,
            principal: newPrincipal,
            planId: newPlanId,
            aprBpsAtOpen: newPlan.aprBps,
            penaltyBpsAtOpen: newPlan.penaltyBps,
            startAt: block.timestamp,
            maturityAt: newMaturityAt,
            status: DepositStatus.Active
        });

        _payInterest(msg.sender, interest);

        oldDeposit.status = DepositStatus.ManualRenewed;
        _mint(msg.sender, newDepositId);

        emit Renewed(depositId, newDepositId, newPrincipal, newPlanId, false);
    }

    function autoRenewDeposit(uint256 depositId) external whenNotPaused nonReentrant {
        Deposit storage oldDeposit = deposits[depositId];
        require(oldDeposit.status == DepositStatus.Active, "Not active");
        require(
            block.timestamp > oldDeposit.maturityAt + GRACE_PERIOD_SECONDS,
            "Grace period not ended"
        );

        Plan storage originalPlan = plans[oldDeposit.planId];
        require(originalPlan.enabled, "Original plan disabled");

        uint256 interest = _calculateInterest(
            oldDeposit.principal,
            oldDeposit.aprBpsAtOpen,
            oldDeposit.startAt,
            oldDeposit.maturityAt
        );
        uint256 newPrincipal = oldDeposit.principal + interest;

        uint256 newMaturityAt = block.timestamp + (originalPlan.tenorDays * 1 days);

        uint256 newDepositId = _nextDepositId++;
        deposits[newDepositId] = Deposit({
            owner: oldDeposit.owner,
            principal: newPrincipal,
            planId: oldDeposit.planId,
            aprBpsAtOpen: oldDeposit.aprBpsAtOpen,
            penaltyBpsAtOpen: oldDeposit.penaltyBpsAtOpen,
            startAt: block.timestamp,
            maturityAt: newMaturityAt,
            status: DepositStatus.Active
        });

        _payInterest(oldDeposit.owner, interest);

        oldDeposit.status = DepositStatus.AutoRenewed;
        _mint(oldDeposit.owner, newDepositId);

        emit Renewed(depositId, newDepositId, newPrincipal, oldDeposit.planId, true);
    }

    function getDeposit(uint256 depositId) external view returns (Deposit memory) {
        return deposits[depositId];
    }

    function getPlan(uint256 planId) external view returns (Plan memory) {
        return plans[planId];
    }

    function getDepositsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory result = new uint256[](balance);
        for (uint256 i = 0; i < balance; i++) {
            result[i] = tokenOfOwnerByIndex(owner, i);
        }
        return result;
    }

    function _calculateInterest(
        uint256 principal,
        uint256 aprBps,
        uint256 startAt,
        uint256 maturityAt
    ) internal view returns (uint256) {
        if (block.timestamp < maturityAt) {
            return 0;
        }
        uint256 secondsElapsed = maturityAt - startAt;
        return (principal * aprBps * secondsElapsed) / (SECONDS_PER_YEAR * 10000);
    }

    function calculateInterest(
        uint256 principal,
        uint256 aprBps,
        uint256 fromTime,
        uint256 toTime
    ) external pure returns (uint256) {
        require(toTime >= fromTime, "Invalid time range");
        uint256 secondsElapsed = toTime - fromTime;
        return (principal * aprBps * secondsElapsed) / (SECONDS_PER_YEAR * 10000);
    }

    function _payInterest(address recipient, uint256 amount) internal {
        if (amount > 0) {
            vaultManager.withdrawInterest(amount, recipient);
        }
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function nextDepositId() external view returns (uint256) {
        return _nextDepositId;
    }

    function nextPlanId() external view returns (uint256) {
        return _nextPlanId;
    }
}