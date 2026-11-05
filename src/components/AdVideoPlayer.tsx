import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Layers,
  Loader2,
} from 'lucide-react';
import {
  AdCampaign,
  AdFormatType,
  LivePlayerTelemetry,
  PlayerLifecycleState,
  TelemetryBeaconEvent,
} from '../types';

interface AdVideoPlayerProps {
  campaign: AdCampaign;
  sessionId: string | null;
  autoPlayEnabled: boolean;
  countdownRemaining: number | null;
  nextCampaignTitle?: string;
  nextCampaignBaseRewardUsd?: number;
  onStartNextNow: () => void;
  onCancelAutoAdvance: () => void;
  onSkipNext: () => void;
  onRestartSession: () => void;
  onQuartileReached: (quartile: number, watchedSec: number, pct: number) => void;
  onMultiplierSelected: (answer: string, multiplier: number, watchedSec: number) => void;
  onAdCompleted: (watchedSec: number, finalMultiplier: number, selectedAnswer: string | null) => void;
  onTelemetryUpdate: (telemetry: LivePlayerTelemetry) => void;
  onBeaconEvent: (beacon: TelemetryBeaconEvent) => void;
}

const FORMAT_LABELS: Record<AdFormatType, string> = {
  MP4_DIRECT: 'MP4 Direct H.264',
  VAST_4_XML: 'IAB VAST 4.0 Linear',
  HLS_ADAPTIVE: 'HLS Adaptive Stream',
  INTERACTIVE_CANVAS: 'Interactive Rich Media',
};

const MAX_BUFFER_TIMEOUT_SEC = 10;

