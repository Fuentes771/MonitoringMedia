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
  provider: string;
  status: 'connected' | 'needs_config' | 'rate_limited' | 'degraded' | 'disconnected';
  last_sync: string | null;
}

export interface CoverageInfo {
  connected_providers: number;
  total_configured_providers: number;
  last_successful_sync_at: string | null;
  partial_data: boolean;
  connectors: ConnectorStatus[];
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
