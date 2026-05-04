import { Wallet, Network, Copy, Check, LogOut } from 'lucide-react';
import { useState } from 'react';

export default function Layout({ children, account, isAdmin, onConnect, onLogout, networkName = 'Localhost' }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">N</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-xl">NFT Deposits</h1>
                <p className="text-xs text-indigo-300">Term Savings Protocol</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                <Network className="w-4 h-4 text-indigo-400" />
                <span className="text-sm text-indigo-300 font-medium">{networkName}</span>
              </div>

              {account ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={copyAddress}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-white/10 transition group"
                  >
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                      {account.slice(0, 6)}...{account.slice(-4)}
                    </span>
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                    )}
                  </button>
                  {isAdmin && (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-lg">
                      👑 ADMIN
                    </span>
                  )}
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl border border-red-500/30 transition"
                    title="Disconnect Wallet"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onConnect}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-500/25"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      <footer className="border-t border-white/10 bg-black/10 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">
            NFT Term Deposits Protocol • Built with Hardhat + React
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Smart Contract Audited • Security-First Design
          </p>
        </div>
      </footer>
    </div>
  );
}