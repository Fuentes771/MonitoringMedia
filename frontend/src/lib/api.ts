import axios from 'axios';
import { getAuthToken } from './authStorage';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url ?? '');
    const isAuthMutation =
      requestUrl.includes('/auth/login') || requestUrl.includes('/auth/logout');

    if (status === 401 && !isAuthMutation && unauthorizedHandler) {
      unauthorizedHandler();
    }

    return Promise.reject(error);
  }
);

export type WorkspaceRole = 'operator';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export interface WorkspaceInfo {
  id: number;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface LoginPayload {
  email: string;
  password: string;
  remember: boolean;
}

export interface LoginResponse {
  status: string;
  token: string;
  expires_at: string;
  user: AuthUser;
  active_workspace: WorkspaceInfo | null;
  workspaces: WorkspaceInfo[];
}

export interface AuthMeResponse {
  user: AuthUser;
  active_workspace: WorkspaceInfo | null;
  workspaces: WorkspaceInfo[];
  token_expires_at?: string | null;
}

export interface MetaInfo {
  timezone: string;
  from: string;
  to: string;
  generated_at: string;
  is_demo: boolean;
}

export interface ConnectorStatus {
  id?: number;
  provider: string;
  status: 'connected' | 'needs_config' | 'rate_limited' | 'degraded' | 'disconnected';
  last_sync?: string | null;
  last_successful_sync_at?: string | null;
  has_credentials?: boolean;
  has_local_engine?: boolean;
  has_rapidapi?: boolean;
  engine_mode?: 'hybrid' | 'local' | 'rapidapi' | 'default';
  capabilities?: Record<string, any>;
}

export type SocialLinkStatusType =
  | 'verified_post'
  | 'verified_article'
  | 'search_fallback'
  | 'broken_legacy'
  | 'demo_placeholder'
  | 'unavailable';

export interface LivePreviewItem {
  id: string;
  provider: string;
  author_name: string;
  author_handle?: string;
  source_url: string | null;
  link_status?: SocialLinkStatusType;
  text: string;
  published_at: string;
  metrics_available?: boolean;
  metrics?: {
    likes?: number | null;
    shares?: number | null;
    comments?: number | null;
    views?: number | null;
  } | null;
  source?: string;
}

export interface LivePreviewResponse {
  status: string;
  provider: string;
  query: string;
  latency_ms: number;
  engine: string;
  count: number;
  verified_count?: number;
  fallback_count?: number;
  engine_status?: string;
  status_message?: string;
  items: LivePreviewItem[];
}

export interface CoverageInfo {
  connected_providers: number;
  total_configured_providers: number;
  last_successful_sync_at: string | null;
  partial_data: boolean;
  connectors: ConnectorStatus[];
}

export interface ChronologicalEvent {
  id: number;
  time_label: string;
  program_name: string;
  headline: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  source: string;
  url: string | null;
  provider?: string;
  link_status?: SocialLinkStatusType;
}

export interface HourlyVelocityPoint {
  time_label: string;
  count: number;
  positive: number;
  negative: number;
}

export interface DailyBriefingInfo {
  window_label: string;
  start: string;
  end: string;
  total_mentions: number;
  positive: number;
  neutral: number;
  negative: number;
  pos_percent: number;
  neu_percent: number;
  neg_percent: number;
  top_programs: Array<{
    id: number;
    name: string;
    mentions: number;
  }>;
  chronological_events?: ChronologicalEvent[];
  hourly_velocity?: HourlyVelocityPoint[];
  ai_summary?: string;
}

export interface DashboardOverview {
  meta: MetaInfo;
  coverage: CoverageInfo;
  kpis: {
    total_mentions: number;
    mentions_change_percent: number;
    negative_share_percent: number;
    rising_topics_count: number;
  };
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    unknown: number;
  };
  platform_breakdown: Record<string, number>;
  daily_briefing?: DailyBriefingInfo;
}

export interface TimelinePoint {
  date: string;
  label: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  unknown: number;
}

export interface MentionItem {
  id: number;
  provider: string;
  external_id: string;
  source_url: string | null;
  link_status?: SocialLinkStatusType;
  author_name: string | null;
  published_at: string;
  text: string;
  language: string;
  is_demo: boolean;
  is_sarcasm?: boolean;
  is_inauthentic?: boolean;
  inauthentic_score?: number;
  bot_cluster_id?: string | null;
  metadata_json?: {
    is_comment?: boolean;
    parent_external_id?: string;
    likes?: number | null;
    metrics?: Record<string, any> | null;
    metrics_available?: boolean;
    link_status?: SocialLinkStatusType;
    link_checked_at?: string;
    link_reason?: string | null;
    author_handle?: string;
    sarcasm_analysis?: {
      is_sarcasm: boolean;
      sarcasm_score: number;
      sarcasm_reason: string;
      sarcasm_markers?: string[];
    };
    bot_analysis?: {
      is_inauthentic: boolean;
      inauthentic_score: number;
      bot_signals: string[];
    };
    [key: string]: any;
  } | null;
  sentiment?: {
    label: 'positive' | 'neutral' | 'negative' | 'unknown';
    confidence: number;
    probabilities_json: {
      positive: number;
      neutral: number;
      negative: number;
    } | null;
  };
  keywords?: Array<{ keyword: string; score: number }>;
  topics?: Array<{ id: number; name: string }>;
}

