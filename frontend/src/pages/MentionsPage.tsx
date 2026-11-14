import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, MentionItem, TopicItem } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquareText,
  ExternalLink,
  Calendar,
  Tag,
  Hash,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  PlatformBadge,
  SocialEngagementBar,
  getPlatformMeta,
  isSocialProvider,
} from '@/components/common/PlatformBadge';
import { LinkVerificationBadge } from '@/components/common/LinkVerificationBadge';
import { inspectSocialLink } from '@/utils/socialLink';

interface MentionsPageProps {
  initialKeyword?: string;
  initialTopicId?: number;
  initialSentiment?: string;
  organicOnly?: boolean;
  onOpenAiWithQuery?: (query: string, topicId?: number) => void;
}

export function MentionsPage({
  initialKeyword,
  initialTopicId,
  initialSentiment,
  organicOnly = false,
  onOpenAiWithQuery,
}: MentionsPageProps) {
  const [search, setSearch] = useState(initialKeyword || '');
  const [topicId, setTopicId] = useState<number | undefined>(initialTopicId);
  const [provider, setProvider] = useState<string>('');
  const [interactionType, setInteractionType] = useState<string>('');
  const [linkStatus, setLinkStatus] = useState<string>('');
  const [sentiment, setSentiment] = useState<string>(initialSentiment || '');
  const [onlySarcasm, setOnlySarcasm] = useState<boolean>(false);
  const [onlyInauthentic, setOnlyInauthentic] = useState<boolean>(false);
  const [page, setPage] = useState(1);
  const [selectedMentionId, setSelectedMentionId] = useState<number | null>(null);

  // Sync state if initial filter props change
  useEffect(() => {
    if (initialTopicId !== undefined) setTopicId(initialTopicId);
    if (initialKeyword !== undefined) setSearch(initialKeyword);
    if (initialSentiment !== undefined) setSentiment(initialSentiment);
  }, [initialTopicId, initialKeyword, initialSentiment]);

  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id;

  // Fetch topics for filter dropdown
  const { data: topics } = useQuery({
    queryKey: ['topics-list', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<{ data: TopicItem[] }>(`/workspaces/${workspaceId}/topics`);
      return res.data.data;
    },
  });

  // Fetch mentions
  const { data, isLoading } = useQuery({
    queryKey: [
      'mentions-explorer',
      workspaceId,
      page,
      topicId,
      provider,
      interactionType,
      linkStatus,
      sentiment,
      search,
      organicOnly,
      onlySarcasm,
      onlyInauthentic,
    ],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<{
        data: MentionItem[];
        pagination: { current_page: number; last_page: number; total: number; per_page: number };
      }>('/mentions', {
        params: {
          workspace_id: workspaceId,
          page,
          topic_id: topicId,
          provider: provider || undefined,
          interaction_type: interactionType || undefined,
          link_status: linkStatus || undefined,
          sentiment: sentiment || undefined,
          search: search || undefined,
          exclude_inauthentic: organicOnly || undefined,
          only_sarcasm: onlySarcasm || undefined,
          only_inauthentic: onlyInauthentic || undefined,
          per_page: 15,
        },
      });
      return res.data;
    },
  });

  const mentionsList = data?.data || [];
  const activeMention = mentionsList.find((m) => m.id === selectedMentionId) || mentionsList[0] || null;
  const activeLink = activeMention
    ? inspectSocialLink({
        provider: activeMention.provider,
        sourceUrl: activeMention.source_url,
        linkStatus: activeMention.link_status || activeMention.metadata_json?.link_status,
        isDemo: activeMention.is_demo,
      })
    : null;
  const activeIsSocial = activeMention ? isSocialProvider(activeMention.provider) : false;

  const clearFilters = () => {
    setSearch('');
    setTopicId(undefined);
    setProvider('');
    setInteractionType('');
    setLinkStatus('');
    setSentiment('');
    setOnlySarcasm(false);
    setOnlyInauthentic(false);
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search || topicId || provider || interactionType || linkStatus || sentiment || onlySarcasm || onlyInauthentic
  );

  const extractDomain = (url?: string | null, authorName?: string | null, prov?: string | null) => {
    if (authorName && authorName.trim()) return authorName;
    if (prov && isSocialProvider(prov)) return getPlatformMeta(prov).label;
    if (!url) return 'Media Publik';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return 'Media Publik';
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

  const getSentimentPill = (label?: string) => {
    switch (label) {
      case 'positive':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-code bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Positif
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-code bg-rose-500/15 text-rose-400 border border-rose-500/30">
            Negatif
          </span>
        );
      case 'neutral':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-code bg-white/[0.05] text-zinc-300 border border-white/[0.1]">
            Netral
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-code bg-white/[0.05] text-zinc-400 border border-white/[0.1]">
            Lainnya
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 font-sans-ui">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center shadow-xs">
            <MessageSquareText className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-editorial text-2xl font-medium text-white tracking-tight">
              Eksplorasi Sebutan &amp; Investigasi Bukti
            </h1>
            <p className="text-xs text-zinc-400 font-sans-ui">
              Studio pembacaan dan analisis mendalam percakapan media sosial serta pemberitaan media nasional
            </p>
          </div>
        </div>

        {data?.pagination && (
          <div className="text-xs text-zinc-400 font-mono-code bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.08]">
            Total: <span className="font-bold text-white font-tabular">{data.pagination.total.toLocaleString('id-ID')}</span> Dokumen
          </div>
        )}
      </div>

      {/* Filter Control Ribbon */}
      <div className="bento-card p-4 bg-[#0e1117] space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari kata kunci, akun, atau isi opini media sosial dan berita..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/50 transition-colors shadow-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Hapus kata kunci"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Channel & Sentiment Lenses */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <button
              type="button"
              onClick={() => {
                setProvider('');
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
                provider === ''
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                  : 'border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Semua Kanal
            </button>
            <button
              type="button"
              onClick={() => {
                setProvider('social');
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
                provider === 'social'
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                  : 'border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Media Sosial
            </button>
            <button
              type="button"
              onClick={() => {
                setProvider('rss');
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
                provider === 'rss'
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                  : 'border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Berita RSS
            </button>

            <span className="h-4 w-px bg-white/[0.08] mx-1 shrink-0" />

            <button
              type="button"
              onClick={() => {
                setSentiment('');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                sentiment === ''
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Semua Sentimen
            </button>
            <button
              type="button"
              onClick={() => {
                setSentiment('positive');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                sentiment === 'positive'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-emerald-400 hover:bg-white/[0.04]'
              }`}
            >
              Positif
            </button>
            <button
              type="button"
              onClick={() => {
                setSentiment('neutral');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                sentiment === 'neutral'
                  ? 'bg-zinc-300 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              Netral
            </button>
            <button
              type="button"
              onClick={() => {
                setSentiment('negative');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                sentiment === 'negative'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-rose-400 hover:bg-white/[0.04]'
              }`}
            >
              Negatif
            </button>
            <button
              type="button"
              onClick={() => {
                setOnlySarcasm((prev) => !prev);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
                onlySarcasm
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-xs'
                  : 'border-white/[0.08] text-zinc-400 hover:text-amber-300 hover:bg-white/[0.04]'
              }`}
            >
              🎭 Sarkasme
            </button>
            <button
              type="button"
              onClick={() => {
                setOnlyInauthentic((prev) => !prev);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
                onlyInauthentic
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-xs'
                  : 'border-white/[0.08] text-zinc-400 hover:text-rose-300 hover:bg-white/[0.04]'
              }`}
            >
              🤖 Indikasi Bot
            </button>
          </div>

          {/* Topic Select */}
          <select
            aria-label="Filter topik"
            value={topicId || ''}
            onChange={(e) => {
              setTopicId(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400/50 transition-colors shadow-xs"
          >
            <option value="" className="bg-[#0e1117]">Semua Topik</option>
            {topics?.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#0e1117]">
                {t.name}
              </option>
            ))}
          </select>

          {/* Provider Select */}
          <select
            aria-label="Filter sumber platform"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
            className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400/50 transition-colors shadow-xs"
          >
            <option value="" className="bg-[#0e1117]">Semua Sumber</option>
            <option value="social" className="bg-[#0e1117]">Semua Media Sosial</option>
            <option value="rss" className="bg-[#0e1117]">Media Berita (RSS)</option>
            <option value="youtube" className="bg-[#0e1117]">YouTube</option>
            <option value="x" className="bg-[#0e1117]">Twitter / X</option>
            <option value="tiktok" className="bg-[#0e1117]">TikTok</option>
            <option value="instagram" className="bg-[#0e1117]">Instagram</option>
            <option value="facebook" className="bg-[#0e1117]">Facebook</option>
            <option value="reddit" className="bg-[#0e1117]">Reddit</option>
          </select>

          {/* Interaction Type Select */}
          <select
            aria-label="Filter tipe interaksi"
            value={interactionType}
            onChange={(e) => {
              setInteractionType(e.target.value);
              setPage(1);
            }}
            className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400/50 transition-colors shadow-xs"
          >
            <option value="" className="bg-[#0e1117]">Semua Interaksi</option>
            <option value="post" className="bg-[#0e1117]">Postingan Utama</option>
            <option value="comment" className="bg-[#0e1117]">Komentar Netizen</option>
          </select>

          {/* Link Verification Status Select */}
          <select
            aria-label="Filter status tautan"
            value={linkStatus}
            onChange={(e) => {
              setLinkStatus(e.target.value);
              setPage(1);
            }}
            className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400/50 transition-colors shadow-xs"
          >
            <option value="" className="bg-[#0e1117]">Semua Tautan</option>
            <option value="verified_post" className="bg-[#0e1117]">Post Terverifikasi</option>
            <option value="verified_article" className="bg-[#0e1117]">Artikel Media</option>
            <option value="search_fallback" className="bg-[#0e1117]">Perlu Verifikasi</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              title="Reset Semua Filter"
              aria-label="Reset semua filter"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* AI Search Synthesis Action */}
          {onOpenAiWithQuery && (
            <button
              type="button"
              onClick={() => {
                const topicName = topics?.find((t) => t.id === topicId)?.name;
                const parts: string[] = [];
                if (search) parts.push(`kata kunci "${search}"`);
                if (sentiment) parts.push(`polaritas ${sentiment}`);
                if (topicName) parts.push(`program "${topicName}"`);
                if (provider) parts.push(`kanal ${provider}`);

                const filterDesc = parts.length > 0 ? parts.join(', ') : 'seluruh sebutan terkini';
                onOpenAiWithQuery(
                  `Sintesis komprehensif temuan percakapan publik untuk filter [${filterDesc}] (${data?.pagination.total || mentionsList.length} dokumen). Sajikan rangkuman narasi utama, kecenderungan opini masyarakat, dan potensi isu sensitif.`,
                  topicId
                );
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0 ml-auto"
              title="Sintesis seluruh hasil pencarian aktif ini menggunakan AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Sintesis Hasil ({data?.pagination.total ?? mentionsList.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2-PANE INVESTIGATION STUDIO WORKSTATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANE: Feed List (5 Columns) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bento-card bg-[#0e1117] overflow-hidden flex flex-col h-[760px]">
            {/* Subheader */}
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between text-xs text-zinc-400 font-mono-code">
              <span>
                {provider === 'social' || isSocialProvider(provider)
                  ? 'Arus Sebutan Media Sosial'
                  : provider === 'rss'
                  ? 'Arus Sebutan Berita'
                  : 'Arus Sebutan & Media Sosial'}
              </span>
              <span>Hal. {page} dari {data?.pagination.last_page || 1}</span>
            </div>

            {/* Scrollable Feed List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06] p-2 space-y-2">
              {isLoading ? (
                <div className="space-y-3 p-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] animate-pulse space-y-2">
                      <div className="h-3 bg-white/[0.08] rounded w-1/3" />
                      <div className="h-4 bg-white/[0.12] rounded w-full" />
                      <div className="h-3 bg-white/[0.06] rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : mentionsList.length === 0 ? (
                <div className="p-12 text-center text-zinc-500">
                  <MessageSquareText className="w-8 h-8 mx-auto mb-2 opacity-30 text-zinc-400" />
                  <p className="text-xs font-sans-ui">Tidak ada sebutan yang cocok dengan filter</p>
                </div>
              ) : (
                mentionsList.map((item) => {
                  const isSelected = activeMention?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedMentionId(item.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.14]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlatformBadge
                            provider={item.provider}
                            size="xs"
                            compactLabel
                            isComment={Boolean(item.metadata_json?.is_comment)}
                          />
                          <span className="font-semibold text-zinc-200 truncate max-w-[140px]">
                            {extractDomain(item.source_url, item.author_name, item.provider)}
                          </span>
                        </div>
                        <div className="flex items-center flex-wrap gap-1.5">
                          {(item.is_sarcasm || item.metadata_json?.sarcasm_analysis?.is_sarcasm) && (
                            <span
                              title={item.metadata_json?.sarcasm_analysis?.sarcasm_reason || 'Sarkasme terdeteksi'}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono-code font-bold bg-amber-500/20 text-amber-300 border border-amber-500/35"
                            >
                              🎭 SARKASME
                            </span>
                          )}
                          {(item.is_inauthentic || item.metadata_json?.bot_analysis?.is_inauthentic) && (
                            <span
                              title={item.metadata_json?.bot_analysis?.bot_signals?.join(', ') || 'Indikasi Bot/Buzzer'}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono-code font-bold bg-rose-500/20 text-rose-300 border border-rose-500/35"
                            >
                              🤖 BOT
                            </span>
                          )}
                          {getSentimentPill(item.sentiment?.label)}
                          {onOpenAiWithQuery && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const tId = item.topics?.[0]?.id;
                                const srcLabel = extractDomain(item.source_url, item.author_name, item.provider);
                                const isSoc = isSocialProvider(item.provider);
                                onOpenAiWithQuery(
                                  isSoc
                                    ? `Analisis opini media sosial (${getPlatformMeta(item.provider).label}): "${item.text}" dari ${srcLabel}`
                                    : `Analisis sebutan berita: "${item.text}" dari ${srcLabel}`,
                                  tId
                                );
                              }}
                              className="p-1 rounded hover:bg-amber-500/20 text-zinc-500 hover:text-amber-300 transition-colors cursor-pointer"
                              title="Tanyakan AI tentang sebutan ini"
                              aria-label="Analisis dengan AI"
                            >
                              <Sparkles className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-white line-clamp-2 leading-snug">
                        {item.text}
                      </h4>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400 font-mono-code pt-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span>{formatTimestamp(item.published_at)}</span>
                          <SocialEngagementBar
                            metrics={item.metadata_json?.metrics}
                            likesFallback={item.metadata_json?.likes}
                            metricsAvailable={item.metadata_json?.metrics_available}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <LinkVerificationBadge
                            provider={item.provider}
                            sourceUrl={item.source_url}
                            linkStatus={item.link_status || item.metadata_json?.link_status}
                            isDemo={item.is_demo}
                            compact
                          />
                          {item.sentiment?.confidence && (
                            <span className="text-zinc-400 font-tabular">
                              {Math.round(item.sentiment.confidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {data?.pagination && data.pagination.last_page > 1 && (
              <div className="p-3 border-t border-white/[0.08] flex items-center justify-between text-xs font-mono-code">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>
                <span className="text-zinc-400 text-[11px]">
                  Hal. {page} dari {data.pagination.last_page}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(data.pagination.last_page, p + 1))}
                  disabled={page >= data.pagination.last_page}
                  className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                >
                  <span>Selanjutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Deep Reading & Inspection Studio (7 Columns) */}
        <div className="lg:col-span-7 sticky top-20">
          {activeMention ? (
            <div className="bento-card p-6 sm:p-7 bg-[#0e1117] h-[760px] flex flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                {/* Meta Ribbon */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                  <div className="flex items-center flex-wrap gap-2">
                    <PlatformBadge
                      provider={activeMention.provider}
                      size="sm"
                      isComment={Boolean(activeMention.metadata_json?.is_comment)}
                    />
                    <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs font-semibold font-mono-code">
                      {extractDomain(activeMention.source_url, activeMention.author_name, activeMention.provider)}
                    </span>
                    <span className="text-zinc-400 text-xs font-mono-code flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{formatTimestamp(activeMention.published_at)}</span>
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    <LinkVerificationBadge
                      provider={activeMention.provider}
                      sourceUrl={activeMention.source_url}
                      linkStatus={activeMention.link_status || activeMention.metadata_json?.link_status}
                      isDemo={activeMention.is_demo}
                      showCopyButton
                    />

                    {onOpenAiWithQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          const tId = activeMention.topics?.[0]?.id;
                          const srcLabel =
                            activeMention.author_name ||
                            extractDomain(activeMention.source_url, activeMention.author_name, activeMention.provider);
                          onOpenAiWithQuery(
                            activeIsSocial
                              ? `Bedah dan analisis opini media sosial (${getPlatformMeta(activeMention.provider).label}) ini: "${activeMention.text}" (Akun: ${srcLabel}, Sentimen: ${activeMention.sentiment?.label || 'Netral'}). Jelaskan konteks sentimen netizen, potensi eskalasi isu, dan respons komunikasi yang disarankan.`
                              : `Bedah dan analisis secara mendalam artikel/sebutan ini: "${activeMention.text}" (Sumber: ${srcLabel}, Sentimen: ${activeMention.sentiment?.label || 'Netral'}). Jelaskan implikasi isu, potensi resistensi publik, dan poin kebijakan terkait.`,
                            tId
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 hover:text-amber-200 text-xs font-semibold transition-all shadow-xs cursor-pointer"
                        title="Analisis sebutan ini secara mendalam dengan AI"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Analisis dengan AI</span>
                      </button>
                    )}

                    {activeLink?.isExternalNavigable && activeLink.href && (
                      <a
                        href={activeLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          activeLink.isSearchFallback
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-200'
                            : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.12] text-zinc-200 hover:text-white'
                        }`}
                      >
                        <span>
                          {activeLink.isSearchFallback
                            ? 'Cari di Platform'
                            : activeIsSocial
                            ? 'Buka Postingan Asli'
                            : 'Kunjungi Tautan Asli'}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Full Article / Post Content */}
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-amber-400 block mb-1">
                      {activeIsSocial ? 'Isi Postingan / Komentar Netizen' : 'Isi & Kutipan Lengkap'}
                    </span>
                    <h2 className="font-editorial text-xl sm:text-2xl font-medium text-white leading-relaxed">
                      &ldquo;{activeMention.text}&rdquo;
                    </h2>
                  </div>

                  {(activeIsSocial || activeMention.metadata_json?.metrics) && (
                    <div className="pt-1 flex items-center gap-3">
                      <SocialEngagementBar
                        metrics={activeMention.metadata_json?.metrics}
                        likesFallback={activeMention.metadata_json?.likes}
                        metricsAvailable={activeMention.metadata_json?.metrics_available}
                        showUnavailableHint={activeIsSocial}
                      />
                    </div>
                  )}
                </div>

                {/* NLP Sentiment Verdict & Deep Probabilities */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-mono-code font-bold uppercase text-zinc-400">
                      Keputusan Sentimen Model NLP
                    </span>
                    <div className="flex items-center gap-2">
                      {getSentimentPill(activeMention.sentiment?.label)}
                      {activeMention.sentiment?.confidence && (
                        <span className="text-[11px] font-mono-code text-zinc-300">
                          {Math.round(activeMention.sentiment.confidence * 100)}% Keyakinan
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Probabilities Bars */}
                  {activeMention.sentiment?.probabilities_json && (
                    <div className="space-y-1.5 pt-2 border-t border-white/[0.05]">
                      <div className="flex items-center justify-between text-[11px] font-mono-code">
                        <span className="text-emerald-400">
                          Positif: {Math.round(activeMention.sentiment.probabilities_json.positive * 100)}%
                        </span>
                        <span className="text-zinc-400">
                          Netral: {Math.round(activeMention.sentiment.probabilities_json.neutral * 100)}%
                        </span>
                        <span className="text-rose-400">
                          Negatif: {Math.round(activeMention.sentiment.probabilities_json.negative * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden flex border border-white/[0.06]">
                        <div
                          style={{ width: `${Math.round(activeMention.sentiment.probabilities_json.positive * 100)}%` }}
                          className="bg-emerald-500 h-full"
                        />
                        <div
                          style={{ width: `${Math.round(activeMention.sentiment.probabilities_json.neutral * 100)}%` }}
                          className="bg-zinc-600 h-full"
                        />
                        <div
                          style={{ width: `${Math.round(activeMention.sentiment.probabilities_json.negative * 100)}%` }}
                          className="bg-rose-500 h-full"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Sarcasm & Bot Authenticity Telemetry Box */}
                {(activeMention.is_sarcasm ||
                  activeMention.metadata_json?.sarcasm_analysis?.is_sarcasm ||
                  activeMention.is_inauthentic ||
                  activeMention.metadata_json?.bot_analysis?.is_inauthentic) && (
                  <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/30 space-y-3">
                    <div className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-amber-300">
                      Intelijen Keaslian Opini &amp; Pembedahan Sarkasme
                    </div>

                    {(activeMention.is_sarcasm ||
                      activeMention.metadata_json?.sarcasm_analysis?.is_sarcasm) && (
                      <div className="p-3 rounded-lg bg-[#08090d]/85 border border-amber-500/25 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-300">
                            🎭 Terdeteksi Sarkasme / Satir Politik
                          </span>
                          <span className="font-mono-code text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                            Sentimen Dikoreksi &rarr; NEGATIF
                          </span>
                        </div>
                        <p className="text-zinc-300 text-xs leading-relaxed">
                          {activeMention.metadata_json?.sarcasm_analysis?.sarcasm_reason ||
                            'Komentar menggunakan pujian ironis untuk menyindir kebijakan publik.'}
                        </p>
                      </div>
                    )}

                    {(activeMention.is_inauthentic ||
                      activeMention.metadata_json?.bot_analysis?.is_inauthentic) && (
                      <div className="p-3 rounded-lg bg-[#08090d]/85 border border-rose-500/25 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-rose-300">
                            🤖 Terindikasi Amplifikasi Bot / Buzzer
                          </span>
                          <span className="font-mono-code text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                            Skor Bot:{' '}
                            {Math.round(
                              (activeMention.inauthentic_score ??
                                activeMention.metadata_json?.bot_analysis?.inauthentic_score ??
                                0.7) * 100
                            )}
                            %
                          </span>
                        </div>
                        {activeMention.metadata_json?.bot_analysis?.bot_signals &&
                          activeMention.metadata_json.bot_analysis.bot_signals.length > 0 && (
                            <ul className="list-disc list-inside text-zinc-300 text-xs space-y-0.5">
                              {activeMention.metadata_json.bot_analysis.bot_signals.map((sig, idx) => (
                                <li key={idx}>{sig}</li>
                              ))}
                            </ul>
                          )}
                      </div>
                    )}
                  </div>
                )}

                {/* Extracted Keywords */}
                {activeMention.keywords && activeMention.keywords.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                      Entitas &amp; Kata Kunci Terdeteksi
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {activeMention.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs font-mono-code text-zinc-200"
                        >
                          <Hash className="w-3 h-3 text-amber-400" />
                          <span>{kw.keyword}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Associated Topics */}
                {activeMention.topics && activeMention.topics.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                      Topik Pemantauan Terkait
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {activeMention.topics.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs font-medium text-amber-300"
                        >
                          <Tag className="w-3 h-3 text-amber-400" />
                          <span>{t.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Context Badge */}
              <div className="pt-4 mt-6 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-400 font-mono-code">
                <span>Dokumen ID: #{activeMention.id}</span>
                <span className={`flex items-center gap-1 ${activeLink?.isVerifiedDirect ? 'text-emerald-400' : 'text-amber-300'}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{activeLink?.isVerifiedDirect ? 'Tautan Terverifikasi' : activeLink?.reason || 'Pipeline Ingesti'}</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="bento-card p-12 bg-[#0e1117] h-[760px] flex items-center justify-center text-center text-zinc-500">
              <div>
                <MessageSquareText className="w-10 h-10 mx-auto mb-3 opacity-30 text-zinc-400" />
                <h3 className="font-semibold text-sm text-zinc-300 mb-1">Pilih Dokumen Sebutan</h3>
                <p className="text-xs max-w-xs mx-auto">
                  Klik artikel di panel sebelah kiri untuk membaca analisis sentimen dan probabilitas secara mendalam.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
