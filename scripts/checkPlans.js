const hre = require("hardhat");

const SAVING_CORE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

async function main() {
  const SavingCore = await hre.ethers.getContractFactory("SavingCore");
  const savingCore = SavingCore.attach(SAVING_CORE_ADDRESS);

  console.log("Checking plans...");

  try {
    const plan1 = await savingCore.getPlan(1);
    console.log("Plan 1 exists:", plan1.tenorDays > 0);
    if (plan1.tenorDays > 0) {
      console.log("  tenorDays:", plan1.tenorDays);
      console.log("  aprBps:", plan1.aprBps);
      console.log("  enabled:", plan1.enabled);
    }
  } catch (e) {
    console.log("Plan 1 error:", e.message);
  }

  try {
    const plan2 = await savingCore.getPlan(2);
    console.log("Plan 2 exists:", plan2.tenorDays > 0);
  } catch (e) {
    console.log("Plan 2 error:", e.message);
  }

  try {
    const plan3 = await savingCore.getPlan(3);
    console.log("Plan 3 exists:", plan3.tenorDays > 0);
  } catch (e) {
    console.log("Plan 3 error:", e.message);
  }
}

main().catch(console.error);