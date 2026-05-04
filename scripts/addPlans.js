const hre = require("hardhat");

const SAVING_CORE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const ADMIN_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const PLANS = [
  { tenorDays: 30, aprBps: 500, minDeposit: 10, maxDeposit: 100000, penaltyBps: 500 },   // 5% APR
  { tenorDays: 90, aprBps: 1000, minDeposit: 10, maxDeposit: 100000, penaltyBps: 500 },  // 10% APR
  { tenorDays: 365, aprBps: 2000, minDeposit: 10, maxDeposit: 100000, penaltyBps: 300 }   // 20% APR
];

async function main() {
  console.log("Adding plans to SavingCore...");

  const [deployer] = await hre.ethers.getSigners();
  const SavingCore = await hre.ethers.getContractFactory("SavingCore");
  const savingCore = SavingCore.attach(SAVING_CORE_ADDRESS);

  console.log("Connected as:", deployer.address);

  for (const plan of PLANS) {
    console.log(`\nCreating plan: ${plan.tenorDays} days, ${plan.aprBps / 100}% APR`);
    const tx = await savingCore.createPlan(
      plan.tenorDays,
      plan.aprBps,
      hre.ethers.parseUnits(String(plan.minDeposit), 6),
      hre.ethers.parseUnits(String(plan.maxDeposit), 6),
      plan.penaltyBps
    );
    const receipt = await tx.wait();

    const event = receipt.logs.find(l => l.fragment && l.fragment.name === "PlanCreated");
    if (event) {
      console.log(`✅ Plan created with ID: ${event.args.planId}`);
    }
  }

  console.log("\n=== Verifying all plans ===");

  for (let i = 1; i <= 3; i++) {
    const plan = await savingCore.getPlan(i);
    console.log(`Plan ${i}: ${plan.tenorDays} days, APR: ${Number(plan.aprBps) / 100}%, Min: ${hre.ethers.formatUnits(plan.minDeposit, 6)}, Max: ${hre.ethers.formatUnits(plan.maxDeposit, 6)}, Enabled: ${plan.enabled}`);
  }

  console.log("\n✅ All plans added successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });