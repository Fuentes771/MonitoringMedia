import React from 'react';
import { Eye, Globe, Heart, MessageCircle, Repeat2, Rss, Video } from 'lucide-react';

export const SOCIAL_PROVIDER_KEYS = ['x', 'twitter', 'tiktok', 'instagram', 'facebook', 'youtube', 'reddit'] as const;

export function isSocialProvider(provider?: string | null): boolean {
  if (!provider) return false;
  return SOCIAL_PROVIDER_KEYS.includes(provider.toLowerCase().trim() as (typeof SOCIAL_PROVIDER_KEYS)[number]);
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
        pillClass: 'bg-zinc-900 text-zinc-100 border-zinc-700/80',
        iconColorClass: 'text-zinc-100',
      };
    case 'tiktok':
      return {
        key: 'tiktok',
        label: 'TikTok',
        shortLabel: 'TikTok',
        pillClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
        iconColorClass: 'text-cyan-400',
      };
    case 'instagram':
      return {
        key: 'instagram',
        label: 'Instagram',
        shortLabel: 'IG',
        pillClass: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
        iconColorClass: 'text-pink-400',
      };
    case 'facebook':
      return {
        key: 'facebook',
        label: 'Facebook',
        shortLabel: 'FB',
        pillClass: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
        iconColorClass: 'text-blue-400',
      };
    case 'youtube':
      return {
        key: 'youtube',
        label: 'YouTube',
        shortLabel: 'YouTube',
        pillClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
        iconColorClass: 'text-rose-400',
      };
    case 'rss':
      return {
        key: 'rss',
        label: 'Berita RSS',
        shortLabel: 'RSS',
        pillClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        iconColorClass: 'text-amber-400',
      };
    case 'reddit':
      return {
        key: 'reddit',
        label: 'Reddit',
        shortLabel: 'Reddit',
        pillClass: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
        iconColorClass: 'text-orange-400',
      };
    default:
      return {
        key,
        label: key.toUpperCase(),
        shortLabel: key.toUpperCase(),
        pillClass: 'bg-white/[0.05] text-zinc-300 border-white/10',
        iconColorClass: 'text-zinc-400',
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
  className?: string;
}> = ({ provider, size = 'xs', compactLabel = false, isComment = false, className = '' }) => {
  const meta = getPlatformMeta(provider);
  const padding = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`inline-flex items-center gap-1 rounded border font-mono-code uppercase tracking-wide ${padding} ${meta.pillClass}`}
      >
        <PlatformIcon provider={provider} className={iconSize} />
        <span>{compactLabel ? meta.shortLabel : meta.label}</span>
      </span>
      {isComment && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono-code">
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
}> = ({ metrics, likesFallback = null, metricsAvailable, showUnavailableHint = false, className = '' }) => {
  const likes = pickFirstNumber(metrics?.likes, metrics?.favorite_count, metrics?.digg_count, metrics?.reactions_count, likesFallback);
  const comments = pickFirstNumber(metrics?.comments, metrics?.comments_count, metrics?.reply_count, metrics?.comment_count, metrics?.replies);
  const shares = pickFirstNumber(metrics?.shares, metrics?.shares_count, metrics?.retweet_count, metrics?.share_count, metrics?.retweets);
  const views = pickFirstNumber(metrics?.views, metrics?.view_count, metrics?.play_count);

  const hasAnyMetric = likes !== null || comments !== null || shares !== null || views !== null;

  if (!hasAnyMetric || metricsAvailable === false) {
    if (!showUnavailableHint) return null;
    return (
      <span className={`text-[10px] text-zinc-500 font-mono-code ${className}`}>
        Metrik: -
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center flex-wrap gap-3 text-[11px] font-mono-code font-tabular text-zinc-400 ${className}`}>
      {likes !== null && (
        <span className="inline-flex items-center gap-1" title="Likes">
          <Heart className="w-3 h-3 text-rose-400/80" aria-hidden="true" />
          <span>{formatCompactCount(likes)}</span>
        </span>
      )}
      {comments !== null && (
        <span className="inline-flex items-center gap-1" title="Komentar">
          <MessageCircle className="w-3 h-3 text-indigo-400/80" aria-hidden="true" />
          <span>{formatCompactCount(comments)}</span>
        </span>
      )}
      {shares !== null && (
        <span className="inline-flex items-center gap-1" title="Bagikan / Repost">
          <Repeat2 className="w-3 h-3 text-emerald-400/80" aria-hidden="true" />
          <span>{formatCompactCount(shares)}</span>
        </span>
      )}
      {views !== null && (
        <span className="inline-flex items-center gap-1" title="Tayangan">
          <Eye className="w-3 h-3 text-zinc-400" aria-hidden="true" />
          <span>{formatCompactCount(views)}</span>
        </span>
      )}
    </div>
  );
};

