const hre = require("hardhat");

async function main() {
  const [deployer, admin, user1] = await hre.ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);

  console.log("\n1. Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("MockUSDC deployed to:", mockUSDCAddress);

  console.log("\n2. Deploying VaultManager...");
  const VaultManager = await hre.ethers.getContractFactory("VaultManager");
  const vaultManager = await VaultManager.deploy(
    mockUSDCAddress,
    admin.address,
    admin.address
  );
  await vaultManager.waitForDeployment();
  const vaultManagerAddress = await vaultManager.getAddress();
  console.log("VaultManager deployed to:", vaultManagerAddress);

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
  console.log("SavingCore deployed to:", savingCoreAddress);

  console.log("\n4. Setting up roles...");
  await vaultManager.connect(admin).grantVaultManagerRole(savingCoreAddress);
  console.log("Granted VAULT_MANAGER_ROLE to SavingCore");

  console.log("\n5. Funding vault for interest payments...");
  const MINT_AMOUNT = hre.ethers.parseUnits("100000", 6);
  await mockUSDC.mint(admin.address, MINT_AMOUNT);
  await mockUSDC.connect(admin).approve(vaultManagerAddress, MINT_AMOUNT);
  await vaultManager.connect(admin).fundVault(hre.ethers.parseUnits("50000", 6));
  console.log("Admin funded 50,000 USDC to vault");

  const vaultBalance = await vaultManager.availableBalance();
  console.log("Vault available balance:", hre.ethers.formatUnits(vaultBalance, 6));

  console.log("\n=== Deployment Successful ===");

  return {
    mockUSDC: mockUSDCAddress,
    vaultManager: vaultManagerAddress,
    savingCore: savingCoreAddress,
    admin: admin.address
  };
}

main()
  .then((addresses) => {
    console.log("\n📋 Contract Addresses for frontend:");
    console.log(JSON.stringify(addresses, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });