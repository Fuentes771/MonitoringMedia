import { ExternalLink, Rss, Video, Globe, Calendar, Tag } from 'lucide-react';
import { MentionItem } from '@/lib/api';

interface MentionListProps {
  mentions: MentionItem[];
  isLoading: boolean;
}

export function MentionList({ mentions, isLoading }: MentionListProps) {
  const getPlatformIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'rss':
        return <Rss className="w-3.5 h-3.5 text-amber-400" />;
      case 'youtube':
        return <Video className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const getSentimentBadge = (label?: string, confidence?: number) => {
    const confStr = confidence ? `${Math.round(confidence * 100)}%` : '';
    switch (label) {
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span>Positif</span>
            {confStr && <span className="font-mono text-[10px] opacity-80">({confStr})</span>}
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span>Negatif</span>
            {confStr && <span className="font-mono text-[10px] opacity-80">({confStr})</span>}
          </span>
        );
      case 'neutral':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-500/10 text-slate-300 border border-slate-500/20">
            <span>Netral</span>
            {confStr && <span className="font-mono text-[10px] opacity-80">({confStr})</span>}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <span>Unknown</span>
          </span>
        );
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB';
    } catch {
      return iso;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 animate-pulse space-y-3">
            <div className="h-4 bg-slate-800 rounded w-1/4"></div>
            <div className="h-3 bg-slate-800 rounded w-3/4"></div>
            <div className="h-3 bg-slate-800 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (mentions.length === 0) {
    return (
      <div className="p-12 text-center border border-slate-800 rounded-xl bg-slate-900/40">
        <p className="text-sm text-slate-400 mb-2">Tidak ada mention yang cocok dengan filter aktif.</p>
        <p className="text-xs text-slate-500">Coba ubah kata kunci pencarian, rentang tanggal, atau filter platform.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mentions.map((item) => (
        <article
          key={item.id}
          className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700/80 transition-all space-y-3"
        >
          {/* Header Row: Platform, Author, Timestamp, Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-medium">
                {getPlatformIcon(item.provider)}
                <span className="uppercase tracking-wider text-[10px]">{item.provider}</span>
              </span>

              {item.author_name && (
                <span className="font-semibold text-slate-300">
                  {item.author_name}
                </span>
              )}

              <span className="text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatTimestamp(item.published_at)}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {item.is_demo && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  DEMO DATA
                </span>
              )}
              {getSentimentBadge(item.sentiment?.label, item.sentiment?.confidence)}
            </div>
          </div>

          {/* Text Content */}
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {item.text}
          </p>

          {/* Footer Row: Keywords, Topic Match, External Source Link */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-850 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {item.topics && item.topics.map((t) => (
                <span key={t.id} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {t.name}
                </span>
              ))}

              {item.keywords && item.keywords.map((kw, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5 text-slate-500" />
                  <span>{kw.keyword}</span>
                </span>
              ))}
            </div>

            {item.source_url ? (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium hover:underline"
              >
                <span>Buka Sumber Asli</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-[11px] text-slate-500 italic">URL tidak tersedia</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
