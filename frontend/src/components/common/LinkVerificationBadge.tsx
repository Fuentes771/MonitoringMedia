import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FlaskConical,
  Link2Off,
  Search,
} from 'lucide-react';
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
          cls: 'bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border-[var(--sentiment-pos-border)]',
          icon: <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />,
        };
      case 'verified_article':
        return {
          text: compact ? 'Artikel' : 'Artikel Media',
          cls: 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-medium)]',
          icon: <CheckCircle2 className="w-3 h-3 shrink-0 text-[var(--accent-gold-text)]" aria-hidden="true" />,
        };
      case 'search_fallback':
        return {
          text: 'Perlu Verifikasi',
          cls: 'bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border-[var(--accent-gold-border)]',
          icon: <Search className="w-3 h-3 shrink-0" aria-hidden="true" />,
        };
      case 'broken_legacy':
        return {
          text: 'Tautan Rusak',
          cls: 'bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border-[var(--sentiment-neg-border)]',
          icon: <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />,
        };
      case 'demo_placeholder':
        return {
          text: 'Data Simulasi',
          cls: 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]',
          icon: <FlaskConical className="w-3 h-3 shrink-0" aria-hidden="true" />,
        };
      default:
        return {
          text: 'Tanpa Tautan',
          cls: 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]',
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
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10.5px] font-medium ${badgeSpec.cls}`}
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
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[10.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-[var(--sentiment-pos)]" aria-hidden="true" />
              <span className="text-[var(--sentiment-pos)]">Disalin</span>
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
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10.5px] font-medium transition-colors ${
            inspected.isSearchFallback
              ? 'text-[var(--accent-gold-text)] border-[var(--accent-gold-border)] bg-[var(--accent-gold-subtle)]'
              : 'text-[var(--text-primary)] border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
          }`}
        >
          <span>{resolvedActionLabel}</span>
          <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
        </a>
      )}
    </div>
  );
};
