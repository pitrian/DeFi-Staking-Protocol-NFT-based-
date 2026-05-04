import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESSES = {
  mockUSDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  vaultManager: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  savingCore: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
};

const ADMIN_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const VaultManager_ABI = [
  "function availableBalance() view returns (uint256)",
  "function totalInterestWithdrawn() view returns (uint256)",
  "function feeReceiver() view returns (address)"
];

const SavingCore_ABI = [
  "function nextPlanId() view returns (uint256)",
  "function nextDepositId() view returns (uint256)",
  "function getPlan(uint256 planId) view returns (tuple(uint256 tenorDays, uint256 aprBps, uint256 minDeposit, uint256 maxDeposit, uint256 penaltyBps, bool enabled))",
  "function paused() view returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
];

const USDC_DECIMALS = 6;

const formatUSDC = (value) => {
  if (!value || value === '0') return '0.00';
  try {
    return ethers.formatUnits(value, USDC_DECIMALS);
  } catch {
    return '0.00';
  }
};

export const useContractData = (provider, account) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [globalStats, setGlobalStats] = useState({
    vaultBalance: '0',
    totalDeposits: '0',
    activeDepositsCount: 0,
    adminFees: '0',
    totalPlans: 0
  });

  const [plans, setPlans] = useState([]);
  const [allPlans, setAllPlans] = useState([]);
  const [isPaused, setIsPaused] = useState(false);

  const fetchGlobalStats = useCallback(async () => {
    if (!provider) return;

    try {
      const vaultManager = new ethers.Contract(
        CONTRACT_ADDRESSES.vaultManager,
        VaultManager_ABI,
        provider
      );

      const savingCore = new ethers.Contract(
        CONTRACT_ADDRESSES.savingCore,
        SavingCore_ABI,
        provider
      );

      const [vaultBalance, totalInterestWithdrawn, nextDepositId, nextPlanId, paused] = await Promise.all([
        vaultManager.availableBalance(),
        vaultManager.totalInterestWithdrawn(),
        savingCore.nextDepositId(),
        savingCore.nextPlanId(),
        savingCore.paused()
      ]);

      const activeDeposits = Number(nextDepositId) - 1;

      const loadedPlans = [];
      const loadedAllPlans = [];
      for (let i = 1; i < Number(nextPlanId); i++) {
        const plan = await savingCore.getPlan(i);
        loadedAllPlans.push({ id: i, ...plan });
        if (plan.enabled) loadedPlans.push({ id: i, ...plan });
      }

      setGlobalStats({
        vaultBalance: formatUSDC(vaultBalance),
        totalDeposits: formatUSDC(vaultBalance),
        activeDepositsCount: activeDeposits,
        adminFees: formatUSDC(totalInterestWithdrawn),
        totalPlans: Number(nextPlanId) - 1
      });

      setPlans(loadedPlans);
      setAllPlans(loadedAllPlans);
      setIsPaused(paused);
      setError(null);
    } catch (err) {
      console.error("Error fetching global stats:", err);
      setError(err.message || "Failed to fetch contract data");
    }
  }, [provider]);

  const fetchUserDeposits = useCallback(async (owner) => {
    if (!provider || !owner) return [];

    try {
      const savingCore = new ethers.Contract(
        CONTRACT_ADDRESSES.savingCore,
        ["function getDepositsByOwner(address owner) view returns (uint256[])", 
         "function getDeposit(uint256 depositId) view returns (tuple(address owner, uint256 principal, uint256 planId, uint256 aprBpsAtOpen, uint256 penaltyBpsAtOpen, uint256 startAt, uint256 maturityAt, uint8 status))"],
        provider
      );

      const depositIds = await savingCore.getDepositsByOwner(owner);
      const deposits = [];
      
      for (const id of depositIds) {
        const deposit = await savingCore.getDeposit(id);
        if (deposit.status === 0) {
          deposits.push({
            id,
            ...deposit,
            principal: formatUSDC(deposit.principal),
            maturityAt: Number(deposit.maturityAt)
          });
        }
      }
      
      return deposits;
    } catch (err) {
      console.error("Error fetching user deposits:", err);
      return [];
    }
  }, [provider]);

  useEffect(() => {
    if (account) {
      setIsAdmin(account.toLowerCase() === ADMIN_ADDRESS.toLowerCase());
    } else {
      setIsAdmin(false);
    }
  }, [account]);

  useEffect(() => {
    if (provider) {
      setLoading(true);
      fetchGlobalStats().finally(() => setLoading(false));

      const intervalId = setInterval(() => {
        fetchGlobalStats();
      }, 30000);

      return () => clearInterval(intervalId);
    }
  }, [provider, fetchGlobalStats]);

  const setupEventListeners = useCallback(() => {
    if (!provider) return () => {};

    const savingCore = new ethers.Contract(
      CONTRACT_ADDRESSES.savingCore,
      ["event DepositOpened(uint256 indexed depositId, address indexed owner, uint256 planId, uint256 principal, uint256 maturityAt, uint256 aprBpsAtOpen, uint256 penaltyBpsAtOpen)",
       "event Withdrawn(uint256 indexed depositId, address indexed owner, uint256 principal, uint256 interest, bool isEarly)",
       "event Renewed(uint256 indexed oldDepositId, uint256 indexed newDepositId, uint256 newPrincipal, uint256 newPlanId, bool isAuto)",
       "event PlanCreated(uint256 indexed planId, uint256 tenorDays, uint256 aprBps)",
       "event PlanUpdated(uint256 indexed planId, uint256 newAprBps)",
       "event PlanEnabled(uint256 indexed planId)",
       "event PlanDisabled(uint256 indexed planId)"],
      provider
    );

    const onDepositOpened = () => {
      console.log("DepositOpened event detected, refreshing data...");
      fetchGlobalStats();
    };

    const onWithdrawn = () => {
      console.log("Withdrawn event detected, refreshing data...");
      fetchGlobalStats();
    };

    const onRenewed = () => {
      console.log("Renewed event detected, refreshing data...");
      fetchGlobalStats();
    };

    const onPlanCreated = () => {
      console.log("PlanCreated event detected, refreshing data...");
      fetchGlobalStats();
    };

    const onPlanUpdated = () => {
      console.log("PlanUpdated event detected, refreshing data...");
      fetchGlobalStats();
    };

    const onPlanStatusChanged = () => {
      console.log("Plan status changed, refreshing data...");
      fetchGlobalStats();
    };

    savingCore.on("DepositOpened", onDepositOpened);
    savingCore.on("Withdrawn", onWithdrawn);
    savingCore.on("Renewed", onRenewed);
    savingCore.on("PlanCreated", onPlanCreated);
    savingCore.on("PlanUpdated", onPlanUpdated);
    savingCore.on("PlanEnabled", onPlanStatusChanged);
    savingCore.on("PlanDisabled", onPlanStatusChanged);

    return () => {
      savingCore.off("DepositOpened", onDepositOpened);
      savingCore.off("Withdrawn", onWithdrawn);
      savingCore.off("Renewed", onRenewed);
      savingCore.off("PlanCreated", onPlanCreated);
      savingCore.off("PlanUpdated", onPlanUpdated);
      savingCore.off("PlanEnabled", onPlanStatusChanged);
      savingCore.off("PlanDisabled", onPlanStatusChanged);
    };
  }, [provider, fetchGlobalStats]);

  const refetch = useCallback(() => {
    fetchGlobalStats();
  }, [fetchGlobalStats]);

  return {
    loading,
    error,
    isAdmin,
    globalStats,
    plans,
    allPlans,
    isPaused,
    fetchUserDeposits,
    setupEventListeners,
    refetch,
    formatUSDC
  };
};

export { CONTRACT_ADDRESSES, ADMIN_ADDRESS, formatUSDC };