export const AdVideoPlayer: React.FC<AdVideoPlayerProps> = ({
  campaign,
  sessionId,
  countdownRemaining,
  nextCampaignTitle,
  nextCampaignBaseRewardUsd,
  onStartNextNow,
  onCancelAutoAdvance,
  onSkipNext,
  onRestartSession,
  onQuartileReached,
  onMultiplierSelected,
  onAdCompleted,
  onTelemetryUpdate,
  onBeaconEvent,
}) => {
  const defaultFormat: AdFormatType = campaign.isCustomVast
    ? 'VAST_4_XML'
    : campaign.adFormat || (campaign.vastTagUrl ? 'VAST_4_XML' : 'MP4_DIRECT');

  const [activeFormat, setActiveFormat] = useState<AdFormatType>(defaultFormat);
  const [playerState, setPlayerState] = useState<PlayerLifecycleState>('PLAYING');
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [bufferElapsedSec, setBufferElapsedSec] = useState<number>(0);
  const [quartilesReached, setQuartilesReached] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [appliedMultiplier, setAppliedMultiplier] = useState<number>(1.0);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [useCanvasFallback, setUseCanvasFallback] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const completedRef = useRef<boolean>(false);
  const quartilesRef = useRef<Set<number>>(new Set());
  const elapsedSecRef = useRef<number>(0);
  const bufferElapsedRef = useRef<number>(0);

  const emitBeacon = useCallback(
    (
      eventType: TelemetryBeaconEvent['eventType'],
      watchedPct: number,
      accruedUsd: number,
      detail: string
    ) => {
      onBeaconEvent({
        id: `BCN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        adFormat: activeFormat,
        eventType,
        watchedPct: Number(watchedPct.toFixed(1)),
        accruedUsd: Number(accruedUsd.toFixed(4)),
        detail,
      });
    },
    [campaign.id, campaign.title, activeFormat, onBeaconEvent]
  );

  // Reset internal state and immediately begin playing when campaign or session changes
  useEffect(() => {
    const nextFmt: AdFormatType = campaign.isCustomVast
      ? 'VAST_4_XML'
      : campaign.adFormat || (campaign.vastTagUrl ? 'VAST_4_XML' : 'MP4_DIRECT');
    setActiveFormat(nextFmt);
    elapsedSecRef.current = 0;
    bufferElapsedRef.current = 0;
    setElapsedSec(0);
    setBufferElapsedSec(0);
    setQuartilesReached([]);
    quartilesRef.current = new Set();
    setSelectedAnswer(null);
    setAppliedMultiplier(1.0);
    setErrorDetail(null);
    setUseCanvasFallback(nextFmt === 'INTERACTIVE_CANVAS');
    completedRef.current = false;
    setPlayerState('PLAYING');

    emitBeacon(
      'IMPRESSION_START',
      0,
      0,
      `Started ${FORMAT_LABELS[nextFmt]} session (${campaign.durationSec}s)`
    );
  }, [campaign.id, sessionId, campaign.isCustomVast, campaign.adFormat, campaign.vastTagUrl, campaign.durationSec, emitBeacon]);

  // Synchronize HTML5 <video> element with playerState and mute
  useEffect(() => {
    const video = videoRef.current;
    if (!video || useCanvasFallback || activeFormat === 'INTERACTIVE_CANVAS') return;

    video.muted = isMuted;
    if (playerState === 'PLAYING' && countdownRemaining === null) {
      video.play().catch(() => {
        setUseCanvasFallback(true);
      });
    } else if (playerState === 'PAUSED') {
      video.pause();
    }
  }, [playerState, isMuted, countdownRemaining, useCanvasFallback, activeFormat, campaign.videoUrl]);

  // 10-Second Buffering Watchdog Timer:
  // If any ad buffers for longer than 10 seconds, automatically skip and play the next ad in the queue
  useEffect(() => {
    if (playerState !== 'BUFFERING' || countdownRemaining !== null) {
      bufferElapsedRef.current = 0;
      setBufferElapsedSec(0);
      return;
    }

    const bufferTimer = setInterval(() => {
      const nextVal = Number((bufferElapsedRef.current + 0.5).toFixed(1));
      if (nextVal >= MAX_BUFFER_TIMEOUT_SEC) {
        bufferElapsedRef.current = 0;
        setBufferElapsedSec(0);
        emitBeacon(
          'STREAM_ERROR',
          Math.min(100, (elapsedSecRef.current / campaign.durationSec) * 100),
          0,
          `Ad buffered > ${MAX_BUFFER_TIMEOUT_SEC}s — automatically playing next ad in queue`
        );
        onSkipNext();
        return;
      }
      bufferElapsedRef.current = nextVal;
      setBufferElapsedSec(nextVal);
    }, 500);

    return () => clearInterval(bufferTimer);
  }, [
    playerState,
    countdownRemaining,
    campaign.durationSec,
    onSkipNext,
    emitBeacon,
  ]);

  // Animated Rich Media Canvas Renderer (runs for INTERACTIVE_CANVAS or failover mode so ads are always playing)
  useEffect(() => {
    if (!useCanvasFallback && activeFormat !== 'INTERACTIVE_CANVAS') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const renderFrame = () => {
      if (playerState === 'PLAYING') {
        phase += 0.03;
      }
      const w = canvas.width;
      const h = canvas.height;

      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#070B14');
      grad.addColorStop(0.5, '#0F172A');
      grad.addColorStop(1, '#090D16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const barCount = 36;
      const barWidth = (w - 120) / barCount;
      for (let i = 0; i < barCount; i++) {
        const wave =
          Math.sin(phase * 2 + i * 0.35) * 0.5 +
          Math.cos(phase * 1.3 - i * 0.2) * 0.5;
        const barHeight = Math.max(8, Math.abs(wave) * (h * 0.28));
        ctx.fillStyle = i % 3 === 0 ? campaign.accentColor : 'rgba(148, 163, 184, 0.22)';
        ctx.fillRect(
          60 + i * barWidth,
          h / 2 - barHeight / 2,
          barWidth * 0.62,
          barHeight
        );
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [useCanvasFallback, activeFormat, playerState, campaign.accentColor]);

  // Viewer's personal reward is strictly capped at campaign.maxBoostedRewardUsd (<= 70% of ad revenue on the server)
  const viewerBaseRewardUsd = Number(campaign.viewerBaseRewardUsd.toFixed(2));
  const projectedViewerRewardUsd = selectedAnswer
    ? Number(
        Math.min(
          campaign.maxBoostedRewardUsd,
          Number((viewerBaseRewardUsd * appliedMultiplier).toFixed(2))
        ).toFixed(2)
      )
    : viewerBaseRewardUsd;

  // Master 200ms Watch-Percentage & Quartile Verification Engine
  useEffect(() => {
    if (playerState !== 'PLAYING' || countdownRemaining !== null) return;

    const timer = setInterval(() => {
      if (completedRef.current) return;

      const nextSec = Number((elapsedSecRef.current + 0.2).toFixed(2));
      const pct = Math.min(100, (nextSec / campaign.durationSec) * 100);
      const currentAccrued = Number((projectedViewerRewardUsd * (pct / 100)).toFixed(2));

      // Check IAB Quartiles: 25%, 50%, 75%
      ([25, 50, 75] as const).forEach((q) => {
        if (pct >= q && !quartilesRef.current.has(q)) {
          quartilesRef.current.add(q);
          const updatedQuartiles = Array.from(quartilesRef.current).sort((a, b) => a - b);
          setQuartilesReached(updatedQuartiles);
          onQuartileReached(q, nextSec, pct);
          const eventMap: Record<25 | 50 | 75, TelemetryBeaconEvent['eventType']> = {
            25: 'QUARTILE_25',
            50: 'QUARTILE_50',
            75: 'QUARTILE_75',
          };
          emitBeacon(
            eventMap[q],
            pct,
            currentAccrued,
            `Reached ${q}% checkpoint (${nextSec.toFixed(1)}s watched)`
          );
        }
      });

      // Signal 100% Completion
      if (nextSec >= campaign.durationSec) {
        completedRef.current = true;
        elapsedSecRef.current = campaign.durationSec;
        quartilesRef.current.add(100);
        setElapsedSec(campaign.durationSec);
        setQuartilesReached([25, 50, 75, 100]);
        setPlayerState('COMPLETED');
        emitBeacon(
          'COMPLETE_100',
          100,
          projectedViewerRewardUsd,
          `100% Completed (${campaign.durationSec}s watched) · Credited +$${projectedViewerRewardUsd.toFixed(2)} USD`
        );
        onAdCompleted(campaign.durationSec, appliedMultiplier, selectedAnswer);
        return;
      }

      elapsedSecRef.current = nextSec;
      setElapsedSec(nextSec);
    }, 200);

    return () => clearInterval(timer);
  }, [
    playerState,
    countdownRemaining,
    campaign,
    appliedMultiplier,
    selectedAnswer,
    projectedViewerRewardUsd,
    onQuartileReached,
    onAdCompleted,
    emitBeacon,
  ]);

  const watchedPct = Math.min(100, (elapsedSec / campaign.durationSec) * 100);
  const liveAccruedUsd = Number((projectedViewerRewardUsd * (watchedPct / 100)).toFixed(2));

  useEffect(() => {
    onTelemetryUpdate({
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      advertiser: campaign.advertiser,
      adFormat: activeFormat,
      playerState,
      watchedPct: Number(watchedPct.toFixed(1)),
      elapsedSec,
      durationSec: campaign.durationSec,
      liveAccruedUsd,
      projectedTotalUsd: projectedViewerRewardUsd,
      multiplierApplied: appliedMultiplier,
      quartilesReached,
    });
  }, [
    campaign.id,
    campaign.title,
    campaign.advertiser,
    campaign.durationSec,
    activeFormat,
    playerState,
    watchedPct,
    elapsedSec,
    liveAccruedUsd,
    projectedViewerRewardUsd,
    appliedMultiplier,
    quartilesReached,
    onTelemetryUpdate,
  ]);

  const handleTogglePlayPause = () => {
    if (playerState === 'ERROR') return;
    if (playerState === 'PLAYING' || playerState === 'BUFFERING') {
      setPlayerState('PAUSED');
      emitBeacon(
        'STATE_PAUSE',
        watchedPct,
        liveAccruedUsd,
        `Playback paused at ${watchedPct.toFixed(1)}% (${elapsedSec.toFixed(1)}s)`
      );
    } else {
      setPlayerState('PLAYING');
      emitBeacon(
        'STATE_PLAY',
        watchedPct,
        liveAccruedUsd,
        `Playback resumed at ${watchedPct.toFixed(1)}% (${elapsedSec.toFixed(1)}s)`
      );
    }
  };

  const handleFormatChange = (newFormat: AdFormatType) => {
    setActiveFormat(newFormat);
    setErrorDetail(null);
    bufferElapsedRef.current = 0;
    setBufferElapsedSec(0);
    if (newFormat === 'INTERACTIVE_CANVAS') {
      setUseCanvasFallback(true);
    } else {
      setUseCanvasFallback(false);
    }
    setPlayerState('PLAYING');
    emitBeacon(
      'STATE_PLAY',
      watchedPct,
      liveAccruedUsd,
      `Switched ad stream container to ${FORMAT_LABELS[newFormat]}`
    );
  };

  const handleRecoverFromError = () => {
    setErrorDetail(null);
    bufferElapsedRef.current = 0;
    setBufferElapsedSec(0);
    setUseCanvasFallback(true);
    setActiveFormat('INTERACTIVE_CANVAS');
    setPlayerState('PLAYING');
    emitBeacon(
      'FAILOVER_RECOVERY',
      watchedPct,
      liveAccruedUsd,
      `Failover recovery engaged · Resumed session at ${watchedPct.toFixed(1)}%`
    );
  };

  const handleSelectPromptOption = (option: string) => {
    if (selectedAnswer) return;
    const mult = campaign.interactivePrompt.multiplier;
    const cappedReward = Math.min(
      campaign.maxBoostedRewardUsd,
      Number((viewerBaseRewardUsd * mult).toFixed(4))
    );
    setSelectedAnswer(option);
    setAppliedMultiplier(mult);
    onMultiplierSelected(option, mult, elapsedSec);
    emitBeacon(
      'MULTIPLIER_LOCKED',
      watchedPct,
      cappedReward * (watchedPct / 100),
      `Interactive bonus unlocked ("${option}") · Reward boosted to $${cappedReward.toFixed(2)} USD`
    );
  };

  const showInteractivePrompt =
    playerState === 'PLAYING' &&
    watchedPct >= campaign.interactivePrompt.triggerAtPct &&
    watchedPct < 96 &&
    !selectedAnswer;

  return (
    <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
      {/* Top Format Selector & 10s Buffer Watchdog Status Bar */}
      <div className="px-4 py-2.5 bg-[#090D16] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-slate-400 flex items-center gap-1 font-medium shrink-0">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ad Stream Format:</span>
          </span>
          {(
            ['MP4_DIRECT', 'VAST_4_XML', 'HLS_ADAPTIVE', 'INTERACTIVE_CANVAS'] as AdFormatType[]
          ).map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleFormatChange(fmt)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeFormat === fmt
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {FORMAT_LABELS[fmt]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
          <span className="text-slate-400">
            Buffer Watchdog: <strong className="text-slate-200">10s Auto-Skip</strong>
          </span>
          <span aria-hidden="true" className="text-slate-700">
            |
          </span>
          <span className="text-slate-400">
            Status:{' '}
            <strong
              className={
                playerState === 'PLAYING'
                  ? 'text-emerald-400'
                  : playerState === 'PAUSED'
                  ? 'text-amber-400'
                  : playerState === 'BUFFERING'
                  ? 'text-sky-400'
                  : playerState === 'ERROR'
                  ? 'text-red-400'
                  : 'text-sky-400'
              }
            >
              {playerState}
            </strong>
          </span>
        </div>
      </div>

      {/* 16:9 Media Viewport */}
      <div className="relative aspect-video bg-[#05080F] overflow-hidden select-none">
        {!useCanvasFallback && activeFormat !== 'INTERACTIVE_CANVAS' ? (
          <video
            ref={videoRef}
            key={`${campaign.videoUrl}-${activeFormat}`}
            src={campaign.videoUrl}
            autoPlay
            preload="auto"
            muted={isMuted}
            playsInline
            onWaiting={() => {
              if (playerState === 'PLAYING') {
                setPlayerState('BUFFERING');
              }
            }}
            onStalled={() => {
              if (playerState === 'PLAYING') {
                setPlayerState('BUFFERING');
              }
            }}
            onPlaying={() => {
              bufferElapsedRef.current = 0;
              setBufferElapsedSec(0);
              if (playerState === 'BUFFERING') {
                setPlayerState('PLAYING');
              }
            }}
            onCanPlay={() => {
              bufferElapsedRef.current = 0;
              setBufferElapsedSec(0);
              if (playerState === 'BUFFERING') {
                setPlayerState('PLAYING');
              }
            }}
            onError={() => {
              bufferElapsedRef.current = 0;
              setBufferElapsedSec(0);
              setUseCanvasFallback(true);
              setPlayerState('PLAYING');
            }}
            className="w-full h-full object-cover opacity-85"
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            className="w-full h-full object-cover"
          />
        )}

        {/* Measured Contrast Scrim & Interactive HUD */}
        <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-6 bg-gradient-to-t from-black/90 via-black/35 to-black/65">
          {/* Top Metadata Strip (Viewer-Only Info) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-200 bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{campaign.advertiser}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-300">{campaign.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-emerald-400">
                Your Reward: ${projectedViewerRewardUsd.toFixed(2)} USD
              </span>
            </div>

            <div className="flex items-center gap-2 bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono tabular-nums">
              <span className="text-slate-300">Watched</span>
              <span className="text-emerald-400 font-bold text-sm">
                {watchedPct.toFixed(1)}%
              </span>
              <span aria-hidden="true" className="text-slate-600">
                |
              </span>
              <span className="text-slate-300">
                {sessionId || 'SES-ACTIVE'}
              </span>
            </div>
          </div>

          {/* 10-Second Buffering Watchdog Banner */}
          {playerState === 'BUFFERING' && (
            <div className="my-auto mx-auto bg-[#090D16]/90 backdrop-blur-md border border-sky-500/40 rounded-xl px-4 py-3 flex items-center gap-3 text-xs text-slate-200">
              <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
              <div className="space-y-0.5">
                <div className="font-semibold text-white">
                  Buffering Ad Stream ({bufferElapsedSec.toFixed(1)}s / {MAX_BUFFER_TIMEOUT_SEC}s)
                </div>
                <div className="text-slate-400 font-mono text-[11px]">
                  Auto-advancing to next ad in{' '}
                  {Math.max(0, MAX_BUFFER_TIMEOUT_SEC - bufferElapsedSec).toFixed(1)}s if stream stalls
                </div>
              </div>
              <button
                onClick={onSkipNext}
                className="ml-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium transition-colors whitespace-nowrap shrink-0"
              >
                Skip Now →
              </button>
            </div>
          )}

          {/* Center Brand Headline when running in Interactive Rich Media / Canvas mode */}
          {(useCanvasFallback || activeFormat === 'INTERACTIVE_CANVAS') &&
            playerState !== 'ERROR' &&
            playerState !== 'BUFFERING' && (
              <div className="my-auto max-w-lg mx-auto text-center space-y-2 px-4 pointer-events-none">
                <p className="text-xs font-mono text-emerald-400">
                  {campaign.advertiser} · {FORMAT_LABELS[activeFormat]}
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight text-balance">
                  {campaign.title}
                </h2>
                <p className="text-sm text-slate-300">{campaign.brandTagline}</p>
              </div>
            )}

          {/* ERROR State Recovery Overlay */}
          {playerState === 'ERROR' && (
            <div className="absolute inset-0 bg-[#090D16]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 space-y-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-bold text-white">
                  Ad Stream Interrupted ({watchedPct.toFixed(1)}% Preserved)
                </h3>
                <p className="text-xs text-slate-400">
                  {errorDetail ||
                    'The primary media container encountered a network interruption. Your watched progress and accrued reward remain locked in.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRecoverFromError}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resume Ad Stream</span>
                </button>
                <button
                  onClick={onSkipNext}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Skip to Next Ad
                </button>
              </div>
            </div>
          )}

          {/* Auto-Advance Queue Countdown Overlay */}
          {countdownRemaining !== null && (
            <div className="absolute inset-0 bg-[#090D16]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 space-y-4">
              <div className="text-xs font-mono text-emerald-400">
                100% Viewing Session Complete · +${projectedViewerRewardUsd.toFixed(2)} USD Added to Your Balance
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white max-w-md text-balance">
                Up Next in {countdownRemaining}s: {nextCampaignTitle || 'Next Commercial'}
              </h3>
              {typeof nextCampaignBaseRewardUsd === 'number' && (
                <p className="text-xs text-slate-400 font-mono tabular-nums">
                  Next Ad Reward: +${nextCampaignBaseRewardUsd.toFixed(2)} USD
                </p>
              )}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={onStartNextNow}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Start Next Spot Immediately
                </button>
                <button
                  onClick={onCancelAutoAdvance}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Pause Autoplay Queue
                </button>
              </div>
            </div>
          )}

          {/* Bottom Scrubber, Percentage Readout & Quartile Checkpoints */}
          <div className="space-y-2.5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {campaign.title}
                </h2>
                <p className="text-xs text-slate-300 line-clamp-1">
                  {campaign.brandTagline}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-slate-400">
                  Your Accrued Reward ({watchedPct.toFixed(0)}%)
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-400">
                  +${liveAccruedUsd.toFixed(2)} USD
                </div>
              </div>
            </div>

            {/* Segmented Progress Bar with 25% / 50% / 75% / 100% Quartile Ticks */}
            <div className="relative h-2.5 bg-slate-800/90 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${watchedPct}%` }}
              />
              {[25, 50, 75].map((q) => (
                <div
                  key={q}
                  style={{ left: `${q}%` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-950/90"
                  title={`${q}% Quartile Checkpoint`}
                />
              ))}
            </div>

            {/* Player Controls & Quartile Beacon Indicators */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTogglePlayPause}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  {playerState === 'PLAYING' ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onSkipNext}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Next Ad</span>
                </button>

                <button
                  onClick={onRestartSession}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg transition-colors"
                  title="Restart viewing session from 0%"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setIsMuted((m) => !m)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg transition-colors"
                  title={isMuted ? 'Unmute audio' : 'Mute audio'}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>

                <span className="text-xs font-mono tabular-nums text-slate-300 pl-1">
                  {elapsedSec.toFixed(1)}s / {campaign.durationSec.toFixed(1)}s ({watchedPct.toFixed(1)}%)
                </span>
              </div>

              {/* Quartile Verification Status */}
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                <span className="text-slate-400">Progress Checkpoints:</span>
                {[25, 50, 75, 100].map((q) => {
                  const reached = quartilesReached.includes(q);
                  return (
                    <span
                      key={q}
                      className={
                        reached ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                      }
                    >
                      {reached ? '✓' : '○'} {q}%
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Personal Reward Summary */}
      <div className="p-4 bg-[#0F172A] border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-300">
          <span className="font-medium text-white">Your Session Reward:</span>
          <span>
            Guaranteed Ad Reward{' '}
            <strong className="font-mono text-emerald-400">
              +${viewerBaseRewardUsd.toFixed(2)} USD
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={campaign.ctaUrl}
            target="_blank"
            rel="noreferrer"
            className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <span>Sponsor Link</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
