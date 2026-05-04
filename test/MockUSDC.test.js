const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockUSDC", function () {
  let mockUSDC;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      expect(await mockUSDC.name()).to.equal("Mock USDC");
      expect(await mockUSDC.symbol()).to.equal("MUSDC");
    });

    it("should have 6 decimals", async function () {
      expect(await mockUSDC.decimals()).to.equal(6);
    });
  });

  describe("Minting", function () {
    it("should allow owner to mint tokens", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(user1.address, amount);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(amount);
    });

    it("should reject minting from non-owner", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await expect(
        mockUSDC.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Burning", function () {
    it("should allow owner to burn tokens", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(user1.address, amount);
      await mockUSDC.burn(user1.address, amount);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(0);
    });

    it("should reject burning from non-owner", async function () {
      const amount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(user1.address, amount);
      await expect(
        mockUSDC.connect(user1).burn(user1.address, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});