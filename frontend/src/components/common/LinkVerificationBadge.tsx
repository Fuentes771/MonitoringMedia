import React, { useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, FlaskConical, Link2Off, Search } from 'lucide-react';
import type { SocialLinkStatusType } from '../../lib/api';
import { inspectSocialLink } from '../../utils/socialLink';
import { getPlatformMeta } from './PlatformBadge';

interface LinkVerificationBadgeProps {
  provider?: string | null;
  sourceUrl?: string | null;
  linkStatus?: SocialLinkStatusType | null;
  isDemo?: boolean;
  fallbackQuery?: string | null;
  showCopyButton?: boolean;
  showActionLink?: boolean;
  compact?: boolean;
  actionLabel?: string;
  stopPropagation?: boolean;
  className?: string;
}

export const LinkVerificationBadge: React.FC<LinkVerificationBadgeProps> = ({
  provider,
  sourceUrl,
  linkStatus,
  isDemo = false,
  fallbackQuery,
  showCopyButton = false,
  showActionLink = false,
  compact = false,
  actionLabel,
  stopPropagation = false,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const inspected = inspectSocialLink({
    provider,
    sourceUrl,
    linkStatus,
    isDemo,
    fallbackQuery,
  });

  const meta = getPlatformMeta(provider);

  const badgeSpec = (() => {
    switch (inspected.status) {
      case 'verified_post':
        return {
          text: compact ? 'Terverifikasi' : 'Tautan Terverifikasi',
          cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
          icon: <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />,
        };
      case 'verified_article':
        return {
          text: compact ? 'Artikel' : 'Artikel Media',
          cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
          icon: <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />,
        };
      case 'search_fallback':
        return {
          text: 'Perlu Verifikasi',
          cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          icon: <Search className="w-3 h-3 shrink-0" aria-hidden="true" />,
        };
      case 'broken_legacy':
        return {
          text: 'Tautan Rusak',
          cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
          icon: <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />,
        };
      case 'demo_placeholder':
        return {
          text: 'Data Simulasi',
          cls: 'bg-zinc-800/80 text-zinc-400 border-zinc-700',
          icon: <FlaskConical className="w-3 h-3 shrink-0" aria-hidden="true" />,
        };
      default:
        return {
          text: 'Tanpa Tautan',
          cls: 'bg-zinc-800/60 text-zinc-500 border-zinc-800',
          icon: <Link2Off className="w-3 h-3 shrink-0" aria-hidden="true" />,
        };
    }
  })();

  const handleCopy = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (!inspected.href) return;
    navigator.clipboard.writeText(inspected.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const resolvedActionLabel = (() => {
    if (actionLabel) return actionLabel;
    if (inspected.isSearchFallback) return `Cari di ${meta.shortLabel}`;
    if (meta.key === 'youtube' || meta.key === 'tiktok') return 'Buka Video';
    if (meta.key === 'rss') return 'Baca Artikel';
    return 'Buka Postingan';
  })();

  return (
    <div className={`inline-flex items-center flex-wrap gap-1.5 ${className}`}>
      <span
        title={inspected.reason}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono-code ${badgeSpec.cls}`}
      >
        {badgeSpec.icon}
        <span>{badgeSpec.text}</span>
      </span>

      {showCopyButton && inspected.href && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Tautan berhasil disalin' : 'Salin tautan sumber'}
          title="Salin tautan sumber"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-[10px] text-zinc-300 hover:text-white font-mono-code transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-300">Disalin</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" aria-hidden="true" />
              <span>Salin</span>
            </>
          )}
        </button>
      )}

      {showActionLink && inspected.isExternalNavigable && inspected.href && (
        <a
          href={inspected.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation();
          }}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
            inspected.isSearchFallback
              ? 'text-amber-300 hover:text-amber-200 border border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/20'
              : 'text-zinc-300 hover:text-white border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.09]'
          }`}
        >
          <span>{resolvedActionLabel}</span>
          <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
        </a>
      )}
    </div>
  );
};

