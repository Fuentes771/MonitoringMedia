import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

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

export interface LivePreviewItem {
  id: string;
  provider: string;
  author_name: string;
  source_url: string;
  text: string;
  published_at: string;
  metrics?: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
  };
  source?: string;
}

export interface LivePreviewResponse {
  status: string;
  provider: string;
  query: string;
  latency_ms: number;
  engine: string;
  count: number;
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
  author_name: string | null;
  published_at: string;
  text: string;
  language: string;
  is_demo: boolean;
  metadata_json?: {
    is_comment?: boolean;
    parent_external_id?: string;
    likes?: number;
    metrics?: Record<string, any>;
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
  text: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  likes: number;
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


