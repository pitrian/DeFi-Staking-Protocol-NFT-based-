import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  Clock,
  Percent,
  ArrowRight,
  RefreshCw,
  DollarSign,
  Loader2,
  Sparkles,
  Calendar,
  TrendingUp,
  Coins
} from 'lucide-react';

export default function UserView({
  plans,
  userDeposits,
  loading,
  onDeposit,
  onWithdraw,
  onMintUSDC,
  account,
  formatUSDC
}) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleDeposit = async () => {
    const success = await onDeposit(selectedPlan, depositAmount);
    if (success) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedPlan(null);
        setDepositAmount('');
      }, 3000);
    }
  };

  const getDepositStatus = (deposit) => {
    const now = Date.now() / 1000;
    if (now < deposit.maturityAt) return { label: 'Active', color: 'from-blue-500 to-cyan-500', progress: ((now - deposit.startAt) / (deposit.maturityAt - deposit.startAt)) * 100 };
    if (now <= deposit.maturityAt + 3 * 24 * 60 * 60) return { label: 'Matured', color: 'from-amber-500 to-orange-500', progress: 100 };
    return { label: 'Overdue', color: 'from-red-500 to-rose-500', progress: 100 };
  };

  const getTimeRemaining = (maturityAt) => {
    const now = Date.now() / 1000;
    const diff = maturityAt - now;
    if (diff <= 0) return 'Ready to withdraw';
    const days = Math.floor(diff / (24 * 60 * 60));
    const hours = Math.floor((diff % (24 * 60 * 60)) / (60 * 60));
    return `${days}d ${hours}h remaining`;
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-3xl font-bold text-white">Available Plans</h2>
          <p className="text-indigo-300 mt-1">Choose a term to start earning interest</p>
        </div>
        <button
          onClick={() => onMintUSDC(account)}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-amber-500/25 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
          Get 1000 USDC Test
        </button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:border-indigo-500/50 transition-all hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-white">{plan.tenorDays}</span>
                  <span className="text-slate-400">days</span>
                </div>
                <span className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-full text-sm">
                  {(plan.aprBps / 100).toFixed(1)}% APY
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Min Deposit</span>
                  <span className="text-white font-medium">{formatUSDC(plan.minDeposit)} USDC</span>
                </div>
                {plan.maxDeposit > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Max Deposit</span>
                    <span className="text-white font-medium">{formatUSDC(plan.maxDeposit)} USDC</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Early Exit Fee</span>
                  <span className="text-amber-400 font-medium">{(plan.penaltyBps / 100).toFixed(1)}%</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedPlan(plan)}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-500/25"
              >
                Deposit Now
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/20 rounded-3xl p-8 max-w-md w-full"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white">Confirm Deposit</h3>
                <p className="text-slate-400 mt-1">{selectedPlan.tenorDays} Days @ {(selectedPlan.aprBps / 100).toFixed(1)}% APY</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Amount (USDC)</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-5 py-4 bg-black/30 border border-white/10 rounded-xl text-white text-xl font-semibold focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleDeposit}
                    disabled={loading || !depositAmount}
                    className="flex-1 py-4 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                    Confirm Deposit
                  </button>
                  <button
                    onClick={() => { setSelectedPlan(null); setDepositAmount(''); }}
                    className="px-6 py-4 border border-white/20 text-white font-medium rounded-xl hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-500/90 backdrop-blur-xl border border-emerald-400/30 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50"
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-semibold">Deposit successful! NFT minted.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-3xl font-bold text-white mb-6">My Deposits (NFTs)</h2>

        {userDeposits.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-3xl border border-white/10">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-10 h-10 text-slate-500" />
            </div>
            <p className="text-xl text-slate-300">No active deposits</p>
            <p className="text-slate-500 mt-2">Make your first deposit to earn interest</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userDeposits.map((deposit, index) => {
              const status = getDepositStatus(deposit);
              return (
                <motion.div
                  key={deposit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-3xl overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <span className="text-white font-bold text-lg">#{deposit.id}</span>
                          </div>
                          <div>
                            <p className="text-white/80 text-sm">NFT Certificate</p>
                            <p className="text-white font-bold text-xl">Term Deposit</p>
                          </div>
                        </div>
                        <div className={`px-3 py-1.5 rounded-full text-xs font-bold bg-white/20 text-white`}>
                          {status.label}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-slate-500 text-sm mb-1">Principal</p>
                          <p className="text-white font-bold text-lg">{formatUSDC(deposit.principal)}</p>
                          <p className="text-slate-400 text-xs">USDC</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-sm mb-1">APR</p>
                          <p className="text-emerald-400 font-bold text-lg">{(deposit.aprBpsAtOpen / 100).toFixed(1)}%</p>
                          <p className="text-slate-400 text-xs">per year</p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Time Remaining
                          </span>
                          <span className="text-white font-medium">{getTimeRemaining(deposit.maturityAt)}</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${status.progress}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => onWithdraw(deposit.id)}
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                        Withdraw
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}