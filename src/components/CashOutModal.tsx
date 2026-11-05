import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { PayPalPayout, WalletState } from '../types';

interface CashOutModalProps {
  isOpen: boolean;
  wallet: WalletState;
  onClose: () => void;
  onSuccess: (updatedWallet: WalletState, updatedPayouts: PayPalPayout[]) => void;
}

const MIN_WITHDRAWAL_USD = 10.0;

export const CashOutModal: React.FC<CashOutModalProps> = ({
  isOpen,
  wallet,
  onClose,
  onSuccess,
}) => {
  const [amountInput, setAmountInput] = useState<string>('10.00');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedPayout, setCompletedPayout] = useState<PayPalPayout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setCompletedPayout(null);
      if (wallet.availableBalanceUsd >= MIN_WITHDRAWAL_USD) {
        setAmountInput(wallet.availableBalanceUsd.toFixed(2));
      } else {
        setAmountInput('10.00');
      }
    }
  }, [isOpen, wallet.availableBalanceUsd]);

  if (!isOpen) return null;

  const parsedAmount = parseFloat(amountInput);
  const isAmountValid =
    !isNaN(parsedAmount) &&
    parsedAmount >= MIN_WITHDRAWAL_USD &&
    parsedAmount <= wallet.availableBalanceUsd + 0.0001;

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isNaN(parsedAmount) || parsedAmount < MIN_WITHDRAWAL_USD) {
      setErrorMsg('The minimum amount you can withdraw is $10.00 USD.');
      return;
    }

    if (parsedAmount > wallet.availableBalanceUsd + 0.0001) {
      setErrorMsg(
        `Entered amount ($${parsedAmount.toFixed(
          2
        )}) exceeds your available balance ($${wallet.availableBalanceUsd.toFixed(2)}).`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/payouts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: wallet.paypalEmail,
          amountUsd: parsedAmount,
          settleImmediately: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not process PayPal withdrawal.');
      } else {
        setCompletedPayout(data.payout);
        onSuccess(data.wallet, data.payouts);
      }
    } catch {
      setErrorMsg('Network error communicating with PayPal payout service.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-5 text-xs shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sky-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>PayPal Direct Cash Out</span>
            </div>
            <h2 className="text-lg font-bold text-white font-display">
              How much do you want to withdraw?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            title="Close window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {completedPayout ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  ${completedPayout.netPayoutUsd.toFixed(2)} USD Sent to PayPal
                </span>
              </div>
              <p className="text-slate-300">
                Your withdrawal has been processed to{' '}
                <strong className="font-mono text-white">
                  {completedPayout.recipientEmail}
                </strong>{' '}
                (Batch <span className="font-mono">{completedPayout.paypalBatchId}</span>).
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleWithdrawSubmit} className="space-y-4">
            {/* Available Balance & Authenticated PayPal Account */}
            <div className="p-3.5 bg-[#090D16] border border-slate-800 rounded-lg space-y-1.5 font-mono tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans">Your Available Balance</span>
                <span className="text-base font-bold text-emerald-400">
                  ${wallet.availableBalanceUsd.toFixed(2)} USD
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans">PayPal Account</span>
                <span className="text-slate-200">{wallet.paypalEmail}</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Amount Input Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-200 font-medium">
                  Enter withdrawal amount (USD)
                </label>
                <div className="flex items-center gap-1.5 font-mono">
                  <button
                    type="button"
                    onClick={() => setAmountInput('10.00')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    $10
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAmountInput(
                        Math.max(MIN_WITHDRAWAL_USD, wallet.availableBalanceUsd).toFixed(2)
                      )
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400"
                  >
                    Max
                  </button>
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="10.00"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="10.00"
                  className="w-full bg-[#090D16] border border-slate-700 rounded-lg pl-8 pr-14 py-2.5 text-white font-mono tabular-nums text-base focus:outline-none focus:border-sky-500"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
                  USD
                </span>
              </div>

              {/* Mandatory Minimum $10 Disclaimer */}
              <p className="text-[11px] text-amber-300/90 leading-relaxed pt-0.5">
                Disclaimer: The minimum amount you can withdraw is $10.00 USD.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !isAmountValid}
                className="px-5 py-2.5 rounded-lg bg-[#0070BA] hover:bg-[#005ea6] disabled:opacity-40 text-white font-semibold transition-colors"
              >
                {submitting
                  ? 'Processing Withdrawal...'
                  : `Withdraw $${(isNaN(parsedAmount) ? 0 : parsedAmount).toFixed(
                      2
                    )} to PayPal`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
