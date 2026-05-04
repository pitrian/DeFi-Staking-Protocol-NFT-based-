import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import Layout from './components/Layout';
import AdminView from './components/AdminView';
import UserView from './components/UserView';
import { useContractData, CONTRACT_ADDRESSES, formatUSDC } from './hooks/useContractData';

const MockUSDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function faucet()"
];

const SavingCore_ABI = [
  "function createPlan(uint256 tenorDays, uint256 aprBps, uint256 minDeposit, uint256 maxDeposit, uint256 penaltyBps) returns (uint256)",
  "function updatePlan(uint256 planId, uint256 newAprBps)",
  "function enablePlan(uint256 planId)",
  "function disablePlan(uint256 planId)",
  "function getPlan(uint256 planId) view returns (tuple(uint256 tenorDays, uint256 aprBps, uint256 minDeposit, uint256 maxDeposit, uint256 penaltyBps, bool enabled))",
  "function openDeposit(uint256 planId, uint256 amount)",
  "function withdraw(uint256 depositId)",
  "function renewDeposit(uint256 depositId, uint256 newPlanId)",
  "function autoRenewDeposit(uint256 depositId)",
  "function getDepositsByOwner(address owner) view returns (uint256[])",
  "function getDeposit(uint256 depositId) view returns (tuple(address owner, uint256 principal, uint256 planId, uint256 aprBpsAtOpen, uint256 penaltyBpsAtOpen, uint256 startAt, uint256 maturityAt, uint8 status))",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)"
];

