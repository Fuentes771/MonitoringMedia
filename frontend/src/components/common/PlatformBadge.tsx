import React from 'react';
import { Eye, Globe, Heart, MessageCircle, Repeat2, Rss, Video } from 'lucide-react';

export const SOCIAL_PROVIDER_KEYS = [
  'x',
  'twitter',
  'tiktok',
  'instagram',
  'facebook',
  'threads',
  'youtube',
  'reddit',
] as const;

export function isSocialProvider(provider?: string | null): boolean {
  if (!provider) return false;
  return SOCIAL_PROVIDER_KEYS.includes(
    provider.toLowerCase().trim() as (typeof SOCIAL_PROVIDER_KEYS)[number]
  );
}

export interface PlatformMetaInfo {
  key: string;
  label: string;
  shortLabel: string;
  pillClass: string;
  iconColorClass: string;
}

export function getPlatformMeta(provider?: string | null): PlatformMetaInfo {
  const key = (provider || 'unknown').toLowerCase().trim();

  switch (key) {
    case 'x':
    case 'twitter':
      return {
        key: 'x',
        label: 'X (Twitter)',
        shortLabel: 'X',
        pillClass:
          'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-medium)]',
        iconColorClass: 'text-[var(--text-primary)]',
      };
    case 'tiktok':
      return {
        key: 'tiktok',
        label: 'TikTok',
        shortLabel: 'TikTok',
        pillClass:
          'bg-teal-600/10 text-teal-800 border-teal-700/25 dark:bg-teal-400/12 dark:text-teal-300 dark:border-teal-400/30',
        iconColorClass: 'text-teal-700 dark:text-teal-300',
      };
    case 'instagram':
      return {
        key: 'instagram',
        label: 'Instagram',
        shortLabel: 'IG',
        pillClass:
          'bg-rose-600/10 text-rose-800 border-rose-700/25 dark:bg-rose-400/12 dark:text-rose-300 dark:border-rose-400/30',
        iconColorClass: 'text-rose-700 dark:text-rose-300',
      };
    case 'facebook':
      return {
        key: 'facebook',
        label: 'Facebook',
        shortLabel: 'FB',
        pillClass:
          'bg-blue-600/10 text-blue-800 border-blue-700/25 dark:bg-blue-400/12 dark:text-blue-300 dark:border-blue-400/30',
        iconColorClass: 'text-blue-700 dark:text-blue-300',
      };
    case 'threads':
      return {
        key: 'threads',
        label: 'Threads',
        shortLabel: 'Threads',
        pillClass:
          'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-medium)]',
        iconColorClass: 'text-[var(--text-primary)]',
      };
    case 'youtube':
      return {
        key: 'youtube',
        label: 'YouTube',
        shortLabel: 'YouTube',
        pillClass:
          'bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border-[var(--sentiment-neg-border)]',
        iconColorClass: 'text-[var(--sentiment-neg)]',
      };
    case 'rss':
      return {
        key: 'rss',
        label: 'Berita RSS',
        shortLabel: 'RSS',
        pillClass:
          'bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border-[var(--accent-gold-border)]',
        iconColorClass: 'text-[var(--accent-gold-text)]',
      };
    case 'reddit':
      return {
        key: 'reddit',
        label: 'Reddit',
        shortLabel: 'Reddit',
        pillClass:
          'bg-orange-600/10 text-orange-800 border-orange-700/25 dark:bg-orange-400/12 dark:text-orange-300 dark:border-orange-400/30',
        iconColorClass: 'text-orange-700 dark:text-orange-300',
      };
    default:
      return {
        key,
        label: key.toUpperCase(),
        shortLabel: key.toUpperCase(),
        pillClass:
          'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
        iconColorClass: 'text-[var(--text-secondary)]',
      };
  }
}

