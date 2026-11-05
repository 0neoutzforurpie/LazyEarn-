import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  CheckCircle2,
  SlidersHorizontal,
  Activity,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  AdCampaign,
  LivePlayerTelemetry,
  TelemetryBeaconEvent,
  ViewingSession,
  WalletState,
} from '../types';
import { AdVideoPlayer } from './AdVideoPlayer';

interface VideoStudioProps {
  campaigns: AdCampaign[];
  wallet: WalletState;
  recentSessions: ViewingSession[];
  beaconEvents: TelemetryBeaconEvent[];
  onSessionCompleted: (
    session: ViewingSession,
    updatedWallet: WalletState,
    updatedCampaigns?: AdCampaign[]
  ) => void;
  onCampaignAdded: (newCampaign: AdCampaign, allCampaigns: AdCampaign[]) => void;
  onTelemetryUpdate: (telemetry: LivePlayerTelemetry) => void;
  onBeaconEvent: (beacon: TelemetryBeaconEvent) => void;
  onOpenCashOut: () => void;
}

function sortHighestPayingFirst(list: AdCampaign[]): AdCampaign[] {
  return [...list].sort((a, b) => {
    if (b.maxBoostedRewardUsd !== a.maxBoostedRewardUsd) {
      return b.maxBoostedRewardUsd - a.maxBoostedRewardUsd;
    }
    return b.viewerBaseRewardUsd - a.viewerBaseRewardUsd;
  });
}