const VaultManager_ABI = [
  "function availableBalance() view returns (uint256)",
  "function fundVault(uint256 amount)",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)"
];

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [savingCore, setSavingCore] = useState(null);
  const [mockUSDC, setMockUSDC] = useState(null);
  const [vaultManager, setVaultManager] = useState(null);
  
  const [userDeposits, setUserDeposits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });

  const {
    loading: contractLoading,
    error: contractError,
    isAdmin,
    globalStats,
    plans,
    allPlans,
    isPaused,
    fetchUserDeposits,
    setupEventListeners,
    refetch
  } = useContractData(provider, account);

  useEffect(() => {
    if (window.ethereum) {
      const newProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(newProvider);
    }
  }, []);

  useEffect(() => {
    if (provider && account) {
      const cleanup = setupEventListeners();
      loadUserData();
      return cleanup;
    }
  }, [provider, account, setupEventListeners]);

  const loadUserData = async () => {
    if (!provider || !account) return;
    const deposits = await fetchUserDeposits(account);
    setUserDeposits(deposits);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: '', message: '' }), 5000);
  };

  const connectWallet = async () => {
    try {
      if (!provider) {
        const newProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(newProvider);
      }
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);

      const signer = await provider.getSigner();
      const savingCoreWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.savingCore, SavingCore_ABI, signer);
      const mockUSDCWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.mockUSDC, MockUSDC_ABI, signer);
      const vaultManagerWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.vaultManager, VaultManager_ABI, signer);

      setSavingCore(savingCoreWithSigner);
      setMockUSDC(mockUSDCWithSigner);
      setVaultManager(vaultManagerWithSigner);

      loadUserData();
    } catch (err) {
      showNotification("Failed to connect wallet: " + err.message, 'error');
    }
  };

  const handleLogout = () => {
    setAccount(null);
    setSavingCore(null);
    setMockUSDC(null);
    setVaultManager(null);
    setUserDeposits([]);
    showNotification("Wallet disconnected", 'success');
  };

  const handleDeposit = async (selectedPlan, amount) => {
    if (!selectedPlan || !amount) return false;
    setLoading(true);
    try {
      const amountWei = ethers.parseUnits(amount, 6);
      const signer = await provider.getSigner();
      const usdcWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.mockUSDC, MockUSDC_ABI, signer);
      const coreWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.savingCore, SavingCore_ABI, signer);

      const allowance = await usdcWithSigner.allowance(account, CONTRACT_ADDRESSES.savingCore);
      if (allowance < amountWei) {
        const approveTx = await usdcWithSigner.approve(CONTRACT_ADDRESSES.savingCore, ethers.MaxUint256);
        await approveTx.wait();
      }

      const tx = await coreWithSigner.openDeposit(selectedPlan.id, amountWei);
      await tx.wait();

      showNotification(`Successfully deposited ${amount} USDC!`);
      await loadUserData();
      refetch();
      return true;
    } catch (err) {
      showNotification("Deposit failed: " + (err.reason || err.message), 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (depositId) => {
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const coreWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.savingCore, SavingCore_ABI, signer);
      const tx = await coreWithSigner.withdraw(depositId);
      await tx.wait();
      showNotification("Withdrawal successful!");
      await loadUserData();
      refetch();
    } catch (err) {
      showNotification("Withdraw failed: " + (err.reason || err.message), 'error');
    }
    setLoading(false);
  };

  const handleCreatePlan = async (newPlan) => {
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const savingCoreWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.savingCore, SavingCore_ABI, signer);
      const tx = await savingCoreWithSigner.createPlan(
        newPlan.tenorDays,
        newPlan.aprBps,
        ethers.parseUnits(String(newPlan.minDeposit), 6),
        ethers.parseUnits(String(newPlan.maxDeposit), 6),
        newPlan.penaltyBps
      );
      await tx.wait();
      showNotification("Plan created successfully!");
      refetch();
    } catch (err) {
      showNotification("Create plan failed: " + (err.reason || err.message), 'error');
    }
    setLoading(false);
  };

  const handleTogglePlan = async (planId, enabled) => {
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const savingCoreWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.savingCore, SavingCore_ABI, signer);
      const tx = enabled
        ? await savingCoreWithSigner.disablePlan(planId)
        : await savingCoreWithSigner.enablePlan(planId);
      await tx.wait();
      showNotification(`Plan ${enabled ? 'disabled' : 'enabled'}!`);
      refetch();
    } catch (err) {
      showNotification("Operation failed: " + (err.reason || err.message), 'error');
    }
    setLoading(false);
  };

  const handleFundVault = async (amount) => {
    if (!amount) return;
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const amountWei = ethers.parseUnits(amount, 6);
      const usdcWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.mockUSDC, MockUSDC_ABI, signer);
      const vaultWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.vaultManager, VaultManager_ABI, signer);

      const allowance = await usdcWithSigner.allowance(account, CONTRACT_ADDRESSES.vaultManager);
      if (allowance < amountWei) {
        const approveTx = await usdcWithSigner.approve(CONTRACT_ADDRESSES.vaultManager, ethers.MaxUint256);
        await approveTx.wait();
      }

      const tx = await vaultWithSigner.fundVault(amountWei);
      await tx.wait();
      showNotification(`Funded ${amount} USDC to vault!`);
      refetch();
    } catch (err) {
      showNotification("Fund vault failed: " + (err.reason || err.message), 'error');
    }
    setLoading(false);
  };

  const handleTogglePause = async () => {
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const savingCoreWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.savingCore, SavingCore_ABI, signer);
      const tx = isPaused ? await savingCoreWithSigner.unpause() : await savingCoreWithSigner.pause();
      await tx.wait();
      showNotification(isPaused ? "System unpaused!" : "System paused!");
      refetch();
    } catch (err) {
      showNotification("Operation failed: " + (err.reason || err.message), 'error');
    }
    setLoading(false);
  };

  return (
    <Layout
      account={account}
      isAdmin={isAdmin}
      onConnect={connectWallet}
      onLogout={handleLogout}
      networkName="Localhost"
      error={contractError}
      loading={contractLoading}
    >
      {notification.message && (
        <div className={`fixed top-24 right-4 z-50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 ${
          notification.type === 'error'
            ? 'bg-red-500/90 text-white border border-red-400/30'
            : 'bg-emerald-500/90 text-white border border-emerald-400/30'
        }`}>
          {notification.type === 'error' ? <span className="text-lg">⚠️</span> : <span className="text-lg">✅</span>}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {!account ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <p className="text-slate-400 text-lg">Connect your wallet to continue</p>
          </div>
        </div>
      ) : contractLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading contract data...</p>
          </div>
        </div>
      ) : contractError ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center bg-red-500/10 border border-red-500/30 rounded-2xl p-8">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-red-400 text-lg mb-2">Connection Error</p>
            <p className="text-slate-400 text-sm">{contractError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg"
            >
              Retry
            </button>
          </div>
        </div>
      ) : isAdmin ? (
        <AdminView
          allPlans={allPlans}
          vaultBalance={globalStats.vaultBalance}
          totalDeposits={globalStats.totalDeposits}
          totalNFTs={globalStats.totalPlans}
          adminFees={globalStats.adminFees}
          activeDepositsCount={globalStats.activeDepositsCount}
          isPaused={isPaused}
          loading={loading}
          onCreatePlan={handleCreatePlan}
          onTogglePlan={handleTogglePlan}
          onFundVault={handleFundVault}
          onTogglePause={handleTogglePause}
          formatUSDC={formatUSDC}
        />
      ) : (
        <UserView
          plans={plans}
          userDeposits={userDeposits}
          loading={loading}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          onMintUSDC={async (addr) => {
            setLoading(true);
            try {
              const signer = await provider.getSigner();
              const usdcWithSigner = new ethers.Contract(CONTRACT_ADDRESSES.mockUSDC, MockUSDC_ABI, signer);
              const tx = await usdcWithSigner.faucet();
              await tx.wait();
              showNotification("Received 1000 USDC!");
              return true;
            } catch (err) {
              showNotification("Faucet failed: " + (err.reason || err.message), 'error');
              return false;
            } finally {
              setLoading(false);
            }
          }}
          account={account}
          formatUSDC={formatUSDC}
        />
      )}
    </Layout>
  );
}

export default App;