export interface TopicItem {
  id: number;
  workspace_id: number;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'archived';
  providers: string[];
  mentions_count: number;
  positive_count?: number;
  neutral_count?: number;
  negative_count?: number;
  keywords: Array<{ id: number; keyword: string; type: 'include' | 'exclude' }>;
  trend_snapshots?: Array<{
    score: number;
    sample_count: number;
    explanation: string;
  }>;
}

export interface AlertEventItem {
  id: number;
  alert_id: number;
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive';
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence_json: {
    topic_name?: string;
    negative_share_percent?: number;
    threshold_percent?: number;
    sample_count?: number;
    driving_keywords?: string[];
    sample_text?: string;
  } | null;
  triggered_at: string;
  alert?: {
    id: number;
    type: string;
    topic?: { id: number; name: string };
  };
}

export interface AiGatewayStatus {
  service: string;
  '9router': {
    status: 'online' | 'degraded' | 'offline';
    base_url?: string;
    default_model?: string;
    latency_ms?: number;
    available_models?: string[];
    error?: string;
  };
}

export interface AiCitation {
  index: number;
  mention_id: number;
  author: string;
  published_at: string;
  sentiment: string;
  url: string;
  snippet: string;
}

export interface AiChatResponse {
  answer: string;
  citations: AiCitation[];
  mentions_count: number;
  grounded: boolean;
  engine: string;
  model?: string;
  topic_filtered?: string | null;
}

export interface AiTopicSummary {
  topic_name: string;
  mentions_analyzed: number;
  executive_overview: string;
  dominant_sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  key_positive_themes: string[];
  key_critical_themes: string[];
  geographic_or_sector_notes?: string;
  strategic_recommendations: string[];
  engine?: string;
  model?: string;
  cached_at?: string;
}

export interface HotIssueQuote {
  id: number;
  platform: string;
  author: string;
  source_url: string | null;
  link_status?: SocialLinkStatusType;
  text: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  likes: number | null;
  metrics_available?: boolean;
  is_comment: boolean;
  time_label: string;
}

export interface HotIssueItem {
  id: number;
  title: string;
  description: string;
  urgency_level: 'normal' | 'elevated' | 'critical';
  surge_multiplier: number;
  total_mentions_33h: number;
  negative_share_percent: number;
  status: 'surging' | 'stabilizing' | 'resolved';
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    pos_percent: number;
    neu_percent: number;
    neg_percent: number;
  };
  hourly_velocity: Array<{
    time_label: string;
    count: number;
    positive: number;
    negative: number;
  }>;
  netizen_quotes: HotIssueQuote[];
  ai_synthesis?: string;
}

export interface HotIssuesRadarData {
  window_label: string;
  window_start: string;
  window_end: string;
  system_state: 'surging_detected' | 'elevated' | 'normal_calm';
  surging_count: number;
  hot_issues: HotIssueItem[];
}

export interface CopypastaCluster {
  cluster_id: string;
  canonical_text: string;
  copy_count: number;
  unique_accounts_count: number;
  accounts: string[];
  platforms: string[];
  narrative_agenda: string;
  similarity_avg: number;
  topic_name: string;
  first_seen: string;
  last_seen: string;
}

export interface BurstTimelinePoint {
  time_label: string;
  organic: number;
  inauthentic: number;
  sarcasm: number;
  total: number;
}

export interface SarcasmHighlight {
  id: number;
  provider: string;
  author_name: string;
  text: string;
  source_url: string | null;
  link_status?: SocialLinkStatusType;
  published_at?: string;
  time_label: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  sarcasm_score: number;
  sarcasm_reason: string;
  sarcasm_markers: string[];
  topic_name: string;
}

export interface SuspectedBotAccount {
  author_name: string;
  provider: string;
  post_count: number;
  avg_bot_score: number;
  cluster_id: string | null;
  signals: string[];
  sample_text: string;
}

export interface BuzzerRadarOverview {
  authenticity_index: {
    total_mentions: number;
    organic_count: number;
    inauthentic_count: number;
    sarcasm_count: number;
    organic_percent: number;
    inauthentic_percent: number;
    sarcasm_percent: number;
    threat_level: 'HIGH_ASTROTURFING' | 'ELEVATED_PROPAGANDA' | 'NORMAL_ORGANIC';
    clusters_count: number;
  };
  copypasta_clusters: CopypastaCluster[];
  burst_timeline: BurstTimelinePoint[];
  sarcasm_highlights: SarcasmHighlight[];
  suspected_accounts: SuspectedBotAccount[];
}



