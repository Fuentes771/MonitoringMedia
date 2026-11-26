import { useState, useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
  Layers,
  Copy,
  User,
  Bot,
  MessageSquareWarning,
} from 'lucide-react';
import {
  PlatformBadge,
  SocialEngagementBar,
  getPlatformMeta,
  isSocialProvider,
} from '@/components/common/PlatformBadge';
import { LinkVerificationBadge } from '@/components/common/LinkVerificationBadge';
import { MentionInspectorDrawer } from '@/components/mentions/MentionInspectorDrawer';
import { inspectSocialLink } from '@/utils/socialLink';

interface MentionsPageProps {
  initialKeyword?: string;
  initialTopicId?: number;
  initialSentiment?: string;
  initialAuthorName?: string;
  initialBotClusterId?: string;
  initialOnlyInauthentic?: boolean;
  organicOnly?: boolean;
  onOpenAiWithQuery?: (query: string, topicId?: number) => void;
}

export function MentionsPage({
  initialKeyword,
  initialTopicId,
  initialSentiment,
  initialAuthorName,
  initialBotClusterId,
  initialOnlyInauthentic = false,
  organicOnly = false,
  onOpenAiWithQuery,
}: MentionsPageProps) {
  const [search, setSearch] = useState(initialKeyword || '');
  const [debouncedSearch, setDebouncedSearch] = useState(initialKeyword || '');
  const [topicId, setTopicId] = useState<number | undefined>(initialTopicId);
  const [provider, setProvider] = useState<string>('');
  const [interactionType, setInteractionType] = useState<string>('');
  const [linkStatus, setLinkStatus] = useState<string>('');
  const [sentiment, setSentiment] = useState<string>(initialSentiment || '');
  const [authorName, setAuthorName] = useState<string>(initialAuthorName || '');
  const [botClusterId, setBotClusterId] = useState<string>(initialBotClusterId || '');
  const [onlySarcasm, setOnlySarcasm] = useState<boolean>(false);
  const [onlyInauthentic, setOnlyInauthentic] = useState<boolean>(Boolean(initialOnlyInauthentic));
  const [excludeNearDuplicates, setExcludeNearDuplicates] = useState<boolean>(
    !Boolean(initialBotClusterId || initialAuthorName)
  );
  const [page, setPage] = useState(1);
  const [selectedMentionId, setSelectedMentionId] = useState<number | null>(null);
  const [mobileInspectorMention, setMobileInspectorMention] = useState<MentionItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setTopicId(initialTopicId);
    setSearch(initialKeyword || '');
    setDebouncedSearch((initialKeyword || '').trim());
    setSentiment(initialSentiment || '');
    setAuthorName(initialAuthorName || '');
    setBotClusterId(initialBotClusterId || '');
    setOnlyInauthentic(Boolean(initialOnlyInauthentic));
    setExcludeNearDuplicates(!Boolean(initialBotClusterId || initialAuthorName));
    setPage(1);
  }, [
    initialTopicId,
    initialKeyword,
    initialSentiment,
    initialAuthorName,
    initialBotClusterId,
    initialOnlyInauthentic,
  ]);

  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id;

  const { data: topics } = useQuery({
    queryKey: ['topics-list', workspaceId],
    enabled: Boolean(workspaceId),
    staleTime: 120_000,
    queryFn: async () => {
      const res = await api.get<{ data: TopicItem[] }>(`/workspaces/${workspaceId}/topics`);
      return res.data.data;
    },
  });

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: [
      'mentions-explorer',
      workspaceId,
      page,
      topicId,
      provider,
      interactionType,
      linkStatus,
      sentiment,
      debouncedSearch,
      authorName,
      botClusterId,
      organicOnly,
      excludeNearDuplicates,
      onlySarcasm,
      onlyInauthentic,
    ],
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await api.get<{
        data: MentionItem[];
        pagination: { current_page: number; last_page: number; total: number; per_page: number };
        meta_counts?: { hidden_near_duplicates: number; total_near_duplicates: number };
      }>('/mentions', {
        params: {
          workspace_id: workspaceId,
          page,
          topic_id: topicId,
          provider: provider || undefined,
          interaction_type: interactionType || undefined,
          link_status: linkStatus || undefined,
          sentiment: sentiment || undefined,
          search: debouncedSearch || undefined,
          author_name: authorName || undefined,
          bot_cluster_id: botClusterId || undefined,
          exclude_inauthentic: organicOnly || undefined,
          exclude_near_duplicates: excludeNearDuplicates ? 1 : undefined,
          only_sarcasm: onlySarcasm || undefined,
          only_inauthentic: onlyInauthentic || undefined,
          per_page: 15,
        },
      });
      return res.data;
    },
  });

  const mentionsList = data?.data || [];
  const metaCounts = data?.meta_counts;
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
    setAuthorName('');
    setBotClusterId('');
    setOnlySarcasm(false);
    setOnlyInauthentic(false);
    setExcludeNearDuplicates(true);
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search ||
      topicId ||
      provider ||
      interactionType ||
      linkStatus ||
      sentiment ||
      authorName ||
      botClusterId ||
      onlySarcasm ||
      onlyInauthentic ||
      !excludeNearDuplicates
  );

  const extractDomain = (url?: string | null, author?: string | null, prov?: string | null) => {
    if (author && author.trim()) return author;
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
      return (
        d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }) + ' WIB'
      );
    } catch {
      return iso;
    }
  };

  const getSentimentPill = (label?: string) => {
    switch (label) {
      case 'positive':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10.5px] font-semibold bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border border-[var(--sentiment-pos-border)]">
            Positif
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10.5px] font-semibold bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border border-[var(--sentiment-neg-border)]">
            Negatif
          </span>
        );
      case 'neutral':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10.5px] font-semibold bg-[var(--sentiment-neu-subtle)] text-[var(--sentiment-neu)] border border-[var(--sentiment-neu-border)]">
            Netral
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10.5px] font-semibold bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
            Lainnya
          </span>
        );
    }
  };

  const handleSelectMention = (item: MentionItem) => {
    setSelectedMentionId(item.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileInspectorMention(item);
    }
  };

  return (
    <div className="space-y-5 font-sans-ui animate-surface-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
        <div className="space-y-1">
          <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[var(--text-primary)] tracking-tight">
            Eksplorasi Sebutan &amp; Investigasi Bukti
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Pembacaan mendalam percakapan media sosial dan pemberitaan media nasional.
          </p>
        </div>

        {data?.pagination && (
          <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] px-3.5 py-2 rounded-full border border-[var(--border-subtle)] shrink-0 self-start sm:self-auto font-tabular">
            Total <strong className="text-[var(--text-primary)]">{data.pagination.total.toLocaleString('id-ID')}</strong> dokumen
          </div>
        )}
      </div>

      {/* Filter Ribbon */}
      <div className="surface-card p-4 sm:p-5 space-y-3.5">
        {/* Search + Synthesis */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Cari kata kunci, akun, atau isi sebutan"
              placeholder="Cari kata kunci, akun, atau kutipan opini..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-field w-full min-h-11 pl-10 pr-11 py-2 text-base sm:text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-10 min-h-10 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg"
                aria-label="Hapus kata kunci"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="btn-ghost-surface min-w-11 min-h-11 flex items-center justify-center shrink-0"
                title="Reset semua filter"
                aria-label="Reset semua filter"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
            )}

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
                  if (authorName) parts.push(`akun ${authorName}`);
                  if (botClusterId) parts.push(`kluster copypasta ${botClusterId}`);

                  const filterDesc = parts.length > 0 ? parts.join(', ') : 'seluruh sebutan terkini';
                  onOpenAiWithQuery(
                    `Sintesis komprehensif temuan percakapan publik untuk filter [${filterDesc}] (${data?.pagination?.total || mentionsList.length} dokumen). Sajikan rangkuman narasi utama, kecenderungan opini masyarakat, dan potensi isu sensitif.`,
                    topicId
                  );
                }}
                className="btn-gold flex-1 sm:flex-none min-h-11 px-4 text-xs inline-flex items-center justify-center gap-1.5 shrink-0"
              >
                <MessageSquareText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Sintesis Hasil ({data?.pagination?.total ?? mentionsList.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Channel & Sentiment Quick Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { val: '', label: 'Semua Kanal' },
            { val: 'social', label: 'Media Sosial' },
            { val: 'rss', label: 'Berita RSS' },
          ].map((ch) => (
            <button
              key={ch.val || 'all-ch'}
              type="button"
              onClick={() => {
                setProvider(ch.val);
                setPage(1);
              }}
              aria-pressed={provider === ch.val}
              className={`min-h-9 px-3.5 rounded-full text-xs font-semibold shrink-0 border transition-colors ${
                provider === ch.val
                  ? 'bg-[var(--accent-gold-subtle)] border-[var(--accent-gold-border)] text-[var(--accent-gold-text)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {ch.label}
            </button>
          ))}

          <span className="h-4 w-px bg-[var(--border-subtle)] mx-1 shrink-0" aria-hidden="true" />

          {[
            { val: '', label: 'Semua Sentimen' },
            { val: 'positive', label: 'Positif' },
            { val: 'neutral', label: 'Netral' },
            { val: 'negative', label: 'Negatif' },
          ].map((s) => {
            const active = sentiment === s.val;
            return (
              <button
                key={s.val || 'all-s'}
                type="button"
                onClick={() => {
                  setSentiment(s.val);
                  setPage(1);
                }}
                aria-pressed={active}
                className={`min-h-9 px-3.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                  active
                    ? s.val === 'positive'
                      ? 'bg-[var(--sentiment-pos-bar)] text-white'
                      : s.val === 'negative'
                        ? 'bg-[var(--sentiment-neg-bar)] text-white'
                        : 'bg-[var(--action-contrast-bg)] text-[var(--action-contrast-fg)]'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {s.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setOnlySarcasm((prev) => !prev);
              setPage(1);
            }}
            aria-pressed={onlySarcasm}
            className={`min-h-9 px-3.5 rounded-full text-xs font-semibold shrink-0 border transition-colors ${
              onlySarcasm
                ? 'bg-[var(--accent-gold-subtle)] border-[var(--accent-gold-border)] text-[var(--accent-gold-text)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Sarkasme
          </button>

          <button
            type="button"
            onClick={() => {
              setOnlyInauthentic((prev) => !prev);
              setPage(1);
            }}
            aria-pressed={onlyInauthentic}
            className={`min-h-9 px-3.5 rounded-full text-xs font-semibold shrink-0 border transition-colors ${
              onlyInauthentic
                ? 'bg-[var(--sentiment-neg-subtle)] border-[var(--sentiment-neg-border)] text-[var(--sentiment-neg)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--sentiment-neg)]'
            }`}
          >
            Indikasi Bot
          </button>
        </div>

        {/* 4 Structured Selects */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <select
            aria-label="Filter topik"
            value={topicId || ''}
            onChange={(e) => {
              setTopicId(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="input-field w-full min-w-0 min-h-10 px-3 py-2 text-xs"
          >
            <option value="">Semua Topik</option>
            {topics?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter sumber platform"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
            className="input-field w-full min-w-0 min-h-10 px-3 py-2 text-xs"
          >
            <option value="">Semua Sumber</option>
            <option value="social">Semua Media Sosial</option>
            <option value="rss">Media Berita (RSS)</option>
            <option value="youtube">YouTube</option>
            <option value="x">Twitter / X</option>
            <option value="tiktok">TikTok</option>
            <option value="threads">Threads (via Muse)</option>
            <option value="instagram">Instagram (via Muse)</option>
            <option value="facebook">Facebook (via Muse)</option>
            <option value="reddit">Reddit</option>
          </select>

          <select
            aria-label="Filter tipe interaksi"
            value={interactionType}
            onChange={(e) => {
              setInteractionType(e.target.value);
              setPage(1);
            }}
            className="input-field w-full min-w-0 min-h-10 px-3 py-2 text-xs"
          >
            <option value="">Semua Interaksi</option>
            <option value="post">Postingan Utama</option>
            <option value="comment">Komentar Netizen</option>
          </select>

          <select
            aria-label="Filter status tautan"
            value={linkStatus}
            onChange={(e) => {
              setLinkStatus(e.target.value);
              setPage(1);
            }}
            className="input-field w-full min-w-0 min-h-10 px-3 py-2 text-xs"
          >
            <option value="">Semua Tautan</option>
            <option value="verified_post">Post Terverifikasi</option>
            <option value="verified_article">Artikel Media</option>
            <option value="search_fallback">Perlu Verifikasi</option>
          </select>
        </div>

        {/* Deduplication & Drilldown Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)] text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setExcludeNearDuplicates((prev) => !prev);
                setPage(1);
              }}
              aria-pressed={excludeNearDuplicates}
              className={`min-h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-semibold border transition-colors ${
                excludeNearDuplicates
                  ? 'bg-[var(--accent-gold-subtle)] border-[var(--accent-gold-border)] text-[var(--accent-gold-text)]'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {excludeNearDuplicates
                  ? `Saring Duplikat${metaCounts && metaCounts.hidden_near_duplicates > 0 ? ` (${metaCounts.hidden_near_duplicates})` : ''}`
                  : `Semua Duplikat${metaCounts && metaCounts.total_near_duplicates > 0 ? ` (${metaCounts.total_near_duplicates})` : ''}`}
              </span>
            </button>

            {botClusterId && (
              <span className="min-h-9 inline-flex items-center gap-1.5 px-3 rounded-xl bg-[var(--sentiment-neg-subtle)] border border-[var(--sentiment-neg-border)] text-[var(--sentiment-neg)] text-[11px] font-semibold">
                <Copy className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Klaster #{botClusterId}</span>
                <button
                  type="button"
                  onClick={() => {
                    setBotClusterId('');
                    setExcludeNearDuplicates(true);
                    setPage(1);
                  }}
                  aria-label="Hapus filter klaster copypasta"
                  className="ml-0.5 p-1 rounded hover:bg-[var(--bg-surface)]"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </span>
            )}

            {authorName && (
              <span className="min-h-9 inline-flex items-center gap-1.5 px-3 rounded-xl bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] text-[var(--accent-gold-text)] text-[11px] font-semibold">
                <User className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Akun: {authorName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthorName('');
                    setPage(1);
                  }}
                  aria-label="Hapus filter akun"
                  className="ml-0.5 p-1 rounded hover:bg-[var(--bg-surface)]"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </span>
            )}
          </div>

          <span className="text-[11px] text-[var(--text-muted)] hidden md:inline">
            Klasifikasi sentimen dan penyaringan duplikat berjalan otomatis
          </span>
        </div>
      </div>

      {/* Master-Detail Split Studio (Ref 2 Inspired) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Pane: Mentions List */}
        <div className="lg:col-span-5 min-w-0">
          <div className="surface-card overflow-hidden flex flex-col lg:h-[760px]">
            <div className="px-4 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[var(--text-primary)] truncate">
                {provider === 'social' || isSocialProvider(provider)
                  ? 'Arus Media Sosial'
                  : provider === 'rss'
                    ? 'Arus Berita Nasional'
                    : 'Daftar Sebutan'}
              </span>
              <span className="shrink-0 text-[var(--text-muted)] font-mono-code font-tabular">
                Hal. {page} / {data?.pagination?.last_page || 1}
              </span>
            </div>

            <div
              className={`flex-1 lg:overflow-y-auto p-3 space-y-2.5 transition-opacity ${
                isPlaceholderData ? 'opacity-65' : 'opacity-100'
              }`}
            >
              {isLoading ? (
                <div className="space-y-3" role="status" aria-label="Memuat daftar sebutan">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="surface-inset p-4 animate-pulse space-y-2">
                      <div className="h-3 bg-[var(--border-subtle)] rounded w-1/3" />
                      <div className="h-4 bg-[var(--border-medium)] rounded w-full" />
                      <div className="h-3 bg-[var(--border-subtle)] rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : mentionsList.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <MessageSquareText className="w-8 h-8 mx-auto text-[var(--text-muted)]" aria-hidden="true" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Tidak ada sebutan yang cocok
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Coba hapus beberapa filter aktif atau ubah kata kunci pencarian.
                  </p>
                </div>
              ) : (
                mentionsList.map((item) => {
                  const isSelected = activeMention?.id === item.id;
                  const isNearDup = Boolean(item.is_near_duplicate || item.metadata_json?.is_near_duplicate);

                  return (
                    <article
                      key={item.id}
                      className={`relative rounded-2xl border p-3.5 transition-colors space-y-2 ${
                        isSelected
                          ? 'bg-[var(--bg-surface-elevated)] border-[var(--accent-gold-border)]'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)] hover:border-[var(--border-medium)]'
                      }`}
                    >
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-[var(--accent-gold)]"
                        />
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <PlatformBadge
                            provider={item.provider}
                            size="xs"
                            compactLabel
                            isComment={Boolean(item.metadata_json?.is_comment)}
                            ingestionSource={item.ingestion_source || item.metadata_json?.ingestion_source}
                          />
                          <span className="font-semibold text-[var(--text-primary)] truncate max-w-[130px]">
                            {extractDomain(item.source_url, item.author_name, item.provider)}
                          </span>
                        </div>

                        <div className="flex items-center flex-wrap gap-1.5">
                          {(item.is_sarcasm || item.metadata_json?.sarcasm_analysis?.is_sarcasm) && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)]">
                              Sarkasme
                            </span>
                          )}
                          {(item.is_inauthentic || item.metadata_json?.bot_analysis?.is_inauthentic) && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)]">
                              Bot
                            </span>
                          )}
                          {isNearDup && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                              Duplikat
                            </span>
                          )}
                          {getSentimentPill(item.sentiment?.label)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectMention(item)}
                        className="w-full text-left text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent-gold-text)] line-clamp-2 leading-snug transition-colors"
                      >
                        {item.text}
                      </button>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] pt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-code font-tabular">{formatTimestamp(item.published_at)}</span>
                          <SocialEngagementBar
                            metrics={item.metadata_json?.metrics}
                            likesFallback={item.metadata_json?.likes}
                            metricsAvailable={item.metadata_json?.metrics_available}
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          {onOpenAiWithQuery && (
                            <button
                              type="button"
                              onClick={() => {
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
                              className="min-h-8 px-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--accent-gold-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-gold-text)] border border-[var(--border-subtle)] inline-flex items-center gap-1 transition-colors"
                              aria-label="Analisis sebutan ini dengan AI"
                            >
                              <MessageSquareText className="w-3 h-3" aria-hidden="true" />
                              <span>AI</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSelectMention(item)}
                            className="lg:hidden min-h-8 px-2 rounded-lg text-[var(--accent-gold-text)] font-semibold inline-flex items-center gap-0.5"
                          >
                            <span>Detail</span>
                            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {data?.pagination && data.pagination.last_page > 1 && (
              <div className="p-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-ghost-surface min-h-10 px-3 inline-flex items-center gap-1 font-semibold disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>
                <span className="text-[var(--text-secondary)] font-mono-code font-tabular">
                  {page} / {data.pagination.last_page}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(data.pagination.last_page, p + 1))}
                  disabled={page >= data.pagination.last_page}
                  className="btn-ghost-surface min-h-10 px-3 inline-flex items-center gap-1 font-semibold disabled:opacity-40"
                >
                  <span className="hidden sm:inline">Selanjutnya</span>
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Desktop Deep Reading Inspector */}
        <div className="hidden lg:block lg:col-span-7 sticky top-20 min-w-0">
          {activeMention ? (
            <div className="surface-card p-6 sm:p-7 h-[760px] flex flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                {/* Meta Ribbon */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center flex-wrap gap-2">
                    <PlatformBadge
                      provider={activeMention.provider}
                      size="sm"
                      isComment={Boolean(activeMention.metadata_json?.is_comment)}
                      ingestionSource={
                        activeMention.ingestion_source || activeMention.metadata_json?.ingestion_source
                      }
                    />
                    <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-semibold">
                      {extractDomain(activeMention.source_url, activeMention.author_name, activeMention.provider)}
                    </span>
                    <span className="text-[var(--text-muted)] text-xs font-mono-code font-tabular inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
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
                        className="btn-gold min-h-9 px-3.5 text-xs inline-flex items-center gap-1.5"
                      >
                        <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Analisis AI</span>
                      </button>
                    )}

                    {activeLink?.isExternalNavigable && activeLink.href && (
                      <a
                        href={activeLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost-surface min-h-9 px-3 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <span>
                          {activeLink.isSearchFallback
                            ? 'Cari di Platform'
                            : activeIsSocial
                              ? 'Postingan Asli'
                              : 'Tautan Asli'}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Quote / Article Text */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-[var(--accent-gold-text)]">
                    {activeIsSocial ? 'Isi Postingan / Komentar Netizen' : 'Kutipan & Teks Lengkap'}
                  </div>
                  <h2 className="font-editorial text-xl sm:text-2xl font-medium text-[var(--text-primary)] leading-relaxed">
                    &ldquo;{activeMention.text}&rdquo;
                  </h2>

                  {(activeIsSocial || activeMention.metadata_json?.metrics) && (
                    <div className="pt-1">
                      <SocialEngagementBar
                        metrics={activeMention.metadata_json?.metrics}
                        likesFallback={activeMention.metadata_json?.likes}
                        metricsAvailable={activeMention.metadata_json?.metrics_available}
                        showUnavailableHint={activeIsSocial}
                      />
                    </div>
                  )}
                </div>

                {/* NLP Sentiment Classification */}
                <div className="surface-inset p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--text-primary)]">
                      Klasifikasi Sentimen NLP
                    </span>
                    <div className="flex items-center gap-2">
                      {getSentimentPill(activeMention.sentiment?.label)}
                      {activeMention.sentiment?.confidence && (
                        <span className="text-xs font-tabular text-[var(--text-secondary)]">
                          {Math.round(activeMention.sentiment.confidence * 100)}% keyakinan
                        </span>
                      )}
                    </div>
                  </div>

                  {(activeMention.metadata_json?.ai_analysis?.key_reason ||
                    activeMention.metadata_json?.ai_analysis?.aspect ||
                    activeMention.metadata_json?.ai_analysis?.urgency) && (
                    <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {activeMention.metadata_json.ai_analysis.aspect && (
                            <span className="px-2 py-0.5 rounded-lg bg-[var(--bg-surface-elevated)] text-[11px] text-[var(--text-secondary)]">
                              Aspek: {activeMention.metadata_json.ai_analysis.aspect}
                            </span>
                          )}
                          {activeMention.metadata_json.ai_analysis.urgency && (
                            <span className="px-2 py-0.5 rounded-lg bg-[var(--accent-gold-subtle)] text-[11px] font-semibold text-[var(--accent-gold-text)]">
                              Urgensi: {activeMention.metadata_json.ai_analysis.urgency}
                            </span>
                          )}
                        </div>
                        {activeMention.metadata_json.ai_analysis.engine && (
                          <span className="text-[11px] font-mono-code text-[var(--text-muted)]">
                            {activeMention.metadata_json.ai_analysis.engine}
                          </span>
                        )}
                      </div>
                      {activeMention.metadata_json.ai_analysis.key_reason && (
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          <strong className="text-[var(--text-primary)]">Catatan Analisis:</strong>{' '}
                          {activeMention.metadata_json.ai_analysis.key_reason}
                        </p>
                      )}
                    </div>
                  )}

                  {activeMention.sentiment?.probabilities_json && (
                    <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                      <div className="flex items-center justify-between text-xs font-tabular">
                        <span className="text-[var(--sentiment-pos)] font-semibold">
                          Positif {Math.round(activeMention.sentiment.probabilities_json.positive * 100)}%
                        </span>
                        <span className="text-[var(--text-secondary)] font-semibold">
                          Netral {Math.round(activeMention.sentiment.probabilities_json.neutral * 100)}%
                        </span>
                        <span className="text-[var(--sentiment-neg)] font-semibold">
                          Negatif {Math.round(activeMention.sentiment.probabilities_json.negative * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden flex gap-0.5">
                        <div
                          style={{ width: `${Math.round(activeMention.sentiment.probabilities_json.positive * 100)}%` }}
                          className="bg-[var(--sentiment-pos-bar)] h-full"
                        />
                        <div
                          style={{ width: `${Math.round(activeMention.sentiment.probabilities_json.neutral * 100)}%` }}
                          className="bg-[var(--sentiment-neu-bar)] h-full"
                        />
                        <div
                          style={{ width: `${Math.round(activeMention.sentiment.probabilities_json.negative * 100)}%` }}
                          className="bg-[var(--sentiment-neg-bar)] h-full"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Authenticity Telemetry */}
                {(activeMention.is_sarcasm ||
                  activeMention.metadata_json?.sarcasm_analysis?.is_sarcasm ||
                  activeMention.is_inauthentic ||
                  activeMention.metadata_json?.bot_analysis?.is_inauthentic ||
                  activeMention.is_near_duplicate ||
                  activeMention.metadata_json?.is_near_duplicate ||
                  activeMention.bot_cluster_id) && (
                  <div className="p-4 rounded-2xl bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] space-y-3 text-xs">
                    <div className="font-semibold text-[var(--accent-gold-text)]">
                      Deteksi Keaslian Opini &amp; Sarkasme
                    </div>

                    {(activeMention.is_near_duplicate ||
                      activeMention.metadata_json?.is_near_duplicate ||
                      activeMention.bot_cluster_id) && (
                      <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                            <Copy className="w-3.5 h-3.5 text-[var(--accent-gold-text)]" aria-hidden="true" />
                            <span>
                              {activeMention.bot_cluster_id
                                ? `Terhubung ke Klaster Copypasta #${activeMention.bot_cluster_id}`
                                : 'Teridentifikasi Teks Duplikat Serupa'}
                            </span>
                          </span>
                          {(activeMention.near_duplicate_of_id ||
                            activeMention.metadata_json?.near_duplicate_of_id) && (
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              Merujuk dokumen #{activeMention.near_duplicate_of_id || activeMention.metadata_json?.near_duplicate_of_id}.
                            </p>
                          )}
                        </div>
                        {activeMention.bot_cluster_id && (
                          <button
                            type="button"
                            onClick={() => {
                              setBotClusterId(activeMention.bot_cluster_id || '');
                              setExcludeNearDuplicates(false);
                              setPage(1);
                            }}
                            className="btn-ghost-surface min-h-8 px-2.5 text-[11px] font-semibold"
                          >
                            Filter Klaster Ini
                          </button>
                        )}
                      </div>
                    )}

                    {(activeMention.is_sarcasm || activeMention.metadata_json?.sarcasm_analysis?.is_sarcasm) && (
                      <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[var(--accent-gold-text)] inline-flex items-center gap-1.5">
                            <MessageSquareWarning className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Terdeteksi Sarkasme / Satir Politik</span>
                          </span>
                          <span className="text-[10.5px] px-2 py-0.5 rounded-lg bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] font-semibold">
                            Dikoreksi ke Negatif
                          </span>
                        </div>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                          {activeMention.metadata_json?.sarcasm_analysis?.sarcasm_reason ||
                            'Komentar menggunakan pujian ironis untuk menyindir kebijakan publik.'}
                        </p>
                      </div>
                    )}

                    {(activeMention.is_inauthentic || activeMention.metadata_json?.bot_analysis?.is_inauthentic) && (
                      <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--sentiment-neg-border)] space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[var(--sentiment-neg)] inline-flex items-center gap-1.5">
                            <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Terindikasi Amplifikasi Bot / Buzzer</span>
                          </span>
                          <span className="font-tabular text-[10.5px] px-2 py-0.5 rounded-lg bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] font-bold">
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
                            <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-0.5">
                              {activeMention.metadata_json.bot_analysis.bot_signals.map((sig, idx) => (
                                <li key={idx}>{sig}</li>
                              ))}
                            </ul>
                          )}
                      </div>
                    )}
                  </div>
                )}

                {/* Keywords & Topics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeMention.keywords && activeMention.keywords.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-[var(--text-secondary)] block mb-2">
                        Kata Kunci Terdeteksi
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeMention.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                          >
                            <Hash className="w-3 h-3 text-[var(--accent-gold-text)]" aria-hidden="true" />
                            <span>{kw.keyword}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeMention.topics && activeMention.topics.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-[var(--text-secondary)] block mb-2">
                        Topik Pemantauan Terkait
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeMention.topics.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] text-xs font-medium text-[var(--accent-gold-text)]"
                          >
                            <Tag className="w-3 h-3" aria-hidden="true" />
                            <span>{t.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Provenance */}
              <div className="pt-4 mt-6 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                <span className="font-mono-code">
                  ID #{activeMention.id}
                  {activeMention.metadata_json?.raw_source && ` | ${activeMention.metadata_json.raw_source}`}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 font-medium ${
                    activeLink?.isVerifiedDirect ? 'text-[var(--sentiment-pos)]' : 'text-[var(--accent-gold-text)]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {activeLink?.isVerifiedDirect ? 'Tautan Terverifikasi' : activeLink?.reason || 'Pipeline Ingesti'}
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div className="surface-card p-12 h-[760px] flex items-center justify-center text-center">
              <div className="space-y-2 max-w-xs">
                <MessageSquareText className="w-9 h-9 mx-auto text-[var(--text-muted)]" aria-hidden="true" />
                <h2 className="font-editorial text-lg font-medium text-[var(--text-primary)]">
                  Pilih Dokumen Sebutan
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Pilih salah satu item di daftar sebelah kiri untuk membaca analisis sentimen dan buktinya secara lengkap.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      <MentionInspectorDrawer
        mention={mobileInspectorMention}
        onClose={() => setMobileInspectorMention(null)}
        onAskAi={
          onOpenAiWithQuery
            ? (mention) => {
                setMobileInspectorMention(null);
                const tId = mention.topics?.[0]?.id;
                const srcLabel =
                  mention.author_name || extractDomain(mention.source_url, mention.author_name, mention.provider);
                const isSoc = isSocialProvider(mention.provider);
                onOpenAiWithQuery(
                  isSoc
                    ? `Bedah dan analisis opini media sosial (${getPlatformMeta(mention.provider).label}) ini: "${mention.text}" (Akun: ${srcLabel}, Sentimen: ${mention.sentiment?.label || 'Netral'}). Jelaskan konteks sentimen netizen, potensi eskalasi isu, dan respons komunikasi yang disarankan.`
                    : `Bedah dan analisis secara mendalam artikel/sebutan ini: "${mention.text}" (Sumber: ${srcLabel}, Sentimen: ${mention.sentiment?.label || 'Netral'}). Jelaskan implikasi isu, potensi resistensi publik, dan poin kebijakan terkait.`,
                  tId
                );
              }
            : undefined
        }
      />
    </div>
  );
}
