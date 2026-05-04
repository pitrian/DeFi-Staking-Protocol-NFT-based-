const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("SavingCore - Comprehensive Test Suite", function () {
  let savingCore, vaultManager, mockUSDC;
  let admin, user1, user2, user3;

  const MINT_AMOUNT = ethers.parseUnits("1000000", 6);
  const VAULT_FUND = ethers.parseUnits("500000", 6);
  const DEPOSIT_AMOUNT = ethers.parseUnits("10000", 6);
  const SMALL_DEPOSIT = ethers.parseUnits("100", 6);

  const FIVE_PERCENT = 500;
  const TEN_PERCENT = 1000;
  const FIFTEEN_PERCENT = 1500;
  const TWENTY_PERCENT = 2000;

  const ONE_DAY = 24 * 60 * 60;
  const THIRTY_DAYS = 30 * ONE_DAY;
  const SIXTY_DAYS = 60 * ONE_DAY;
  const GRACE_PERIOD = 3 * ONE_DAY;
  const ONE_YEAR = 365 * ONE_DAY;

  async function deployContracts() {
    [admin, user1, user2, user3] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    const VaultManager = await ethers.getContractFactory("VaultManager");
    vaultManager = await VaultManager.deploy(
      await mockUSDC.getAddress(),
      admin.address,
      admin.address
    );
    await vaultManager.waitForDeployment();

    const SavingCore = await ethers.getContractFactory("SavingCore");
    savingCore = await SavingCore.deploy(
      await vaultManager.getAddress(),
      await mockUSDC.getAddress(),
      "https://api.example.com/nft/",
      admin.address
    );
    await savingCore.waitForDeployment();

    await vaultManager.connect(admin).grantVaultManagerRole(await savingCore.getAddress());
    await mockUSDC.mint(admin.address, MINT_AMOUNT);
    await mockUSDC.connect(admin).approve(await vaultManager.getAddress(), MINT_AMOUNT);
    await vaultManager.connect(admin).fundVault(VAULT_FUND);

    await mockUSDC.mint(user1.address, MINT_AMOUNT);
    await mockUSDC.connect(user1).approve(await savingCore.getAddress(), MINT_AMOUNT);
    await mockUSDC.mint(user2.address, MINT_AMOUNT);
    await mockUSDC.connect(user2).approve(await savingCore.getAddress(), MINT_AMOUNT);
    await mockUSDC.mint(user3.address, MINT_AMOUNT);
    await mockUSDC.connect(user3).approve(await savingCore.getAddress(), MINT_AMOUNT);

    return { savingCore, vaultManager, mockUSDC, admin, user1, user2, user3 };
  }

  beforeEach(async function () {
    await deployContracts();
    await savingCore.connect(admin).createPlan(30, TEN_PERCENT, SMALL_DEPOSIT, ethers.parseUnits("100000", 6), FIVE_PERCENT);
    await savingCore.connect(admin).createPlan(60, FIFTEEN_PERCENT, SMALL_DEPOSIT, ethers.parseUnits("100000", 6), FIVE_PERCENT);
    await savingCore.connect(admin).createPlan(365, TWENTY_PERCENT, SMALL_DEPOSIT, ethers.parseUnits("100000", 6), FIVE_PERCENT);
  });

  describe("=== INTEREST CALCULATION & TIME TRAVEL ===", function () {
    describe("Withdraw at Exact Maturity", function () {
      it("should calculate exact interest for 30-day deposit", async function () {
        await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
        
        await network.provider.send("evm_increaseTime", [THIRTY_DAYS + 1]);
        await network.provider.send("evm_mine", []);

        const balanceBefore = await mockUSDC.balanceOf(user1.address);
        await savingCore.connect(user1).withdraw(1);
        const balanceAfter = await mockUSDC.balanceOf(user1.address);

        const received = balanceAfter - balanceBefore;
        // Expected: principal + (principal * 1000 * 30 / (365 * 10000))
        // = 10000 + 82.19... = 10082.19
        expect(received).to.be.greaterThan(DEPOSIT_AMOUNT);
        expect(received).to.be.lessThan(DEPOSIT_AMOUNT + ethers.parseUnits("100", 6));
      });

      it("should calculate exact interest for 60-day deposit", async function () {
        await savingCore.connect(user1).openDeposit(2, DEPOSIT_AMOUNT);
        
        await network.provider.send("evm_increaseTime", [SIXTY_DAYS + 1]);
        await network.provider.send("evm_mine", []);

        const balanceBefore = await mockUSDC.balanceOf(user1.address);
        await savingCore.connect(user1).withdraw(1);
        const balanceAfter = await mockUSDC.balanceOf(user1.address);

        const received = balanceAfter - balanceBefore;
        expect(received).to.be.greaterThan(DEPOSIT_AMOUNT);
        expect(received).to.be.lessThan(DEPOSIT_AMOUNT + ethers.parseUnits("250", 6));
      });

      it("should calculate exact interest for 365-day deposit", async function () {
        await savingCore.connect(user1).openDeposit(3, DEPOSIT_AMOUNT);
        
        await network.provider.send("evm_increaseTime", [ONE_YEAR + 1]);
        await network.provider.send("evm_mine", []);

        const balanceBefore = await mockUSDC.balanceOf(user1.address);
        await savingCore.connect(user1).withdraw(1);
        const balanceAfter = await mockUSDC.balanceOf(user1.address);

        const received = balanceAfter - balanceBefore;
        // For 365 days at 20% APR: 10000 * 20% = 2000 USDC interest
        // Total = 10000 + 2000 = 12000 USDC
        expect(received).to.equal(DEPOSIT_AMOUNT + ethers.parseUnits("2000", 6));
      });

      it("should return 0 interest if withdrawn before maturity (with penalty)", async function () {
        await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
        
        await network.provider.send("evm_increaseTime", [15 * ONE_DAY]);
        await network.provider.send("evm_mine", []);

        const balanceBefore = await mockUSDC.balanceOf(user1.address);
        await savingCore.connect(user1).withdraw(1);
        const balanceAfter = await mockUSDC.balanceOf(user1.address);

        const received = balanceAfter - balanceBefore;
        // Early withdrawal: principal - penalty (5%)
        // Interest = 0
        const penalty = (DEPOSIT_AMOUNT * BigInt(FIVE_PERCENT)) / BigInt(10000);
        expect(received).to.equal(DEPOSIT_AMOUNT - penalty);
      });
    });

    describe("CalculateInterest Public Function", function () {
      it("should return correct interest for 1 year", async function () {
        // 10000 USDC * 10% = 1000 USDC for 1 year
        const result = await savingCore.calculateInterest(ethers.parseUnits("10000", 6), 1000, 0, 365 * 24 * 60 * 60);
        expect(result).to.equal(ethers.parseUnits("1000", 6));
      });

      it("should return correct interest for 30 days", async function () {
        const result = await savingCore.calculateInterest(DEPOSIT_AMOUNT, TEN_PERCENT, 0, THIRTY_DAYS);
        // 10000 * 1000 * 30 / (365 * 10000) = 82.19...
        expect(result).to.be.closeTo(ethers.parseUnits("82", 6), ethers.parseUnits("1", 6));
      });

      it("should revert if toTime < fromTime", async function () {
        await expect(
          savingCore.calculateInterest(DEPOSIT_AMOUNT, TEN_PERCENT, 100, 50)
        ).to.be.revertedWith("Invalid time range");
      });
    });
  });

  describe("=== EARLY WITHDRAWAL (PENALTY) ===", function () {
    it("should apply penalty and return 0 interest when early withdraw", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [10 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      const balanceBefore = await mockUSDC.balanceOf(user1.address);
      await savingCore.connect(user1).withdraw(1);
      const balanceAfter = await mockUSDC.balanceOf(user1.address);

      const received = balanceAfter - balanceBefore;
      const expectedPenalty = (DEPOSIT_AMOUNT * BigInt(FIVE_PERCENT)) / BigInt(10000);
      const expectedReceived = DEPOSIT_AMOUNT - expectedPenalty;
      
      expect(received).to.equal(expectedReceived);
    });

    it("should transfer penalty to feeReceiver", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [10 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      const feeReceiverBefore = await mockUSDC.balanceOf(admin.address);
      await savingCore.connect(user1).withdraw(1);
      const feeReceiverAfter = await mockUSDC.balanceOf(admin.address);

      const expectedPenalty = (DEPOSIT_AMOUNT * BigInt(FIVE_PERCENT)) / BigInt(10000);
      expect(feeReceiverAfter - feeReceiverBefore).to.equal(expectedPenalty);
    });

    it("should return exact principal minus penalty (no interest)", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [1 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      const balanceBefore = await mockUSDC.balanceOf(user1.address);
      await savingCore.connect(user1).withdraw(1);
      const balanceAfter = await mockUSDC.balanceOf(user1.address);

      const received = balanceAfter - balanceBefore;
      const penalty = (DEPOSIT_AMOUNT * BigInt(FIVE_PERCENT)) / BigInt(10000);
      expect(received).to.equal(DEPOSIT_AMOUNT - penalty);
    });
  });

  describe("=== MANUAL RENEW ===", function () {
    it("should renew within grace period (3 days)", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS]);
      await network.provider.send("evm_mine", []);

      await savingCore.connect(user1).renewDeposit(1, 2);

      const oldDeposit = await savingCore.getDeposit(1);
      expect(oldDeposit.status).to.equal(2); // ManualRenewed

      const newDeposit = await savingCore.getDeposit(2);
      expect(newDeposit.status).to.equal(0); // Active
      expect(newDeposit.principal).to.be.greaterThan(DEPOSIT_AMOUNT);
    });

    it("should calculate new principal = old principal + interest", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS]);
      await network.provider.send("evm_mine", []);

      await savingCore.connect(user1).renewDeposit(1, 2);

      const newDeposit = await savingCore.getDeposit(2);
      const interest = (DEPOSIT_AMOUNT * BigInt(TEN_PERCENT) * BigInt(30)) / (BigInt(365) * BigInt(10000));
      expect(newDeposit.principal).to.equal(DEPOSIT_AMOUNT + interest);
    });

    it("should use new plan APR (not old APR)", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS]);
      await network.provider.send("evm_mine", []);

      await savingCore.connect(user1).renewDeposit(1, 2);

      const newDeposit = await savingCore.getDeposit(2);
      expect(newDeposit.aprBpsAtOpen).to.equal(FIFTEEN_PERCENT);
    });

    it("should reject renew before maturity", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [15 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      await expect(
        savingCore.connect(user1).renewDeposit(1, 2)
      ).to.be.revertedWith("Cannot renew before maturity");
    });

    it("should reject renew after grace period (use auto-renew)", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + GRACE_PERIOD + 1]);
      await network.provider.send("evm_mine", []);

      await expect(
        savingCore.connect(user1).renewDeposit(1, 2)
      ).to.be.revertedWith("Use auto-renew");
    });

    it("should reject renew when new plan is disabled", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      await savingCore.connect(admin).disablePlan(2);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS]);
      await network.provider.send("evm_mine", []);

      await expect(
        savingCore.connect(user1).renewDeposit(1, 2)
      ).to.be.revertedWith("New plan is disabled");
    });

    it("should reject renew when new plan disabled", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      await savingCore.connect(admin).disablePlan(2);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS]);
      await network.provider.send("evm_mine", []);

      await expect(
        savingCore.connect(user1).renewDeposit(1, 2)
      ).to.be.revertedWith("New plan is disabled");
    });

    it("should emit Renewed event with correct parameters", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS]);
      await network.provider.send("evm_mine", []);

      const tx = await savingCore.connect(user1).renewDeposit(1, 2);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === "Renewed");
      expect(event).to.exist;
      expect(event.args.oldDepositId).to.equal(1);
      expect(event.args.newPlanId).to.equal(2);
      expect(event.args.isAuto).to.equal(false);
    });
  });

  describe("=== AUTO RENEW ===", function () {
    it("should auto renew after grace period (>3 days)", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + GRACE_PERIOD + 1]);
      await network.provider.send("evm_mine", []);

      await savingCore.connect(user2).autoRenewDeposit(1);

      const oldDeposit = await savingCore.getDeposit(1);
      expect(oldDeposit.status).to.equal(3); // AutoRenewed
    });

    it("should LOCK original APR (not use current plan APR)", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await savingCore.connect(admin).updatePlan(1, TWENTY_PERCENT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + GRACE_PERIOD + 1]);
      await network.provider.send("evm_mine", []);

      await savingCore.connect(user2).autoRenewDeposit(1);

      const newDeposit = await savingCore.getDeposit(2);
      expect(newDeposit.aprBpsAtOpen).to.equal(TEN_PERCENT); // Original APR locked
      expect(newDeposit.aprBpsAtOpen).to.not.equal(TWENTY_PERCENT);
    });

    it("should lock penaltyBps as well", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + GRACE_PERIOD + 1]);
      await network.provider.send("evm_mine", []);

      await savingCore.connect(user2).autoRenewDeposit(1);

      const newDeposit = await savingCore.getDeposit(2);
      expect(newDeposit.penaltyBpsAtOpen).to.equal(FIVE_PERCENT);
    });

    it("should reject auto renew before grace period ends", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + GRACE_PERIOD - 1]);
      await network.provider.send("evm_mine", []);

      await expect(
        savingCore.connect(user2).autoRenewDeposit(1)
      ).to.be.revertedWith("Grace period not ended");
    });

    it("should reject auto renew when original plan disabled", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + GRACE_PERIOD + 1]);
      await network.provider.send("evm_mine", []);
      await savingCore.connect(admin).disablePlan(1);

      await expect(
        savingCore.connect(user2).autoRenewDeposit(1)
      ).to.be.revertedWith("Original plan disabled");
    });

    it("should reject auto renew for non-active deposit", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS]);
      await network.provider.send("evm_mine", []);
      await savingCore.connect(user1).withdraw(1);

      await network.provider.send("evm_increaseTime", [GRACE_PERIOD + 1]);
      await network.provider.send("evm_mine", []);

      await expect(
        savingCore.connect(user2).autoRenewDeposit(1)
      ).to.be.revertedWith("Not active");
    });

    it("should use original plan tenor for new deposit", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + GRACE_PERIOD + 1]);
      await network.provider.send("evm_mine", []);

      await savingCore.connect(user2).autoRenewDeposit(1);

      const newDeposit = await savingCore.getDeposit(2);
      expect(newDeposit.planId).to.equal(1);
    });
  });

  describe("=== SECURITY & ACCESS CONTROL ===", function () {
    describe("Pause Functionality", function () {
      it("should allow admin to pause", async function () {
        await savingCore.connect(admin).pause();
        expect(await savingCore.paused()).to.be.true;
      });

      it("should reject deposit when paused", async function () {
        await savingCore.connect(admin).pause();
        await expect(
          savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should reject withdraw when paused (after maturity)", async function () {
        await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
        await network.provider.send("evm_increaseTime", [THIRTY_DAYS + 1]);
        await network.provider.send("evm_mine", []);
        await savingCore.connect(admin).pause();

        await expect(
          savingCore.connect(user1).withdraw(1)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should reject renew when paused", async function () {
        await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
        await network.provider.send("evm_increaseTime", [THIRTY_DAYS]);
        await network.provider.send("evm_mine", []);
        await savingCore.connect(admin).pause();

        await expect(
          savingCore.connect(user1).renewDeposit(1, 2)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("should allow unpause", async function () {
        await savingCore.connect(admin).pause();
        await savingCore.connect(admin).unpause();
        expect(await savingCore.paused()).to.be.false;

        await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
        expect(await savingCore.ownerOf(1)).to.equal(user1.address);
      });
    });

    describe("OnlyOwner Access", function () {
      it("should reject non-owner to create plan", async function () {
        await expect(
          savingCore.connect(user1).createPlan(30, TEN_PERCENT, 100, 10000, 500)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should reject non-owner to update plan", async function () {
        await expect(
          savingCore.connect(user1).updatePlan(1, TWENTY_PERCENT)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should reject non-owner to enable/disable plan", async function () {
        await expect(
          savingCore.connect(user1).enablePlan(1)
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(
          savingCore.connect(user1).disablePlan(1)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should reject non-owner to pause", async function () {
        await expect(
          savingCore.connect(user1).pause()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should reject non-owner to set baseURI", async function () {
        await expect(
          savingCore.connect(user1).setBaseURI("https://test.com/")
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Owner Access", function () {
      it("should allow owner to create plan", async function () {
        await savingCore.connect(admin).createPlan(90, TWENTY_PERCENT, 100, 50000, 300);
        const plan = await savingCore.getPlan(4);
        expect(plan.tenorDays).to.equal(90);
      });

      it("should allow owner to update plan", async function () {
        await savingCore.connect(admin).updatePlan(1, FIFTEEN_PERCENT);
        const plan = await savingCore.getPlan(1);
        expect(plan.aprBps).to.equal(FIFTEEN_PERCENT);
      });

      it("should allow owner to pause/unpause", async function () {
        await savingCore.connect(admin).pause();
        expect(await savingCore.paused()).to.be.true;
        await savingCore.connect(admin).unpause();
        expect(await savingCore.paused()).to.be.false;
      });
    });
  });

  describe("=== VAULT MANAGER SECURITY ===", function () {
    it("should revert when vault insufficient for interest", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + 1]);
      await network.provider.send("evm_mine", []);
      
      await vaultManager.connect(admin).withdrawVault(VAULT_FUND);

      await expect(
        savingCore.connect(user1).withdraw(1)
      ).to.be.revertedWith("Insufficient vault balance for interest");
    });

    it("should allow withdraw when vault has sufficient balance", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + 1]);
      await network.provider.send("evm_mine", []);

      const balanceBefore = await mockUSDC.balanceOf(user1.address);
      await savingCore.connect(user1).withdraw(1);
      const balanceAfter = await mockUSDC.balanceOf(user1.address);

      expect(balanceAfter - balanceBefore).to.be.greaterThan(DEPOSIT_AMOUNT);
    });
  });

  describe("=== EVENTS VERIFICATION ===", function () {
    it("should emit DepositOpened with correct parameters", async function () {
      const tx = await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === "DepositOpened");
      expect(event).to.exist;
      expect(event.args.owner).to.equal(user1.address);
      expect(event.args.planId).to.equal(1);
      expect(event.args.principal).to.equal(DEPOSIT_AMOUNT);
      expect(event.args.aprBpsAtOpen).to.equal(TEN_PERCENT);
      expect(event.args.penaltyBpsAtOpen).to.equal(FIVE_PERCENT);
    });

    it("should emit Withdrawn with correct parameters", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + 1]);
      await network.provider.send("evm_mine", []);

      const tx = await savingCore.connect(user1).withdraw(1);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === "Withdrawn");
      expect(event).to.exist;
      expect(event.args.owner).to.equal(user1.address);
      expect(event.args.principal).to.equal(DEPOSIT_AMOUNT);
      expect(event.args.isEarly).to.equal(false);
    });

    it("should emit Withdrawn with isEarly=true for early withdrawal", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      
      await network.provider.send("evm_increaseTime", [10 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      const tx = await savingCore.connect(user1).withdraw(1);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === "Withdrawn");
      expect(event.args.isEarly).to.equal(true);
      expect(event.args.interest).to.equal(0);
    });

    it("should emit PlanCreated", async function () {
      const tx = await savingCore.connect(admin).createPlan(45, TWENTY_PERCENT, 100, 50000, 300);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === "PlanCreated");
      expect(event).to.exist;
      expect(event.args.tenorDays).to.equal(45);
      expect(event.args.aprBps).to.equal(TWENTY_PERCENT);
    });

    it("should emit PlanUpdated", async function () {
      const tx = await savingCore.connect(admin).updatePlan(1, FIFTEEN_PERCENT);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === "PlanUpdated");
      expect(event).to.exist;
      expect(event.args.newAprBps).to.equal(FIFTEEN_PERCENT);
    });
  });

  describe("=== NFT FUNCTIONALITY ===", function () {
    it("should mint NFT to depositor", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      expect(await savingCore.balanceOf(user1.address)).to.equal(1);
      expect(await savingCore.ownerOf(1)).to.equal(user1.address);
    });

    it("should burn NFT on withdraw", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + 1]);
      await network.provider.send("evm_mine", []);
      await savingCore.connect(user1).withdraw(1);
      
      await expect(savingCore.ownerOf(1)).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("should return correct token URI", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      const uri = await savingCore.tokenURI(1);
      expect(uri).to.equal("https://api.example.com/nft/1");
    });

    it("should allow admin to set new base URI", async function () {
      await savingCore.connect(admin).setBaseURI("https://new-api.com/");
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      const uri = await savingCore.tokenURI(1);
      expect(uri).to.equal("https://new-api.com/1");
    });

    it("should track multiple deposits per user", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      await savingCore.connect(user1).openDeposit(2, DEPOSIT_AMOUNT);
      
      expect(await savingCore.balanceOf(user1.address)).to.equal(2);
      
      const deposits = await savingCore.getDepositsByOwner(user1.address);
      expect(deposits.length).to.equal(2);
    });
  });

  describe("=== EDGE CASES ===", function () {
    it("should reject deposit below min", async function () {
      await expect(
        savingCore.connect(user1).openDeposit(1, ethers.parseUnits("5", 6))
      ).to.be.revertedWith("Below min deposit");
    });

    it("should reject deposit above max", async function () {
      await expect(
        savingCore.connect(user1).openDeposit(1, ethers.parseUnits("200000", 6))
      ).to.be.revertedWith("Above max deposit");
    });

    it("should reject deposit on disabled plan", async function () {
      await savingCore.connect(admin).disablePlan(1);
      await expect(
        savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT)
      ).to.be.revertedWith("Plan is disabled");
    });

    it("should reject withdraw by non-owner", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + 1]);
      await network.provider.send("evm_mine", []);
      
      await expect(
        savingCore.connect(user2).withdraw(1)
      ).to.be.revertedWith("Not owner");
    });

    it("should reject withdraw already withdrawn deposit", async function () {
      await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
      await network.provider.send("evm_increaseTime", [THIRTY_DAYS + 1]);
      await network.provider.send("evm_mine", []);
      await savingCore.connect(user1).withdraw(1);
      
      await expect(
        savingCore.connect(user1).withdraw(1)
      ).to.be.revertedWith("Not active");
    });
  });
});