export const PlatformIcon: React.FC<{ provider?: string | null; className?: string }> = ({
  provider,
  className = 'w-3.5 h-3.5',
}) => {
  const key = (provider || '').toLowerCase().trim();
  const meta = getPlatformMeta(key);

  switch (key) {
    case 'x':
    case 'twitter':
      return (
        <svg className={`${className} ${meta.iconColorClass}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg className={`${className} ${meta.iconColorClass}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg
          className={`${className} ${meta.iconColorClass}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case 'facebook':
      return (
        <svg className={`${className} ${meta.iconColorClass}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.82 0-1.666.28-1.666 1.369v2.611h3.708l-.571 3.667h-3.137v7.98H9.101z" />
        </svg>
      );
    case 'threads':
      return (
        <svg
          className={`${className} ${meta.iconColorClass}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12a7 7 0 1 0-3.2 5.9" />
          <path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4.1 7.5" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      );
    case 'youtube':
      return <Video className={`${className} ${meta.iconColorClass}`} aria-hidden="true" />;
    case 'rss':
      return <Rss className={`${className} ${meta.iconColorClass}`} aria-hidden="true" />;
    default:
      return <Globe className={`${className} ${meta.iconColorClass}`} aria-hidden="true" />;
  }
};

export const PlatformBadge: React.FC<{
  provider?: string | null;
  size?: 'xs' | 'sm';
  compactLabel?: boolean;
  isComment?: boolean;
  ingestionSource?: string | null;
  className?: string;
}> = ({
  provider,
  size = 'xs',
  compactLabel = false,
  isComment = false,
  ingestionSource = null,
  className = '',
}) => {
  const meta = getPlatformMeta(provider);
  const padding = size === 'xs' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs';
  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const isMuseSource =
    typeof ingestionSource === 'string' && ingestionSource.toLowerCase().includes('muse');

  return (
    <span className={`inline-flex items-center flex-wrap gap-1.5 ${className}`}>
      <span
        className={`inline-flex items-center gap-1 rounded-lg border font-semibold ${padding} ${meta.pillClass}`}
      >
        <PlatformIcon provider={provider} className={iconSize} />
        <span>{compactLabel ? meta.shortLabel : meta.label}</span>
      </span>
      {isMuseSource && (
        <span
          title="Ditarik melalui konektor resmi Meta via Muse"
          className="inline-flex items-center px-1.5 py-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[10px] font-medium"
        >
          via Muse
        </span>
      )}
      {isComment && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[10px] font-medium">
          <MessageCircle className="w-2.5 h-2.5" aria-hidden="true" />
          <span>Komentar</span>
        </span>
      )}
    </span>
  );
};

function formatCompactCount(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(val);
}

function pickFirstNumber(...vals: Array<unknown>): number | null {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  }
  return null;
}

export const SocialEngagementBar: React.FC<{
  metrics?: Record<string, unknown> | null;
  likesFallback?: number | null;
  metricsAvailable?: boolean;
  showUnavailableHint?: boolean;
  className?: string;
}> = ({
  metrics,
  likesFallback = null,
  metricsAvailable,
  showUnavailableHint = false,
  className = '',
}) => {
  const likes = pickFirstNumber(
    metrics?.likes,
    metrics?.favorite_count,
    metrics?.digg_count,
    metrics?.reactions_count,
    likesFallback
  );
  const comments = pickFirstNumber(
    metrics?.comments,
    metrics?.comments_count,
    metrics?.reply_count,
    metrics?.comment_count,
    metrics?.replies
  );
  const shares = pickFirstNumber(
    metrics?.shares,
    metrics?.shares_count,
    metrics?.retweet_count,
    metrics?.share_count,
    metrics?.retweets
  );
  const views = pickFirstNumber(metrics?.views, metrics?.view_count, metrics?.play_count);

  const hasAnyMetric = likes !== null || comments !== null || shares !== null || views !== null;

  if (!hasAnyMetric || metricsAvailable === false) {
    if (!showUnavailableHint) return null;
    return (
      <span className={`text-[11px] text-[var(--text-muted)] font-tabular ${className}`}>
        Metrik tidak tersedia
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center flex-wrap gap-3 text-[11px] font-tabular text-[var(--text-secondary)] ${className}`}>
      {likes !== null && (
        <span className="inline-flex items-center gap-1" title="Suka">
          <Heart className="w-3 h-3 text-[var(--sentiment-neg)]" aria-hidden="true" />
          <span>{formatCompactCount(likes)}</span>
        </span>
      )}
      {comments !== null && (
        <span className="inline-flex items-center gap-1" title="Komentar">
          <MessageCircle className="w-3 h-3 text-[var(--text-muted)]" aria-hidden="true" />
          <span>{formatCompactCount(comments)}</span>
        </span>
      )}
      {shares !== null && (
        <span className="inline-flex items-center gap-1" title="Bagikan / Repost">
          <Repeat2 className="w-3 h-3 text-[var(--sentiment-pos)]" aria-hidden="true" />
          <span>{formatCompactCount(shares)}</span>
        </span>
      )}
      {views !== null && (
        <span className="inline-flex items-center gap-1" title="Tayangan">
          <Eye className="w-3 h-3 text-[var(--text-muted)]" aria-hidden="true" />
          <span>{formatCompactCount(views)}</span>
        </span>
      )}
    </div>
  );
};
