import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, MentionItem, TopicItem } from '@/lib/api';
import { MentionList } from '@/components/mentions/MentionList';
import { Search, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface MentionsPageProps {
  initialKeyword?: string;
  initialTopicId?: number;
}

export function MentionsPage({ initialKeyword, initialTopicId }: MentionsPageProps) {
  const [search, setSearch] = useState(initialKeyword || '');
  const [topicId, setTopicId] = useState<number | undefined>(initialTopicId);
  const [provider, setProvider] = useState<string>('');
  const [sentiment, setSentiment] = useState<string>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (initialKeyword) {
      setSearch(initialKeyword);
    }
  }, [initialKeyword]);

  useEffect(() => {
    if (initialTopicId) {
      setTopicId(initialTopicId);
    }
  }, [initialTopicId]);

  // Fetch topics for filter dropdown
  const { data: topics } = useQuery({
    queryKey: ['topics-list'],
    queryFn: async () => {
      const res = await api.get<{ data: TopicItem[] }>('/workspaces/1/topics');
      return res.data.data;
    },
  });

  // Fetch mentions
  const { data, isLoading } = useQuery({
    queryKey: ['mentions-explorer', page, topicId, provider, sentiment, search],
    queryFn: async () => {
      const res = await api.get<{
        data: MentionItem[];
        pagination: { current_page: number; last_page: number; total: number; per_page: number };
      }>('/mentions', {
        params: {
          workspace_id: 1,
          page,
          topic_id: topicId,
          provider: provider || undefined,
          sentiment: sentiment || undefined,
          search: search || undefined,
          per_page: 15,
        },
      });
      return res.data;
    },
  });

  const clearFilters = () => {
    setSearch('');
    setTopicId(undefined);
    setProvider('');
    setSentiment('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || topicId || provider || sentiment);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight mb-1">
          Eksplorasi Mention Publik
        </h1>
        <p className="text-xs text-slate-400">
          Telusuri seluruh artikel berita, video, dan percakapan publik beserta analisis sentimen dan pembuktian tautan asli
        </p>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full md:flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari kata kunci dalam teks percakapan..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Topic Select */}
          <select
            value={topicId || ''}
            onChange={(e) => {
              setTopicId(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="w-full md:w-56 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Semua Topik Monitor</option>
            {topics?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Provider Select */}
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-40 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Semua Platform</option>
            <option value="rss">Media Berita (RSS)</option>
            <option value="youtube">YouTube</option>
            <option value="reddit">Reddit</option>
          </select>

          {/* Sentiment Select */}
          <select
            value={sentiment}
            onChange={(e) => {
              setSentiment(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-36 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Semua Sentimen</option>
            <option value="positive">Positif</option>
            <option value="neutral">Netral</option>
            <option value="negative">Negatif</option>
            <option value="unknown">Unknown</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0 px-2 py-1"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Header Info & Total */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Menampilkan {data?.pagination.total || 0} hasil mention</span>
        {data && (
          <span>Halaman {data.pagination.current_page} dari {data.pagination.last_page}</span>
        )}
      </div>

      {/* Mention List */}
      <MentionList
        mentions={data?.data || []}
        isLoading={isLoading}
      />

      {/* Pagination Controls */}
      {data && data.pagination.last_page > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-400 px-3">
            {page} / {data.pagination.last_page}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pagination.last_page, p + 1))}
            disabled={page >= data.pagination.last_page}
            className="p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
