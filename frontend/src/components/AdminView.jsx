import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  Shield,
  Coins,
  Plus,
  Pause,
  Play,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  DollarSign
} from 'lucide-react';

const STATS_CARDS = [
  { icon: Wallet, label: 'Vault Balance', color: 'from-indigo-500 to-indigo-600', bgColor: 'bg-indigo-500/20' },
  { icon: Coins, label: 'Active Deposits', color: 'from-violet-500 to-violet-600', bgColor: 'bg-violet-500/20' },
  { icon: TrendingUp, label: 'Total Deposits', color: 'from-emerald-500 to-emerald-600', bgColor: 'bg-emerald-500/20' },
  { icon: DollarSign, label: 'Admin Fees', color: 'from-amber-500 to-orange-600', bgColor: 'bg-amber-500/20' },
];

export default function AdminView({
  allPlans,
  vaultBalance,
  totalDeposits,
  totalNFTs,
  adminFees,
  activeDepositsCount,
  isPaused,
  loading,
  onCreatePlan,
  onTogglePlan,
  onFundVault,
  onTogglePause,
  formatUSDC
}) {
  const [newPlan, setNewPlan] = useState({ tenorDays: 30, aprBps: 500, minDeposit: 10, maxDeposit: 100000, penaltyBps: 500 });
  const [fundAmount, setFundAmount] = useState('');

  const handleCreatePlan = async () => {
    await onCreatePlan(newPlan);
    setNewPlan({ tenorDays: 30, aprBps: 500, minDeposit: 10, maxDeposit: 100000, penaltyBps: 500 });
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-3xl font-bold text-white">Admin Dashboard</h2>
          <p className="text-indigo-300 mt-1">Manage protocol plans and vault</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-2 rounded-lg font-semibold ${isPaused ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
            {isPaused ? '⛔ System Paused' : '✅ System Active'}
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS_CARDS.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative overflow-hidden rounded-2xl bg-slate-800/50 border border-white/10 p-6 hover:border-white/20 transition-all"
          >
            <div className={`absolute inset-0 opacity-10 ${stat.bgColor}`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-slate-400">{stat.label}</span>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">
                {index === 0 ? formatUSDC(vaultBalance) :
                 index === 1 ? activeDepositsCount || totalNFTs :
                 index === 2 ? formatUSDC(totalDeposits) :
                 formatUSDC(adminFees)}
              </p>
              <p className="text-xs text-slate-500 mt-1">USDC</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-800/50 rounded-2xl border border-white/10 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                Plan Management
              </h3>
              <span className="text-sm text-slate-400">{allPlans.length} plans</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-black/20">
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">ID</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">Tenor</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">APR</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">Min</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">Max</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">Penalty</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allPlans.map((plan) => (
                    <tr key={plan.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-4 px-6">
                        <span className="text-white font-medium">#{plan.id}</span>
                      </td>
                      <td className="py-4 px-6 text-slate-300">{plan.tenorDays} days</td>
                      <td className="py-4 px-6">
                        <span className="text-emerald-400 font-semibold">{(plan.aprBps / 100).toFixed(1)}%</span>
                      </td>
                      <td className="py-4 px-6 text-slate-300">{formatUSDC(plan.minDeposit)}</td>
                      <td className="py-4 px-6 text-slate-300">{formatUSDC(plan.maxDeposit)}</td>
                      <td className="py-4 px-6 text-slate-300">{(plan.penaltyBps / 100).toFixed(1)}%</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                          plan.enabled
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {plan.enabled ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {plan.enabled ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => onTogglePlan(plan.id, plan.enabled)}
                          disabled={loading}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            plan.enabled
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                          }`}
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : plan.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-800/50 rounded-2xl border border-white/10 p-6"
          >
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-indigo-400" />
              Create New Plan
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Tenor (days)</label>
                <input
                  type="number"
                  value={newPlan.tenorDays}
                  onChange={(e) => setNewPlan({...newPlan, tenorDays: Number(e.target.value)})}
                  className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">APR (%)</label>
                <input
                  type="number"
                  value={newPlan.aprBps / 100}
                  onChange={(e) => setNewPlan({...newPlan, aprBps: Number(e.target.value) * 100})}
                  className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Min (USDC)</label>
                  <input
                    type="number"
                    value={newPlan.minDeposit}
                    onChange={(e) => setNewPlan({...newPlan, minDeposit: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Max (USDC)</label>
                  <input
                    type="number"
                    value={newPlan.maxDeposit}
                    onChange={(e) => setNewPlan({...newPlan, maxDeposit: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Penalty (%)</label>
                <input
                  type="number"
                  value={newPlan.penaltyBps / 100}
                  onChange={(e) => setNewPlan({...newPlan, penaltyBps: Number(e.target.value) * 100})}
                  className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleCreatePlan}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Plan'}
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-800/50 rounded-2xl border border-white/10 p-6"
          >
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-indigo-400" />
              Vault Control
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-black/30 rounded-xl border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Available Balance</span>
                  <span className="text-xl font-bold text-white">{formatUSDC(vaultBalance)} USDC</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Fund Amount (USDC)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    onClick={() => onFundVault(fundAmount)}
                    disabled={loading || !fundAmount}
                    className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl transition disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fund'}
                  </button>
                </div>
              </div>
              <button
                onClick={onTogglePause}
                disabled={loading}
                className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  isPaused
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                }`}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isPaused ? 'Unpause System' : 'Pause System'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}