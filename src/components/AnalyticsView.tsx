import React, { useState } from 'react';
import {
  AdCampaign,
  LivePlayerTelemetry,
  TelemetryBeaconEvent,
  ViewingSession,
  WalletState,
} from '../types';

interface AnalyticsViewProps {
  sessions: ViewingSession[];
  campaigns: AdCampaign[];
  wallet: WalletState;
  liveTelemetry: LivePlayerTelemetry | null;
  beaconEvents: TelemetryBeaconEvent[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  sessions,
  campaigns,
  wallet,
  liveTelemetry,
}) => {
  const [timeframe, setTimeframe] = useState<'ALL' | 'RECENT_5'>('ALL');

  const displayedSessions =
    timeframe === 'RECENT_5' ? sessions.slice(0, 5) : sessions;

  const totalNetEarned = displayedSessions.reduce((sum, s) => sum + s.netEarnedUsd, 0);
  const totalWatchedSeconds = displayedSessions.reduce(
    (sum, s) => sum + s.watchedSeconds,
    0
  );

  const avgNetPerSession =
    displayedSessions.length > 0 ? totalNetEarned / displayedSessions.length : 0;

  // Group personal earnings by category
  const categoryMap = new Map<
    string,
    { category: string; count: number; netUsd: number }
  >();

  displayedSessions.forEach((s) => {
    const existing = categoryMap.get(s.category) || {
      category: s.category,
      count: 0,
      netUsd: 0,
    };
    existing.count += 1;
    existing.netUsd += s.netEarnedUsd;
    categoryMap.set(s.category, existing);
  });

  const categoryBreakdown = Array.from(categoryMap.values()).sort(
    (a, b) => b.netUsd - a.netUsd
  );

  const chartSessions = [...displayedSessions].slice(0, 12).reverse();
  const maxSessionNet = Math.max(
    1.0,
    ...chartSessions.map((s) => s.netEarnedUsd)
  );

  return (
    <div className="space-y-6">
      {/* Header & Segmented Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Your Personal Viewing & Reward Analytics
          </h1>
          <p className="text-xs text-slate-400">
            Real-time tracking of your completed sessions and verified ad rewards
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#0F172A] border border-slate-800 rounded-lg">
          <button
            onClick={() => setTimeframe('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              timeframe === 'ALL'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setTimeframe('RECENT_5')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              timeframe === 'RECENT_5'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Last 5 Sessions
          </button>
        </div>
      </div>

      {/* Live Active Player Telemetry Strip */}
      {liveTelemetry && (
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="space-y-1">
            <div className="text-slate-400">
              Active Session ·{' '}
              <strong className="text-white">{liveTelemetry.advertiser}</strong> ·{' '}
              <span className="font-mono text-emerald-400">{liveTelemetry.adFormat}</span>
            </div>
            <div className="font-semibold text-white">{liveTelemetry.campaignTitle}</div>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-mono tabular-nums">
            <div>
              <div className="text-slate-400">Player State</div>
              <div className="font-bold text-white">{liveTelemetry.playerState}</div>
            </div>
            <div>
              <div className="text-slate-400">Watched %</div>
              <div className="font-bold text-emerald-400">
                {liveTelemetry.watchedPct.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-slate-400">Your Session Reward</div>
              <div className="font-bold text-emerald-400">
                ${liveTelemetry.liveAccruedUsd.toFixed(2)} / $
                {liveTelemetry.projectedTotalUsd.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top 4 Personal KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Your Total Earned (Filtered)</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-400">
            ${totalNetEarned.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            {displayedSessions.length} completed ad sessions
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Your Available Balance</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-white">
            ${wallet.availableBalanceUsd.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            Minimum withdrawal $10.00 USD
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Session Completion Rate</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-sky-400">
            100%
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            50.0% verified ad revenue share
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Average Reward Per Ad</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-white">
            ${avgNetPerSession.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            {totalWatchedSeconds}s total verified ad watch time
          </div>
        </div>
      </div>

      {/* Session-by-Session Yield Chart & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Session Yield Bar Chart */}
        <div className="lg:col-span-7 bg-[#0F172A] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">
                Your Session-by-Session Earnings
              </h2>
              <p className="text-xs text-slate-400">
                Verified reward credited to your balance per completed ad
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              Last {chartSessions.length} Sessions
            </span>
          </div>

          {chartSessions.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              No completed viewing sessions match the current filter.
            </div>
          ) : (
            <div className="h-56 flex items-end gap-3 pt-6 pb-2 border-b border-slate-800">
              {chartSessions.map((ses) => {
                const barHeightPct = Math.max(
                  10,
                  Math.round((ses.netEarnedUsd / maxSessionNet) * 100)
                );

                return (
                  <div
                    key={ses.id}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 border border-slate-700 px-2 py-1 rounded text-[10px] font-mono tabular-nums text-white whitespace-nowrap pointer-events-none z-10">
                      +${ses.netEarnedUsd.toFixed(2)} USD
                    </div>

                    <div className="w-full max-w-[38px] flex flex-col justify-end h-full">
                      <div
                        style={{ height: `${barHeightPct}%` }}
                        className="w-full bg-emerald-500 rounded-t-sm"
                      />
                    </div>
                    <span className="mt-2 text-[10px] font-mono tabular-nums text-slate-400 truncate max-w-full">
                      {ses.id.replace('SES-', '')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Personal Reward History</span>
            <span className="font-mono tabular-nums text-emerald-400">
              Total Personal Earnings: ${wallet.lifetimeEarnedUsd.toFixed(2)} USD
            </span>
          </div>
        </div>

        {/* Right 5 Columns: Category Performance & Queue Reward Rates */}
        <div className="lg:col-span-5 bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white">
              Your Earnings by Ad Category
            </h2>
            <p className="text-xs text-slate-400">
              Personal rewards grouped by commercial category
            </p>
          </div>

          <div className="space-y-3">
            {categoryBreakdown.map((item) => {
              const shareOfTotalPct =
                totalNetEarned > 0
                  ? Math.round((item.netUsd / totalNetEarned) * 100)
                  : 0;
              return (
                <div key={item.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-white">
                      {item.category}{' '}
                      <span className="text-slate-400 font-normal">
                        · {item.count} {item.count === 1 ? 'session' : 'sessions'}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                      ${item.netUsd.toFixed(2)} ({shareOfTotalPct}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.max(5, shareOfTotalPct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-white">
              Available Queue Rewards ({campaigns.length} Spots)
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 text-xs">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-slate-300 py-1 border-b border-slate-800/60 last:border-none"
                >
                  <span className="truncate max-w-[190px]">{c.advertiser}</span>
                  <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                    +${c.viewerBaseRewardUsd.toFixed(2)} USD
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
