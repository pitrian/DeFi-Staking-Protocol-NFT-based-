const hre = require("hardhat");

const PLANS = [
  { tenorDays: 30, aprBps: 500, minDeposit: 10, maxDeposit: 100000, penaltyBps: 500 },   // 5% APR
  { tenorDays: 90, aprBps: 1000, minDeposit: 10, maxDeposit: 100000, penaltyBps: 500 },  // 10% APR
  { tenorDays: 365, aprBps: 2000, minDeposit: 10, maxDeposit: 100000, penaltyBps: 300 }   // 20% APR
];

async function main() {
  const [deployer, admin] = await hre.ethers.getSigners();

  console.log("1. Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("   MockUSDC:", mockUSDCAddress);

  console.log("\n2. Deploying VaultManager...");
  const VaultManager = await hre.ethers.getContractFactory("VaultManager");
  const vaultManager = await VaultManager.deploy(mockUSDCAddress, admin.address, admin.address);
  await vaultManager.waitForDeployment();
  const vaultManagerAddress = await vaultManager.getAddress();
  console.log("   VaultManager:", vaultManagerAddress);

  console.log("\n3. Deploying SavingCore...");
  const SavingCore = await hre.ethers.getContractFactory("SavingCore");
  const savingCore = await SavingCore.deploy(
    vaultManagerAddress,
    mockUSDCAddress,
    "https://api.example.com/nft/",
    admin.address
  );
  await savingCore.waitForDeployment();
  const savingCoreAddress = await savingCore.getAddress();
  console.log("   SavingCore:", savingCoreAddress);

  console.log("\n4. Setting up roles...");
  await vaultManager.connect(admin).grantVaultManagerRole(savingCoreAddress);
  console.log("   VAULT_MANAGER_ROLE granted to SavingCore");

  console.log("\n5. Funding vault...");
  const MINT_AMOUNT = hre.ethers.parseUnits("100000", 6);
  const FUND_AMOUNT = hre.ethers.parseUnits("50000", 6);
  await mockUSDC.mint(admin.address, MINT_AMOUNT);
  await mockUSDC.connect(admin).approve(vaultManagerAddress, MINT_AMOUNT);
  await vaultManager.connect(admin).fundVault(FUND_AMOUNT);
  console.log("   Vault funded with 50,000 USDC");

  console.log("\n6. Creating Plans...");
  for (const plan of PLANS) {
    const tx = await savingCore.connect(admin).createPlan(
      plan.tenorDays,
      plan.aprBps,
      hre.ethers.parseUnits(String(plan.minDeposit), 6),
      hre.ethers.parseUnits(String(plan.maxDeposit), 6),
      plan.penaltyBps
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => l.fragment && l.fragment.name === "PlanCreated");
    console.log(`   ✅ Plan ${event.args.planId}: ${plan.tenorDays} days, ${plan.aprBps / 100}% APR`);
  }

  console.log("\n=== SUMMARY ===");
  console.log("MockUSDC:", mockUSDCAddress);
  console.log("VaultManager:", vaultManagerAddress);
  console.log("SavingCore:", savingCoreAddress);
  console.log("Admin:", admin.address);
  console.log("\n✅ Deployment and plans created successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });