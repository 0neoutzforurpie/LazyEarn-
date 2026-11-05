export type AdFormatType = 'MP4_DIRECT' | 'VAST_4_XML' | 'HLS_ADAPTIVE' | 'INTERACTIVE_CANVAS';

export type PlayerLifecycleState =
  | 'IDLE'
  | 'BUFFERING'
  | 'PLAYING'
  | 'PAUSED'
  | 'ERROR'
  | 'COMPLETED';

export interface TelemetryBeaconEvent {
  id: string;
  timestamp: string;
  campaignId: string;
  campaignTitle: string;
  adFormat: AdFormatType;
  eventType:
    | 'IMPRESSION_START'
    | 'QUARTILE_25'
    | 'QUARTILE_50'
    | 'QUARTILE_75'
    | 'COMPLETE_100'
    | 'MULTIPLIER_LOCKED'
    | 'STATE_PLAY'
    | 'STATE_PAUSE'
    | 'STREAM_ERROR'
    | 'FAILOVER_RECOVERY';
  watchedPct: number;
  accruedUsd: number;
  detail: string;
}

export interface LivePlayerTelemetry {
  campaignId: string;
  campaignTitle: string;
  advertiser: string;
  adFormat: AdFormatType;
  playerState: PlayerLifecycleState;
  watchedPct: number;
  elapsedSec: number;
  durationSec: number;
  liveAccruedUsd: number;
  projectedTotalUsd: number;
  multiplierApplied: number;
  quartilesReached: number[];
}

export interface InteractivePrompt {
  question: string;
  options: string[];
  multiplier: number; // Bounded between 1.20x and 1.35x so user reward never exceeds ad revenue
  triggerAtPct: number;
}

export interface AdCampaign {
  id: string;
  title: string;
  advertiser: string;
  category: string;
  adFormat?: AdFormatType;
  durationSec: number;
  videoUrl: string;
  vastTagUrl?: string;
  viewerBaseRewardUsd: number; // Viewer's personal base reward (50% of ad revenue)
  maxBoostedRewardUsd: number; // Viewer's max possible reward with bonus (capped strictly <= 70% of ad revenue)
  accentColor: string;
  brandTagline: string;
  ctaUrl: string;
  interactivePrompt: InteractivePrompt;
  isCustomVast?: boolean;
}

export interface ViewingSession {
  id: string;
  campaignId: string;
  campaignTitle: string;
  advertiser: string;
  category: string;
  startedAt: string;
  completedAt: string;
  watchedSeconds: number;
  durationSec: number;
  quartilesReached: number[];
  viewerBaseUsd: number;
  multiplierApplied: number;
  selectedPromptAnswer?: string;
  bonusUsd: number;
  netEarnedUsd: number;
  verificationHash: string;
  status: 'COMPLETED' | 'IN_PROGRESS';
}

export interface PayPalPayout {
  id: string;
  paypalBatchId: string;
  paypalPayoutItemId: string;
  recipientEmail: string;
  amountUsd: number;
  feeUsd: number;
  netPayoutUsd: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  completedAt?: string;
  transactionNote: string;
  verificationSignature: string;
}

export interface WalletState {
  isAuthenticated: boolean;
  paypalEmail: string;
  paypalDisplayName: string;
  paypalVerified: boolean;
  minWithdrawalUsd: number;
  availableBalanceUsd: number;
  pendingPayoutUsd: number;
  lifetimeEarnedUsd: number;
  lifetimePaidUsd: number;
  completedSessionsCount: number;
  activeStreak: number;
}

export interface DashboardPayload {
  wallet: WalletState;
  campaigns: AdCampaign[];
  sessions: ViewingSession[];
  payouts: PayPalPayout[];
}