export const VideoStudio: React.FC<VideoStudioProps> = ({
  campaigns,
  wallet,
  recentSessions,
  beaconEvents,
  onSessionCompleted,
  onCampaignAdded,
  onTelemetryUpdate,
  onBeaconEvent,
  onOpenCashOut,
}) => {
  const [queue, setQueue] = useState<AdCampaign[]>(() =>
    sortHighestPayingFirst(campaigns)
  );
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [replenishing, setReplenishing] = useState<boolean>(false);

  // Queue Autoplay settings
  const [autoPlayEnabled, setAutoPlayEnabled] = useState<boolean>(true);
  const [transitionDelaySec, setTransitionDelaySec] = useState<number>(2);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);

  // Server session & live readout state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [liveTelemetry, setLiveTelemetry] = useState<LivePlayerTelemetry | null>(null);
  const [lastCompletedToast, setLastCompletedToast] = useState<{
    title: string;
    earned: number;
    multiplier: number;
  } | null>(null);

  // Custom VAST 4.0 modal state
  const [showVastModal, setShowVastModal] = useState<boolean>(false);
  const [vastUrlInput, setVastUrlInput] = useState<string>(
    'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast'
  );
  const [vastTitleInput, setVastTitleInput] = useState<string>(
    'Aura Quantum OLED — 240Hz Reference Display'
  );
  const [vastAdvertiserInput, setVastAdvertiserInput] = useState<string>(
    'Aura Display Systems'
  );
  const [vastRewardInput, setVastRewardInput] = useState<string>('1.65');
  const [vastSubmitting, setVastSubmitting] = useState<boolean>(false);

  const completionLockRef = useRef<boolean>(false);

  useEffect(() => {
    setQueue(sortHighestPayingFirst(campaigns));
  }, [campaigns]);

  const filteredQueue = sortHighestPayingFirst(
    categoryFilter === 'ALL'
      ? queue
      : queue.filter((c) => c.category.toLowerCase() === categoryFilter.toLowerCase())
  );

  const activeCampaign = filteredQueue[currentIndex] || filteredQueue[0] || queue[0];
  const categories = ['ALL', ...Array.from(new Set(queue.map((c) => c.category)))];

  // Safe JSON helper so HTML responses (e.g. during server reload) never throw SyntaxError
  const safeParseJson = async <T,>(res: Response): Promise<T | null> => {
    try {
      const text = await res.text();
      if (!text || text.trim().startsWith('<')) {
        return null;
      }
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  };

  // Start server-verified session whenever activeCampaign changes
  const initializeSession = useCallback(async (campaign: AdCampaign) => {
    if (!campaign) return;
    completionLockRef.current = false;
    setCountdownRemaining(null);

    try {
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      if (res.ok) {
        const data = await safeParseJson<{ sessionId?: string }>(res);
        if (data?.sessionId) {
          setActiveSessionId(data.sessionId);
          return;
        }
      }
    } catch {
      // Fallback session ID below
    }
    setActiveSessionId(`SES-${Date.now().toString(36).toUpperCase()}`);
  }, []);

  useEffect(() => {
    if (activeCampaign) {
      initializeSession(activeCampaign);
    }
  }, [activeCampaign?.id, initializeSession]);

  // Handle transition countdown between queued ads (always plays index 0 = highest-paying available ad)
  useEffect(() => {
    if (countdownRemaining === null) return;
    if (countdownRemaining <= 0) {
      setCountdownRemaining(null);
      setCurrentIndex(0);
      return;
    }
    const timer = setTimeout(() => {
      setCountdownRemaining((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdownRemaining]);

  const handleQuartileReached = useCallback(
    (quartile: number, watchedSec: number) => {
      if (!activeSessionId) return;
      fetch('/api/sessions/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          quartile,
          watchedSeconds: Math.floor(watchedSec),
        }),
      }).catch(() => {});
    },
    [activeSessionId]
  );

  const handleMultiplierSelected = useCallback(
    (answer: string, _multiplier: number, watchedSec: number) => {
      if (!activeSessionId) return;
      fetch('/api/sessions/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          watchedSeconds: Math.floor(watchedSec),
          selectedAnswer: answer,
        }),
      }).catch(() => {});
    },
    [activeSessionId]
  );

  const handleAdCompleted = useCallback(
    async (
      watchedSec: number,
      finalMultiplier: number,
      selectedAnswer: string | null
    ) => {
      if (!activeCampaign || completionLockRef.current) return;
      completionLockRef.current = true;

      const payload = {
        sessionId: activeSessionId,
        campaignId: activeCampaign.id,
        watchedSeconds: watchedSec,
        selectedAnswer,
      };

      let parsedData: {
        session: ViewingSession;
        wallet: WalletState;
        campaigns?: AdCampaign[];
      } | null = null;

      try {
        let res = await fetch('/api/sessions/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          parsedData = await safeParseJson(res);
        }
        // Retry once if server returned non-JSON during brief reload
        if (!parsedData) {
          await new Promise((r) => setTimeout(r, 350));
          res = await fetch('/api/sessions/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            parsedData = await safeParseJson(res);
          }
        }
      } catch {
        // Handled by local fallback below
      }

      if (parsedData && parsedData.session && parsedData.wallet) {
        const replenishedQueue = Array.isArray(parsedData.campaigns)
          ? sortHighestPayingFirst(parsedData.campaigns)
          : undefined;
        if (replenishedQueue) {
          setQueue(replenishedQueue);
        }
        onSessionCompleted(parsedData.session, parsedData.wallet, replenishedQueue);
        setLastCompletedToast({
          title: activeCampaign.title,
          earned: parsedData.session.netEarnedUsd,
          multiplier: parsedData.session.multiplierApplied,
        });
      } else {
        // Deterministic local fallback if server was mid-restart
        const baseReward = Number(activeCampaign.viewerBaseRewardUsd.toFixed(2));
        const netEarned = baseReward;
        const bonusUsd = 0.0;
        const nowIso = new Date().toISOString();

        const fallbackSession: ViewingSession = {
          id: activeSessionId || `SES-${Date.now().toString(36).toUpperCase()}`,
          campaignId: activeCampaign.id,
          campaignTitle: activeCampaign.title,
          advertiser: activeCampaign.advertiser,
          category: activeCampaign.category,
          startedAt: new Date(
            Date.now() - activeCampaign.durationSec * 1000
          ).toISOString(),
          completedAt: nowIso,
          watchedSeconds: activeCampaign.durationSec,
          durationSec: activeCampaign.durationSec,
          quartilesReached: [25, 50, 75, 100],
          viewerBaseUsd: baseReward,
          multiplierApplied: 1.0,
          bonusUsd,
          netEarnedUsd: netEarned,
          verificationHash: `VRF-${Date.now().toString(16).toUpperCase()}`,
          status: 'COMPLETED',
        };

        const updatedWallet: WalletState = {
          ...wallet,
          availableBalanceUsd: Number(
            (wallet.availableBalanceUsd + netEarned).toFixed(4)
          ),
          lifetimeEarnedUsd: Number(
            (wallet.lifetimeEarnedUsd + netEarned).toFixed(4)
          ),
          completedSessionsCount: wallet.completedSessionsCount + 1,
          activeStreak: wallet.activeStreak + 1,
        };

        const remaining = queue.filter((c) => c.id !== activeCampaign.id);
        const recycled: AdCampaign = {
          ...activeCampaign,
          id: `camp-auto-${Date.now().toString(36)}`,
        };
        const replenished = sortHighestPayingFirst([...remaining, recycled]);
        setQueue(replenished);
        onSessionCompleted(fallbackSession, updatedWallet, replenished);
        setLastCompletedToast({
          title: activeCampaign.title,
          earned: netEarned,
          multiplier: 1.0,
        });
      }

      if (autoPlayEnabled && filteredQueue.length > 0) {
        if (transitionDelaySec <= 0) {
          setCurrentIndex(0);
        } else {
          setCountdownRemaining(transitionDelaySec);
        }
      }
    },
    [
      activeCampaign,
      activeSessionId,
      autoPlayEnabled,
      filteredQueue.length,
      transitionDelaySec,
      wallet,
      queue,
      onSessionCompleted,
    ]
  );

  const handleInternalTelemetryUpdate = useCallback(
    (telemetry: LivePlayerTelemetry) => {
      setLiveTelemetry(telemetry);
      onTelemetryUpdate(telemetry);
    },
    [onTelemetryUpdate]
  );

  // Fetch more high-paying ads on demand
  const handleReplenishHighPayingAds = async () => {
    setReplenishing(true);
    try {
      const res = await fetch('/api/ads/replenish', { method: 'POST' });
      if (res.ok) {
        const data = await safeParseJson<{ campaigns?: AdCampaign[] }>(res);
        if (data?.campaigns && Array.isArray(data.campaigns)) {
          const sorted = sortHighestPayingFirst(data.campaigns);
          setQueue(sorted);
          onCampaignAdded(sorted[0], sorted);
          setCurrentIndex(0);
        }
      }
    } catch {
      // Ignore network hiccup
    } finally {
      setReplenishing(false);
    }
  };

  // Add custom VAST 4.0 tag
  const handleAddVastCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setVastSubmitting(true);
    try {
      const res = await fetch('/api/ads/vast-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vastUrl: vastUrlInput,
          customTitle: vastTitleInput,
          customAdvertiser: vastAdvertiserInput,
          customViewerReward: parseFloat(vastRewardInput) || 1.65,
        }),
      });
      if (res.ok) {
        const data = await safeParseJson<{
          campaign?: AdCampaign;
          campaigns?: AdCampaign[];
        }>(res);
        if (data?.campaign && Array.isArray(data.campaigns)) {
          const sorted = sortHighestPayingFirst(data.campaigns);
          setQueue(sorted);
          onCampaignAdded(data.campaign, sorted);
          setCategoryFilter('ALL');
          setCurrentIndex(0);
          setShowVastModal(false);
        }
      }
    } catch {
      // Ignore network hiccup
    } finally {
      setVastSubmitting(false);
    }
  };

  if (!activeCampaign) return null;

  const currentAccruedUsd = liveTelemetry?.liveAccruedUsd ?? 0;
  const currentProjectedUsd =
    liveTelemetry?.projectedTotalUsd ?? activeCampaign.viewerBaseRewardUsd;
  const currentWatchedPct = liveTelemetry?.watchedPct ?? 0;
  const currentMultiplier = liveTelemetry?.multiplierApplied ?? 1.0;

  // Since completed ads are replaced and sorted highest-first, the next highest-paying ad is at index 0 (or 1 before replacement)
  const nextCampaignInQueue =
    filteredQueue[(currentIndex + 1) % Math.max(1, filteredQueue.length)] ||
    filteredQueue[0];

  const minWithdrawalThreshold = wallet.minWithdrawalUsd || 10.0;
  const thresholdEligible = wallet.availableBalanceUsd >= minWithdrawalThreshold;

  return (
    <div className="space-y-6">
      {/* Top Studio Real-Time Telemetry Bar (Viewer-Only Earnings) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Your Available Balance</span>
            <span
              className={`font-mono ${
                thresholdEligible ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {thresholdEligible ? '≥ $10.00 Ready' : 'Min $10.00'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              ${wallet.availableBalanceUsd.toFixed(2)}
            </span>
            <button
              onClick={onOpenCashOut}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors whitespace-nowrap shrink-0"
            >
              Cash Out →
            </button>
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Current Ad Watched</span>
            <span className="font-mono text-slate-300">
              +${currentAccruedUsd.toFixed(2)} Accrued
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
              {currentWatchedPct.toFixed(1)}%
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              Reward ${currentProjectedUsd.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Your Total Earned</span>
            <span className="font-mono text-emerald-400">PayPal Linked</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              ${wallet.lifetimeEarnedUsd.toFixed(2)}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              Withdrawn ${wallet.lifetimePaidUsd.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Completed Sessions</span>
            <span className="font-mono text-amber-400">
              {wallet.activeStreak} Streak
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              {wallet.completedSessionsCount}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-400 truncate max-w-[140px]">
              {wallet.paypalEmail}
            </span>
          </div>
        </div>
      </div>

      {/* Main 12-Column Streaming Studio & Autoplay Queue Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Dedicated Multi-Format AdVideoPlayer & Live Telemetry Stream */}
        <div className="lg:col-span-8 space-y-4">
          <AdVideoPlayer
            campaign={activeCampaign}
            sessionId={activeSessionId}
            autoPlayEnabled={autoPlayEnabled}
            countdownRemaining={countdownRemaining}
            nextCampaignTitle={nextCampaignInQueue?.title}
            nextCampaignBaseRewardUsd={nextCampaignInQueue?.viewerBaseRewardUsd}
            onStartNextNow={() => {
              setCountdownRemaining(null);
              setCurrentIndex(0);
            }}
            onCancelAutoAdvance={() => {
              setCountdownRemaining(null);
              setAutoPlayEnabled(false);
            }}
            onSkipNext={() => {
              setCountdownRemaining(null);
              setCurrentIndex((prev) => (prev + 1) % filteredQueue.length);
            }}
            onRestartSession={() => initializeSession(activeCampaign)}
            onQuartileReached={handleQuartileReached}
            onMultiplierSelected={handleMultiplierSelected}
            onAdCompleted={handleAdCompleted}
            onTelemetryUpdate={handleInternalTelemetryUpdate}
            onBeaconEvent={onBeaconEvent}
          />

          {/* Recent Session Completion Banner */}
          {lastCompletedToast && (
            <div className="bg-[#0F172A] border border-emerald-500/40 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">
                  Completed viewing session for{' '}
                  <strong className="text-white">{lastCompletedToast.title}</strong> · Earned{' '}
                  <strong className="font-mono text-emerald-400">
                    +${lastCompletedToast.earned.toFixed(2)} USD
                  </strong>. Next highest-paying ad queued automatically.
                </span>
              </div>
              <button
                onClick={() => setLastCompletedToast(null)}
                className="text-slate-400 hover:text-white whitespace-nowrap shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Live Player Telemetry & Quartile Beacon Event Log */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Real-Time Session Activity & Progress Checkpoints</span>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {beaconEvents.length} Events Logged
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 font-mono text-xs">
              {beaconEvents.slice(0, 6).map((bcn) => (
                <div
                  key={bcn.id}
                  className="flex items-center justify-between gap-4 py-1.5 px-2.5 rounded bg-[#090D16] border border-slate-800/80"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 shrink-0">
                      {new Date(bcn.timestamp).toLocaleTimeString([], {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span
                      className={`font-semibold shrink-0 ${
                        bcn.eventType === 'COMPLETE_100'
                          ? 'text-emerald-400'
                          : bcn.eventType === 'STREAM_ERROR'
                          ? 'text-red-400'
                          : bcn.eventType === 'MULTIPLIER_LOCKED'
                          ? 'text-sky-400'
                          : 'text-slate-300'
                      }`}
                    >
                      [{bcn.eventType}]
                    </span>
                    <span className="text-slate-300 truncate">{bcn.detail}</span>
                  </div>
                  <span className="text-emerald-400 shrink-0 tabular-nums">
                    {bcn.watchedPct.toFixed(0)}% · ${bcn.accruedUsd.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Endless Highest-Paying First Autoplay Queue */}
        <div className="lg:col-span-4 bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Highest-Paying Queue</span>
              </h3>
              <p className="text-xs text-slate-400">
                Endless ad stream · Sorted highest reward first
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleReplenishHighPayingAds}
                disabled={replenishing}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors"
                title="Load more high-paying commercial spots"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-emerald-400 ${
                    replenishing ? 'animate-spin' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => setShowVastModal(true)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add VAST</span>
              </button>
            </div>
          </div>

          {/* Queue Autoplay & Delay Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#090D16] p-2.5 rounded-lg border border-slate-800/80 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoPlayEnabled}
                onChange={(e) => setAutoPlayEnabled(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="font-medium text-slate-200">Endless Autoplay</span>
            </label>

            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-slate-400 mr-1" />
              {[0, 2, 5].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setTransitionDelaySec(sec)}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                    transitionDelaySec === sec
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sec === 0 ? 'Instant' : `${sec}s`}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter Bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategoryFilter(cat);
                  setCurrentIndex(0);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Queue Items List (Sorted Highest-Paying First) */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {filteredQueue.map((item, idx) => {
              const isCurrent = item.id === activeCampaign.id;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setCountdownRemaining(null);
                  }}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-800/80 border-emerald-500/50'
                      : 'bg-[#090D16]/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="font-mono text-emerald-400 font-semibold">
                          #{idx + 1}
                        </span>
                        <span className="truncate">{item.advertiser}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.category}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-white line-clamp-1">
                        {item.title}
                      </h4>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono tabular-nums">
                    <span className="text-slate-400">
                      {item.durationSec}s Commercial Spot
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      Earn +${item.viewerBaseRewardUsd.toFixed(2)} USD
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mini Recent Settled Sessions Feed */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Your Recent Rewards</span>
              <span className="font-mono text-slate-400">Auto-Replenishing</span>
            </div>
            <div className="space-y-1.5">
              {recentSessions.slice(0, 3).map((ses) => (
                <div
                  key={ses.id}
                  className="flex items-center justify-between text-xs py-1 text-slate-400"
                >
                  <span className="truncate max-w-[180px] text-slate-300">
                    {ses.advertiser}
                  </span>
                  <span className="font-mono tabular-nums text-emerald-400 font-medium">
                    +${ses.netEarnedUsd.toFixed(2)} USD
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Custom VAST 4.0 XML Ad Tag Modal */}
      {showVastModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Add VAST 4.0 Video Stream to Queue
              </h3>
              <button
                onClick={() => setShowVastModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Paste an IAB VAST 4.0 XML tag URL to parse its media stream and insert it into your priority-sorted autoplay queue.
            </p>
            <form onSubmit={handleAddVastCampaign} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  VAST 4.0 XML Tag Endpoint URL
                </label>
                <input
                  type="url"
                  required
                  value={vastUrlInput}
                  onChange={(e) => setVastUrlInput(e.target.value)}
                  className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Campaign Title
                  </label>
                  <input
                    type="text"
                    required
                    value={vastTitleInput}
                    onChange={(e) => setVastTitleInput(e.target.value)}
                    className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Advertiser / Brand
                  </label>
                  <input
                    type="text"
                    required
                    value={vastAdvertiserInput}
                    onChange={(e) => setVastAdvertiserInput(e.target.value)}
                    className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  Base Viewer Reward (USD)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.25"
                  max="2.50"
                  required
                  value={vastRewardInput}
                  onChange={(e) => setVastRewardInput(e.target.value)}
                  className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVastModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={vastSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold"
                >
                  {vastSubmitting ? 'Parsing VAST XML...' : 'Add to Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
