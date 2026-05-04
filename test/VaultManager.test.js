const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VaultManager", function () {
  let vaultManager, mockUSDC;
  let admin, user1, user2, savingCore;

  const MINT_AMOUNT = ethers.parseUnits("100000", 6);
  const FUND_AMOUNT = ethers.parseUnits("50000", 6);

  beforeEach(async function () {
    [admin, user1, user2, savingCore] = await ethers.getSigners();

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

    await mockUSDC.mint(admin.address, MINT_AMOUNT);
    await mockUSDC.connect(admin).approve(await vaultManager.getAddress(), MINT_AMOUNT);
  });

  describe("Deployment", function () {
    it("should set correct USDC address", async function () {
      expect(await vaultManager.usdc()).to.equal(await mockUSDC.getAddress());
    });

    it("should set fee receiver", async function () {
      expect(await vaultManager.feeReceiver()).to.equal(admin.address);
    });
  });

  describe("Fund Vault", function () {
    it("should allow admin to fund vault", async function () {
      await vaultManager.connect(admin).fundVault(FUND_AMOUNT);
      expect(await mockUSDC.balanceOf(await vaultManager.getAddress())).to.equal(FUND_AMOUNT);
    });

    it("should emit VaultFunded event", async function () {
      await expect(vaultManager.connect(admin).fundVault(FUND_AMOUNT))
        .to.emit(vaultManager, "VaultFunded")
        .withArgs(admin.address, FUND_AMOUNT);
    });

    it("should reject zero amount", async function () {
      await expect(vaultManager.connect(admin).fundVault(0))
        .to.be.revertedWith("Amount must be > 0");
    });

    it("should reject when paused", async function () {
      await vaultManager.connect(admin).pause();
      await expect(vaultManager.connect(admin).fundVault(FUND_AMOUNT))
        .to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Withdraw Vault", function () {
    beforeEach(async function () {
      await vaultManager.connect(admin).fundVault(FUND_AMOUNT);
    });

    it("should allow admin to withdraw from vault", async function () {
      const withdrawAmount = ethers.parseUnits("10000", 6);
      const adminBalanceBefore = await mockUSDC.balanceOf(admin.address);
      await vaultManager.connect(admin).withdrawVault(withdrawAmount);
      const adminBalanceAfter = await mockUSDC.balanceOf(admin.address);
      expect(adminBalanceAfter - adminBalanceBefore).to.equal(withdrawAmount);
    });

    it("should reject when insufficient available balance", async function () {
      await vaultManager.connect(admin).withdrawVault(FUND_AMOUNT);
      await expect(vaultManager.connect(admin).withdrawVault(FUND_AMOUNT))
        .to.be.revertedWith("Insufficient available balance");
    });

    it("should reject when paused", async function () {
      await vaultManager.connect(admin).pause();
      await expect(vaultManager.connect(admin).withdrawVault(FUND_AMOUNT))
        .to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Withdraw Interest", function () {
    beforeEach(async function () {
      await vaultManager.connect(admin).grantVaultManagerRole(savingCore.address);
      await vaultManager.connect(admin).fundVault(FUND_AMOUNT);
    });

    it("should allow vault manager to withdraw interest", async function () {
      const interestAmount = ethers.parseUnits("1000", 6);
      await vaultManager.connect(savingCore).withdrawInterest(interestAmount, user1.address);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(interestAmount);
    });

    it("should reject when not vault manager", async function () {
      await expect(
        vaultManager.connect(user1).withdrawInterest(1000, user1.address)
      ).to.be.reverted;
    });

    it("should reject when insufficient vault balance", async function () {
      const vaultAddress = await vaultManager.getAddress();
      const vaultBalance = await mockUSDC.balanceOf(vaultAddress);
      await expect(
        vaultManager.connect(savingCore).withdrawInterest(vaultBalance + 1n, user1.address)
      ).to.be.revertedWith("Insufficient vault balance for interest");
    });
  });

  describe("Available Balance", function () {
    it("should return correct available balance", async function () {
      await vaultManager.connect(admin).fundVault(FUND_AMOUNT);
      expect(await vaultManager.availableBalance()).to.equal(FUND_AMOUNT);
    });

    it("should account for withdrawn interest", async function () {
      await vaultManager.connect(admin).grantVaultManagerRole(savingCore.address);
      await vaultManager.connect(admin).fundVault(FUND_AMOUNT);
      await vaultManager.connect(savingCore).withdrawInterest(FUND_AMOUNT, admin.address);
      expect(await vaultManager.availableBalance()).to.equal(0);
    });
  });

  describe("Pause/Unpause", function () {
    it("should allow pauser to pause", async function () {
      await vaultManager.connect(admin).pause();
      expect(await vaultManager.paused()).to.be.true;
    });

    it("should allow pauser to unpause", async function () {
      await vaultManager.connect(admin).pause();
      await vaultManager.connect(admin).unpause();
      expect(await vaultManager.paused()).to.be.false;
    });
  });

  describe("Set Fee Receiver", function () {
    it("should allow admin to set fee receiver", async function () {
      await vaultManager.connect(admin).setFeeReceiver(user1.address);
      expect(await vaultManager.feeReceiver()).to.equal(user1.address);
    });

    it("should reject zero address", async function () {
      await expect(vaultManager.connect(admin).setFeeReceiver(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid fee receiver");
    });
  });
});