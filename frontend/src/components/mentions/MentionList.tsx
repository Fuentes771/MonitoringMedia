import { useState } from 'react';
import { ExternalLink, Rss, Video, Globe, Calendar, Tag, Eye, MessageSquare } from 'lucide-react';
import { MentionItem } from '@/lib/api';
import { MentionInspectorDrawer } from './MentionInspectorDrawer';

interface MentionListProps {
  mentions: MentionItem[];
  isLoading: boolean;
}

export function MentionList({ mentions, isLoading }: MentionListProps) {
  const [selectedMention, setSelectedMention] = useState<MentionItem | null>(null);

  const getPlatformIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'rss':
        return <Rss className="w-3.5 h-3.5 text-amber-400" />;
      case 'youtube':
        return <Video className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const getSentimentBadge = (label?: string, confidence?: number) => {
    const confStr = confidence ? `${Math.round(confidence * 100)}%` : '';
    switch (label) {
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span>Positif</span>
            {confStr && <span className="text-[10px] opacity-75 font-tabular">({confStr})</span>}
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span>Negatif</span>
            {confStr && <span className="text-[10px] opacity-75 font-tabular">({confStr})</span>}
          </span>
        );
      case 'neutral':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            <span>Netral</span>
            {confStr && <span className="text-[10px] opacity-75 font-tabular">({confStr})</span>}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <span>Lainnya</span>
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
          <div key={i} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 animate-pulse space-y-2.5">
            <div className="h-4 bg-zinc-800 rounded w-1/4" />
            <div className="h-4 bg-zinc-800/80 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (mentions.length === 0) {
    return (
      <div className="p-10 text-center border border-zinc-800/80 rounded-xl bg-zinc-900/40">
        <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-sm font-medium text-zinc-300 mb-1">Tidak ada sebutan yang cocok</p>
        <p className="text-xs text-zinc-500">Coba ubah kata kunci pencarian, rentang tanggal, atau filter platform.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bento-card divide-y divide-white/[0.06] overflow-hidden">
        {mentions.map((item) => (
          <article
            key={item.id}
            onClick={() => setSelectedMention(item)}
            className="p-4 hover:bg-white/[0.03] transition-colors cursor-pointer group space-y-2.5 font-sans-ui"
          >
            {/* Header Telemetry Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center flex-wrap gap-2.5">
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-300 font-medium text-[11px] font-mono-code">
                  {getPlatformIcon(item.provider)}
                  <span className="capitalize">{item.provider}</span>
                </span>

                {item.author_name && (
                  <span className="text-white font-semibold text-xs">
                    {item.author_name}
                  </span>
                )}

                <span className="text-zinc-400 flex items-center gap-1.5 text-xs font-mono-code">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{formatTimestamp(item.published_at)}</span>
                </span>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                {(item.is_sarcasm || item.metadata_json?.sarcasm_analysis?.is_sarcasm) && (
                  <span
                    title={
                      item.metadata_json?.sarcasm_analysis?.sarcasm_reason ||
                      'Terdeteksi pujian ironis / sarkasme politik, sentimen dikoreksi ke Negatif'
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-amber-500/15 text-amber-300 border border-amber-500/35"
                  >
                    <span>🎭 SARKASME</span>
                  </span>
                )}

                {(item.is_inauthentic || item.metadata_json?.bot_analysis?.is_inauthentic) && (
                  <span
                    title={
                      item.metadata_json?.bot_analysis?.bot_signals?.join(', ') ||
                      'Terindikasi amplifikasi bot / copypasta'
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-rose-500/15 text-rose-300 border border-rose-500/35"
                  >
                    <span>🤖 TERINDIKASI BOT</span>
                  </span>
                )}

                {getSentimentBadge(item.sentiment?.label, item.sentiment?.confidence)}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMention(item);
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] text-xs transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>Lihat Detail</span>
                </button>
              </div>
            </div>

            {/* Content snippet */}
            <div>
              <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">
                {item.text}
              </p>
            </div>

            {/* Topics & Keywords Tags */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {item.topics && item.topics.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-zinc-400" />
                    {item.topics.map((t) => (
                      <span
                        key={t.id}
                        className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700 text-[11px] font-medium"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}

                {item.keywords && item.keywords.length > 0 && (
                  <div className="flex items-center gap-1 text-zinc-500 text-[11px] ml-1">
                    <span>Kata Kunci:</span>
                    <span className="text-zinc-400">{item.keywords.slice(0, 3).map((k) => k.keyword).join(', ')}</span>
                  </div>
                )}
              </div>

              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1 transition-colors"
                >
                  <span>Buka Sumber</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Detail Slide-over Drawer */}
      <MentionInspectorDrawer
        mention={selectedMention}
        onClose={() => setSelectedMention(null)}
      />
    </>
  );
}
