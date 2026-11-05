/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AdCampaign,
  DashboardPayload,
  LivePlayerTelemetry,
  PayPalPayout,
  TelemetryBeaconEvent,
  ViewingSession,
  WalletState,
} from './types';
import { VideoStudio } from './components/VideoStudio';
import { AnalyticsView } from './components/AnalyticsView';
import { PayoutsDashboard } from './components/PayoutsDashboard';
import { EarningsLedger } from './components/EarningsLedger';
import { PayPalAuthGate } from './components/PayPalAuthGate';
import { CashOutModal } from './components/CashOutModal';

type ActiveTab = 'studio' | 'analytics' | 'payouts' | 'ledger';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [loading, setLoading] = useState<boolean>(true);
  const [showCashOutModal, setShowCashOutModal] = useState<boolean>(false);

  const [wallet, setWallet] = useState<WalletState>({
    isAuthenticated: false,
    paypalEmail: 'jhoncooksley@outlook.com',
    paypalDisplayName: 'Jhon Cooksley',
    paypalVerified: true,
    minWithdrawalUsd: 10.0,
    availableBalanceUsd: 12.23,
    pendingPayoutUsd: 0,
    lifetimeEarnedUsd: 22.23,
    lifetimePaidUsd: 10.0,
    completedSessionsCount: 5,
    activeStreak: 5,
  });
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [sessions, setSessions] = useState<ViewingSession[]>([]);
  const [payouts, setPayouts] = useState<PayPalPayout[]>([]);

  // Shared real-time player telemetry & beacon log across Studio and Analytics
  const [liveTelemetry, setLiveTelemetry] = useState<LivePlayerTelemetry | null>(null);
  const [beaconEvents, setBeaconEvents] = useState<TelemetryBeaconEvent[]>([]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const text = await res.text();
        if (text && !text.trim().startsWith('<')) {
          const data: DashboardPayload = JSON.parse(text);
          setWallet(data.wallet);
          setCampaigns(data.campaigns);
          setSessions(data.sessions);
          setPayouts(data.payouts);
        }
      }
    } catch {
      // Keep default state if server is reloading
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleSessionCompleted = useCallback(
    (
      newSession: ViewingSession,
      updatedWallet: WalletState,
      updatedCampaigns?: AdCampaign[]
    ) => {
      setSessions((prev) => [newSession, ...prev]);
      setWallet(updatedWallet);
      if (updatedCampaigns) {
        setCampaigns(updatedCampaigns);
      }
    },
    []
  );

  const handleCampaignAdded = useCallback(
    (_newCampaign: AdCampaign, allCampaigns: AdCampaign[]) => {
      setCampaigns(allCampaigns);
    },
    []
  );

  const handlePayoutUpdated = useCallback(
    (updatedWallet: WalletState, updatedPayouts: PayPalPayout[]) => {
      setWallet(updatedWallet);
      setPayouts(updatedPayouts);
    },
    []
  );

  const handleBeaconEvent = useCallback((beacon: TelemetryBeaconEvent) => {
    setBeaconEvents((prev) => [beacon, ...prev].slice(0, 50));
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        const text = await res.text();
        if (text && !text.trim().startsWith('<')) {
          const data = JSON.parse(text);
          if (data?.wallet) {
            setWallet(data.wallet);
            return;
          }
        }
      }
      setWallet((prev) => ({ ...prev, isAuthenticated: false }));
    } catch {
      setWallet((prev) => ({ ...prev, isAuthenticated: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D16] flex items-center justify-center p-6">
        <div className="w-full max-w-md h-48 bg-[#0F172A] border border-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Require PayPal Authenticator sign-in before entering the website
  if (!wallet.isAuthenticated) {
    return (
      <PayPalAuthGate
        defaultEmail={wallet.paypalEmail}
        onAuthenticated={(authenticatedWallet) => {
          setWallet(authenticatedWallet);
          fetchDashboard();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/90 bg-[#090D16]/95 backdrop-blur-md sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('studio');
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
        >
          lazyearn
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-400 overflow-x-auto">
          <button
            onClick={() => setActiveTab('studio')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'studio'
                ? 'text-white border-emerald-400'
                : 'border-transparent'
            }`}
          >
            Streaming Studio
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'analytics'
                ? 'text-white border-emerald-400'
                : 'border-transparent'
            }`}
          >
            Live Analytics
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'payouts'
                ? 'text-white border-emerald-400'
                : 'border-transparent'
            }`}
          >
            PayPal Payouts
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'ledger'
                ? 'text-white border-emerald-400'
                : 'border-transparent'
            }`}
          >
            Earnings History
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowCashOutModal(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0070BA] hover:bg-[#005ea6] rounded-lg transition-colors whitespace-nowrap shrink-0 font-mono tabular-nums"
          >
            Cash Out (${wallet.availableBalanceUsd.toFixed(2)})
          </button>
        </div>
      </header>

      {/* Main Content Container (1440px Desktop Presence) */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'studio' && (
          <VideoStudio
            campaigns={campaigns}
            wallet={wallet}
            recentSessions={sessions}
            beaconEvents={beaconEvents}
            onSessionCompleted={handleSessionCompleted}
            onCampaignAdded={handleCampaignAdded}
            onTelemetryUpdate={setLiveTelemetry}
            onBeaconEvent={handleBeaconEvent}
            onOpenCashOut={() => setShowCashOutModal(true)}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            sessions={sessions}
            campaigns={campaigns}
            wallet={wallet}
            liveTelemetry={liveTelemetry}
            beaconEvents={beaconEvents}
          />
        )}

        {activeTab === 'payouts' && (
          <PayoutsDashboard
            wallet={wallet}
            payouts={payouts}
            onPayoutUpdated={handlePayoutUpdated}
            onOpenCashOutModal={() => setShowCashOutModal(true)}
          />
        )}

        {activeTab === 'ledger' && <EarningsLedger sessions={sessions} />}
      </main>

      {/* Cash Out Modal Window ("How much do you want to withdraw?" + $10.00 minimum disclaimer) */}
      <CashOutModal
        isOpen={showCashOutModal}
        wallet={wallet}
        onClose={() => setShowCashOutModal(false)}
        onSuccess={handlePayoutUpdated}
      />

      {/* Clean Footer with Verified Email Identity & Sign Out */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-xs text-slate-500">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <span>
            Signed in with Verified Email as{' '}
            <strong className="text-slate-300 font-mono">{wallet.paypalEmail}</strong>
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCashOutModal(true)}
              className="hover:text-slate-300 transition-colors"
            >
              Cash Out ($10.00 Minimum)
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
