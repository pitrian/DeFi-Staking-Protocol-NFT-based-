const hre = require("hardhat");

const SAVING_CORE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const SavingCore_ABI = [
  "function getPlan(uint256 planId) view returns (tuple(uint256 tenorDays, uint256 aprBps, uint256 minDeposit, uint256 maxDeposit, uint256 penaltyBps, bool enabled))"
];

async function main() {
  const SavingCore = await hre.ethers.getContractFactory("SavingCore");
  const savingCore = SavingCore.attach(SAVING_CORE_ADDRESS).connect(hre.ethers.provider);

  console.log("=== Simulating Frontend Plan Fetch ===\n");

  for (let i = 1; i <= 3; i++) {
    const plan = await savingCore.getPlan(i);
    console.log(`Plan ${i}:`);
    console.log(`  Tenor: ${plan.tenorDays} days`);
    console.log(`  APR: ${Number(plan.aprBps) / 100}%`);
    console.log(`  Min Deposit: ${hre.ethers.formatUnits(plan.minDeposit, 6)} USDC`);
    console.log(`  Max Deposit: ${hre.ethers.formatUnits(plan.maxDeposit, 6)} USDC`);
    console.log(`  Penalty: ${Number(plan.penaltyBps) / 100}%`);
    console.log(`  Enabled: ${plan.enabled}`);
    console.log("");
  }

  console.log("✅ Frontend can fetch these plans correctly!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });