import React, { useState } from 'react';
import {
  Mail,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { WalletState } from '../types';

interface PayPalAuthGateProps {
  defaultEmail: string;
  onAuthenticated: (wallet: WalletState) => void;
}

export const PayPalAuthGate: React.FC<PayPalAuthGateProps> = ({
  defaultEmail,
  onAuthenticated,
}) => {
  const [authMode, setAuthMode] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');
  const [step, setStep] = useState<'FORM' | 'VERIFY_EMAIL'>('FORM');

  const [displayName, setDisplayName] = useState<string>('Jhon Cooksley');
  const [email, setEmail] = useState<string>(defaultEmail || 'jhoncooksley@outlook.com');
  const [password, setPassword] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [dispatchedCode, setDispatchedCode] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sendVerificationEmail = async (targetEmail: string, mode: 'SIGN_IN' | 'SIGN_UP') => {
    const res = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: targetEmail.trim(),
        displayName: displayName.trim(),
        mode,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Could not send email verification code.');
    }
    setDispatchedCode(data.emailVerificationCode || '');
    return data;
  };

  const handleRequestEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (password.trim().length < 6) {
      setErrorMsg('Please enter a password of at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await sendVerificationEmail(email, authMode);
      setVerificationCode('');
      setStep('VERIFY_EMAIL');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to send verification email.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setErrorMsg(null);
    setResending(true);
    try {
      await sendVerificationEmail(email, authMode);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to resend verification email.'
      );
    } finally {
      setResending(false);
    }
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          verificationCode: verificationCode.trim(),
          displayName: displayName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(
          data.error || 'Invalid verification code. Please check your email and try again.'
        );
      } else {
        onAuthenticated(data.wallet);
      }
    } catch {
      setErrorMsg('Network error verifying your email code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col justify-between p-6">
      {/* Minimal Brand Header */}
      <header className="max-w-[1200px] w-full mx-auto flex items-center justify-between py-2">
        <span className="text-lg font-bold tracking-tight text-white font-display">
          lazyearn
        </span>
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-emerald-400" />
          <span>Email Verification Protected</span>
        </span>
      </header>

      {/* Center Sign Up / Sign In Card */}
      <main className="my-auto max-w-md w-full mx-auto bg-[#0F172A] border border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
        {step === 'FORM' && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#090D16] border border-slate-800 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setAuthMode('SIGN_IN');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                authMode === 'SIGN_IN'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('SIGN_UP');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                authMode === 'SIGN_UP'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sign Up</span>
            </button>
          </div>
        )}

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-sky-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Verified Video Rewards Account</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-display">
            {step === 'VERIFY_EMAIL'
              ? 'Verify Your Email Address'
              : authMode === 'SIGN_UP'
              ? 'Create Your Account'
              : 'Sign In to Your Account'}
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {step === 'VERIFY_EMAIL'
              ? `We sent a 6-digit verification code to ${email}. Enter it below to verify your email and access the streaming studio.`
              : authMode === 'SIGN_UP'
              ? 'Register with your email address to earn rewards from high-paying video ads and withdraw directly to PayPal.'
              : 'Sign in with your email address and verify with a 6-digit email code to access your balance and video stream.'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        {step === 'FORM' ? (
          <form onSubmit={handleRequestEmailCode} className="space-y-4 text-xs">
            {authMode === 'SIGN_UP' && (
              <div>
                <label className="block text-slate-300 mb-1.5 font-medium">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">
                Email Address (Used for Account & PayPal Cash Out)
              </label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">
                {authMode === 'SIGN_UP' ? 'Create Password' : 'Password'}
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#0070BA] hover:bg-[#005ea6] disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <span>
                {submitting
                  ? 'Sending Verification Email...'
                  : authMode === 'SIGN_UP'
                  ? 'Sign Up & Send Verification Email'
                  : 'Sign In & Send Verification Email'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyEmailCode} className="space-y-4 text-xs">
            {/* Email Delivery Confirmation & Instant Code Fill */}
            <div className="p-3.5 bg-[#090D16] border border-slate-800 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verification Email Sent</span>
                </span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending}
                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-[11px]"
                >
                  <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                  <span>{resending ? 'Sending...' : 'Resend Email'}</span>
                </button>
              </div>

              {dispatchedCode && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <div>
                    <div className="text-[11px] text-slate-400">
                      Email Verification Code ({email})
                    </div>
                    <div className="text-lg font-bold font-mono tracking-widest text-emerald-400 tabular-nums">
                      {dispatchedCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVerificationCode(dispatchedCode)}
                    className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
                  >
                    Paste from Email
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">
                Enter 6-Digit Email Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="000000"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3.5 py-2.5 text-white font-mono text-base tracking-widest text-center focus:outline-none focus:border-emerald-500 tabular-nums"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('FORM');
                  setErrorMsg(null);
                }}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting || verificationCode.length !== 6}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#0070BA] hover:bg-[#005ea6] disabled:opacity-40 text-white font-semibold transition-colors"
              >
                {submitting ? 'Verifying Email...' : 'Verify Email & Enter Studio'}
              </button>
            </div>
          </form>
        )}

        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>Minimum withdrawal: $10.00 USD</span>
          <span>Direct PayPal Payouts</span>
        </div>
      </main>

      <footer className="max-w-[1200px] w-full mx-auto text-center text-xs text-slate-500 py-2">
        lazyearn · Email Verified Video Rewards
      </footer>
    </div>
  );
};
