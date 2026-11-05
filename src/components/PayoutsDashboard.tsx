import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';
import { PayPalPayout, WalletState } from '../types';

interface PayoutsDashboardProps {
  wallet: WalletState;
  payouts: PayPalPayout[];
  onPayoutUpdated: (updatedWallet: WalletState, updatedPayouts: PayPalPayout[]) => void;
  onOpenCashOutModal: () => void;
}

const MIN_WITHDRAWAL_USD = 10.0;

export const PayoutsDashboard: React.FC<PayoutsDashboardProps> = ({
  wallet,
  payouts,
  onPayoutUpdated,
  onOpenCashOutModal,
}) => {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PayPalPayout | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  const filteredPayouts = payouts.filter((p) => {
    if (statusFilter === 'PENDING') {
      return p.status === 'PENDING' || p.status === 'PROCESSING';
    }
    if (statusFilter === 'COMPLETED') {
      return p.status === 'COMPLETED';
    }
    return true;
  });

  const isEligibleForWithdrawal = wallet.availableBalanceUsd >= MIN_WITHDRAWAL_USD;
  const thresholdProgressPct = Math.min(
    100,
    Math.round((wallet.availableBalanceUsd / MIN_WITHDRAWAL_USD) * 100)
  );

  const handleSyncPayoutStatus = async (payoutId: string) => {
    setSyncingId(payoutId);
    try {
      const res = await fetch(`/api/payouts/${payoutId}/sync`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        onPayoutUpdated(data.wallet, data.payouts);
      }
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Cash Out Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Your PayPal Withdrawals & Payout History
          </h1>
          <p className="text-xs text-slate-400">
            Manage withdrawals to your authenticated PayPal account ({wallet.paypalEmail}) · Minimum withdrawal $10.00 USD
          </p>
        </div>

        <button
          onClick={onOpenCashOutModal}
          className="px-4 py-2.5 bg-[#0070BA] hover:bg-[#005ea6] rounded-lg text-xs font-semibold text-white flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Cash Out to PayPal</span>
        </button>
      </div>

      {/* Personal Balance & $10.00 Minimum Threshold Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Your Available Balance</span>
            <span className="font-mono text-emerald-400">Min $10.00 USD</span>
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-emerald-400">
            ${wallet.availableBalanceUsd.toFixed(2)}
          </div>
          <div className="pt-1 space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-400">$10.00 Minimum Requirement</span>
              <span
                className={
                  isEligibleForWithdrawal ? 'text-emerald-400 font-semibold' : 'text-amber-400'
                }
              >
                {isEligibleForWithdrawal
                  ? 'Ready to Withdraw'
                  : `${thresholdProgressPct}% ($${Math.max(
                      0,
                      MIN_WITHDRAWAL_USD - wallet.availableBalanceUsd
                    ).toFixed(2)} more needed)`}
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isEligibleForWithdrawal ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${thresholdProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-400">Pending Withdrawals</div>
            <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-amber-400">
              ${wallet.pendingPayoutUsd.toFixed(2)}
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Processing transfers to {wallet.paypalEmail}
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-400">Total Paid to Your PayPal</div>
            <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-white">
              ${wallet.lifetimePaidUsd.toFixed(2)}
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            PayPal Verified: {wallet.paypalEmail}
          </div>
        </div>
      </div>

      {/* Pending & Completed Payouts Table */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              Your PayPal Withdrawal History
            </h2>
            <p className="text-xs text-slate-400">
              Complete record of your pending and completed PayPal withdrawals
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#090D16] p-1 rounded-lg border border-slate-800">
            {(['ALL', 'PENDING', 'COMPLETED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All Withdrawals' : st === 'PENDING' ? 'Pending' : 'Completed'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 pr-3 font-medium">PayPal Batch ID</th>
                <th className="py-2.5 px-3 font-medium">PayPal Account</th>
                <th className="py-2.5 px-3 font-medium text-right">Amount Withdrawn</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 pl-3 font-medium text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredPayouts.map((payout) => {
                const isPending =
                  payout.status === 'PENDING' || payout.status === 'PROCESSING';

                return (
                  <tr
                    key={payout.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 pr-3 font-mono text-white">
                      <div>{payout.paypalBatchId}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(payout.createdAt).toLocaleString([], {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono">
                      {payout.recipientEmail}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-emerald-400">
                      ${payout.netPayoutUsd.toFixed(2)} USD
                    </td>
                    <td className="py-3 px-3">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Completed</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isPending && (
                          <button
                            onClick={() => handleSyncPayoutStatus(payout.id)}
                            disabled={syncingId === payout.id}
                            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${
                                syncingId === payout.id ? 'animate-spin' : ''
                              }`}
                            />
                            <span>Refresh Status</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedReceipt(payout)}
                          className="text-slate-400 hover:text-white flex items-center gap-0.5 whitespace-nowrap shrink-0"
                        >
                          <span>View Receipt</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PayPal Withdrawal Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  PayPal Withdrawal Receipt
                </h3>
                <p className="text-slate-400 font-mono">
                  {selectedReceipt.paypalBatchId}
                </p>
              </div>
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="space-y-2.5 font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-400">Withdrawal ID</span>
                <span className="text-white">{selectedReceipt.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">PayPal Item ID</span>
                <span className="text-white">{selectedReceipt.paypalPayoutItemId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">PayPal Account</span>
                <span className="text-white">{selectedReceipt.recipientEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span
                  className={
                    selectedReceipt.status === 'COMPLETED'
                      ? 'text-emerald-400 font-bold'
                      : 'text-amber-400 font-bold'
                  }
                >
                  {selectedReceipt.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Sent</span>
                <span className="text-emerald-400 font-bold text-sm">
                  ${selectedReceipt.netPayoutUsd.toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Receipt Signature</span>
                <span className="text-slate-300">
                  {selectedReceipt.verificationSignature}
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#090D16] rounded-lg border border-slate-800 text-slate-400">
              {selectedReceipt.transactionNote}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
