import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, TopicItem, AiTopicSummary } from '@/lib/api';
import {
  Plus,
  RefreshCw,
  Target,
  X,
  Check,
  Tag,
  Flame,
  Activity,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MessageSquareText,
} from 'lucide-react';

interface TopicsPageProps {
  onNavigateToMentions?: (topicId: number) => void;
  onOpenAiWithQuery?: (query: string, topicId?: number) => void;
}

export function TopicsPage({ onNavigateToMentions, onOpenAiWithQuery }: TopicsPageProps = {}) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncingTopicId, setSyncingTopicId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // AI Topic Summary Modal State
  const [summaryTopic, setSummaryTopic] = useState<TopicItem | null>(null);
  const [summaryData, setSummaryData] = useState<AiTopicSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includeKeywords, setIncludeKeywords] = useState('');
  const [excludeKeywords, setExcludeKeywords] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['rss']);

  // Handle escape key to close modal (R-32)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Fetch Topics
  const { data: topics, isLoading } = useQuery({
    queryKey: ['topics-list'],
    queryFn: async () => {
      const res = await api.get<{ data: TopicItem[] }>('/workspaces/1/topics');
      return res.data.data;
    },
  });

  // Create Topic Mutation
  const createTopicMutation = useMutation({
    mutationFn: async () => {
      const inc = includeKeywords.split(',').map((s) => s.trim()).filter(Boolean);
      const exc = excludeKeywords.split(',').map((s) => s.trim()).filter(Boolean);

      const res = await api.post('/workspaces/1/topics', {
        name,
        description,
        include_keywords: inc,
        exclude_keywords: exc,
        providers: selectedProviders,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setIncludeKeywords('');
      setExcludeKeywords('');
      setFeedbackMsg('Topik pemantauan baru berhasil dibuat dan diaktifkan.');
      setTimeout(() => setFeedbackMsg(null), 4000);
    },
  });

  // Sync Topic Mutation
  const handleSyncTopic = async (topicId: number) => {
    setSyncingTopicId(topicId);
    try {
      const res = await api.post(`/topics/${topicId}/sync`);
      queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['mentions-explorer'] });
      setFeedbackMsg(res.data.message || 'Sinkronisasi topik berhasil diselesaikan.');
    } catch {
      setFeedbackMsg('Gagal melakukan sinkronisasi topik.');
    } finally {
      setSyncingTopicId(null);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleViewAiSummary = async (topic: TopicItem, forceRefresh = false) => {
    setSummaryTopic(topic);
    setIsSummaryLoading(true);
    setSummaryData(null);
    try {
      const res = await api.get<{ status: string; data: AiTopicSummary }>(`/topics/${topic.id}/ai-summary`, {
        params: { refresh: forceRefresh }
      });
      setSummaryData(res.data.data);
    } catch {
      setFeedbackMsg('Gagal memuat ringkasan eksekutif AI untuk topik ini.');
      setTimeout(() => setFeedbackMsg(null), 4000);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const toggleProvider = (provider: string) => {
    if (selectedProviders.includes(provider)) {
      if (selectedProviders.length > 1) {
        setSelectedProviders(selectedProviders.filter((p) => p !== provider));
      }
    } else {
      setSelectedProviders([...selectedProviders, provider]);
    }
  };

  const topicItems = topics || [];
  const totalTrackedMentions = topicItems.reduce((acc, t) => acc + (t.mentions_count || 0), 0);
  const highestTopic = topicItems.reduce<TopicItem | null>((max, t) => {
    if (!max || t.mentions_count > max.mentions_count) return t;
    return max;
  }, null);

  return (
    <div className="space-y-6 font-sans-ui">
      {/* Page Header */}
      <div className="border-b border-white/[0.08] pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-xs">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-editorial text-2xl font-medium text-white tracking-tight">
              Radar Topik &amp; Manajemen Isu
            </h1>
            <p className="text-xs text-zinc-400 font-sans-ui">
              Konfigurasi entitas pantau, kata kunci inklusi, eksklusi, dan status akselerasi tren publik
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Topik Baru</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-zinc-400 hover:text-white" aria-label="Tutup pesan">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Bento Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bento-card p-4 sm:p-5 bg-[#0e1117] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 font-mono-code block mb-1">
              Topik Aktif Dipantau
            </span>
            <div className="text-2xl font-extrabold text-white font-mono-code">
              {topicItems.length} <span className="text-xs font-normal text-zinc-400 font-sans-ui">Entitas</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Target className="w-4 h-4" />
          </div>
        </div>

        <div className="bento-card p-4 sm:p-5 bg-[#0e1117] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 font-mono-code block mb-1">
              Topik Terhangat Hari Ini
            </span>
            <div className="text-sm font-bold text-white truncate max-w-[180px]">
              {highestTopic ? highestTopic.name : 'Belum Terdeteksi'}
            </div>
            <span className="text-[11px] text-amber-400 font-mono-code">
              {highestTopic ? `${highestTopic.mentions_count} Sebutan` : ''}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Flame className="w-4 h-4" />
          </div>
        </div>

        <div className="bento-card p-4 sm:p-5 bg-[#0e1117] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 font-mono-code block mb-1">
              Total Sebutan Terpetakan
            </span>
            <div className="text-2xl font-extrabold text-white font-mono-code">
              {totalTrackedMentions.toLocaleString('id-ID')}
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Topic Cards 2-Column Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : topicItems.length === 0 ? (
        <div className="bento-card p-12 text-center bg-[#0e1117]">
          <Target className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">Belum Ada Topik Pemantauan</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4 font-sans-ui">
            Buat topik baru untuk mulai memantau percakapan publik di media digital terhubung.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Topik Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {topicItems.map((topic, idx) => {
            const isSyncing = syncingTopicId === topic.id;
            const incKws = topic.keywords.filter((k) => k.type === 'include');
            const pos = topic.positive_count ?? 0;
            const neu = topic.neutral_count ?? 0;
            const neg = topic.negative_count ?? 0;
            const totalSent = pos + neu + neg;
            const posPct = totalSent > 0 ? Math.round((pos / totalSent) * 100) : 0;
            const neuPct = totalSent > 0 ? Math.round((neu / totalSent) * 100) : 0;
            const negPct = totalSent > 0 ? Math.round((neg / totalSent) * 100) : 0;

            const isTopTopic = idx === 0 && topic.mentions_count > 0;

            return (
              <div
                key={topic.id}
                className={`bento-card p-5 bg-[#0c0f16] border flex flex-col justify-between transition-all hover:border-white/20 shadow-lg ${
                  isTopTopic ? 'border-amber-500/40 bg-gradient-to-br from-[#121624] to-[#0c0f16]' : 'border-white/[0.08]'
                }`}
              >
                {/* Top Section */}
                <div className="space-y-3.5">
                  {/* Header Row: Rank, Title, and Main Mentions KPI */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Rank Indicator */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono-code text-xs font-bold shrink-0 mt-0.5 border ${
                        isTopTopic
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                          : 'bg-white/[0.04] text-zinc-400 border-white/[0.08]'
                      }`}>
                        #{idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-editorial text-lg font-medium text-white tracking-tight leading-snug">
                            {topic.name}
                          </h2>
                          {isTopTopic && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Flame className="w-3 h-3 text-amber-400" /> Terbanyak
                            </span>
                          )}
                        </div>
                        {topic.description && (
                          <p className="text-[11.5px] text-zinc-400 mt-0.5 line-clamp-1 font-sans-ui">
                            {topic.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Prominent Bold Mention KPI */}
                    <div className="text-right shrink-0 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-1.5">
                      <div className="text-xl sm:text-2xl font-black font-mono-code text-white tracking-tight">
                        {topic.mentions_count.toLocaleString('id-ID')}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-sans-ui block -mt-0.5">
                        sebutan publik
                      </span>
                    </div>
                  </div>

                  {/* Sentiment Barometer Strip (Angka & Grafik Visual) */}
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono-code">
                      <span className="text-zinc-400 font-medium">Distribusi Sentimen:</span>
                      {totalSent > 0 ? (
                        <div className="flex items-center gap-2.5">
                          <span className="text-emerald-400 font-semibold">{posPct}% Pos</span>
                          <span className="text-zinc-400 font-semibold">{neuPct}% Net</span>
                          <span className="text-rose-400 font-semibold">{negPct}% Neg</span>
                        </div>
                      ) : (
                        <span className="text-zinc-500 italic">Belum ada sebutan masuk</span>
                      )}
                    </div>

                    <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden flex border border-white/[0.06]">
                      {totalSent > 0 ? (
                        <>
                          <div style={{ width: `${posPct}%` }} className="h-full bg-emerald-500 transition-all duration-300" title={`Positif: ${posPct}% (${pos})`} />
                          <div style={{ width: `${neuPct}%` }} className="h-full bg-zinc-600 transition-all duration-300" title={`Netral: ${neuPct}% (${neu})`} />
                          <div style={{ width: `${negPct}%` }} className="h-full bg-rose-500 transition-all duration-300" title={`Negatif: ${negPct}% (${neg})`} />
                        </>
                      ) : (
                        <div className="w-full h-full bg-zinc-800" />
                      )}
                    </div>
                  </div>

                  {/* Compact Keywords Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <Tag className="w-3 h-3 text-zinc-500 shrink-0" />
                    {incKws.slice(0, 3).map((kw) => (
                      <span
                        key={kw.id}
                        className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-mono-code"
                      >
                        +{kw.keyword}
                      </span>
                    ))}
                    {incKws.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-white/[0.04] text-zinc-400 border border-white/[0.06] text-[10px] font-mono-code">
                        +{incKws.length - 3} lainnya
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-3 border-t border-white/[0.06]">
                  <span className="text-[10px] text-zinc-500 font-mono-code">
                    Sumber: {topic.providers?.join(', ').toUpperCase() || 'RSS'}
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {onNavigateToMentions && (
                      <button
                        type="button"
                        onClick={() => onNavigateToMentions(topic.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-xs text-blue-300 font-semibold transition-all cursor-pointer shadow-xs"
                        title="Buka seluruh dokumen sebutan topik ini di Mentions Explorer"
                      >
                        <MessageSquareText className="w-3.5 h-3.5 text-blue-400" />
                        <span>Sebutan</span>
                      </button>
                    )}

                    {onOpenAiWithQuery && (
                      <button
                        type="button"
                        onClick={() => onOpenAiWithQuery(
                          `Konsultasi intelijen strategis untuk program ${topic.name}: jelaskan dinamika polaritas sentimen publik, isu paling kontroversial atau apresiatif, dan saran tindak lanjut komunikasinya.`,
                          topic.id
                        )}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 text-xs text-cyan-200 font-semibold transition-all cursor-pointer shadow-xs"
                        title="Tanyakan dan analisis topik ini langsung di Asisten AI TRINETRA"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Tanya AI</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleViewAiSummary(topic)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-xs text-zinc-300 font-semibold transition-all cursor-pointer shadow-xs"
                      title="Lihat Sintesis Analisis AI"
                    >
                      <FileText className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Ringkasan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSyncTopic(topic.id)}
                      disabled={isSyncing}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
                      <span>{isSyncing ? 'Sinkron...' : 'Sinkron'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Topic Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.12] bg-[#0c0e14] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
                <h2 className="font-editorial text-lg font-medium text-white">
                  Buat Topik Pemantauan Baru
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                aria-label="Tutup formulir"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1.5 text-xs">
                  Nama Topik Pemantauan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kualitas Kebijakan Publik"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors shadow-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1.5 text-xs">
                  Deskripsi / Konteks Pemantauan
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan tujuan atau fokus pemantauan isu..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors shadow-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1.5 text-xs">
                  Kata Kunci Pantau (Pisahkan Koma) *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pemerintah, kebijakan, anggaran"
                  value={includeKeywords}
                  onChange={(e) => setIncludeKeywords(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors shadow-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1.5 text-xs">
                  Kata Kunci Pengecualian / Exclude (Pisahkan Koma)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: lowongan, karir, promo, spam"
                  value={excludeKeywords}
                  onChange={(e) => setExcludeKeywords(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors shadow-xs"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-2 text-xs">
                  Pilih Platform Sumber Data
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05]">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes('rss')}
                      onChange={() => toggleProvider('rss')}
                      className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-0"
                    />
                    <span>Media Berita (RSS)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05]">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes('youtube')}
                      onChange={() => toggleProvider('youtube')}
                      className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-0"
                    />
                    <span>YouTube</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05]">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes('x')}
                      onChange={() => toggleProvider('x')}
                      className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-0"
                    />
                    <span>Twitter / X</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05]">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes('tiktok')}
                      onChange={() => toggleProvider('tiktok')}
                      className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-0"
                    />
                    <span>TikTok</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05]">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes('instagram')}
                      onChange={() => toggleProvider('instagram')}
                      className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-0"
                    />
                    <span>Instagram</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05]">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes('facebook')}
                      onChange={() => toggleProvider('facebook')}
                      className="rounded border-white/[0.1] bg-white/[0.05] text-blue-500 focus:ring-0"
                    />
                    <span>Facebook</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-white/[0.08] text-zinc-300 hover:bg-white/[0.05] transition-colors font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!name.trim() || !includeKeywords.trim() || createTopicMutation.isPending}
                onClick={() => createTopicMutation.mutate()}
                className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {createTopicMutation.isPending ? 'Menyimpan...' : 'Simpan & Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Executive Intelligence Briefing Modal */}
      {summaryTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl border border-white/[0.12] bg-[#0d101a] p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-editorial text-xl font-medium text-white tracking-tight">
                      Executive Intelligence Briefing
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      SINTESIS INTELIJEN AI
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-sans-ui mt-0.5">
                    Program: <strong className="text-white font-medium">{summaryTopic.name}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewAiSummary(summaryTopic, true)}
                  disabled={isSummaryLoading}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  title="Regenerate summary live"
                >
                  <RefreshCw className={`w-4 h-4 ${isSummaryLoading ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
                <button
                  onClick={() => setSummaryTopic(null)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {isSummaryLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400 text-xs">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                <span>Sedang merangkum sebutan dan sentimen terkini...</span>
              </div>
            ) : summaryData ? (
              <div className="space-y-4 text-xs">
                
                {/* Meta Strip */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">Total Sebutan Dianalisis:</span>
                    <strong className="text-white font-mono-code">{summaryData.mentions_analyzed}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">Kecenderungan Sentimen:</span>
                    <span className={`px-2 py-0.5 rounded-md uppercase font-bold text-[10px] ${
                      summaryData.dominant_sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      summaryData.dominant_sentiment === 'negative' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                      'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}>
                      {summaryData.dominant_sentiment}
                    </span>
                  </div>
                </div>

                {/* Executive Overview */}
                <div className="p-4 rounded-xl bg-[#131622] border border-white/[0.08] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-semibold uppercase text-[11px] tracking-wider">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ringkasan Situasi Publik</span>
                  </div>
                  <p className="text-[13px] text-zinc-200 leading-relaxed font-sans-ui">
                    {summaryData.executive_overview}
                  </p>
                </div>

                {/* Positive and Critical Themes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Positives */}
                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/20 space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px] uppercase">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sorotan Positif Utama</span>
                    </div>
                    <ul className="space-y-1.5 text-zinc-300">
                      {summaryData.key_positive_themes && summaryData.key_positive_themes.length > 0 ? (
                        summaryData.key_positive_themes.map((theme, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span>{theme}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-zinc-500 italic">Tidak ada tema positif menonjol.</li>
                      )}
                    </ul>
                  </div>

                  {/* Critical Issues */}
                  <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/20 space-y-2">
                    <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-[11px] uppercase">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Kekhawatiran / Isu Kritis</span>
                    </div>
                    <ul className="space-y-1.5 text-zinc-300">
                      {summaryData.key_critical_themes && summaryData.key_critical_themes.length > 0 ? (
                        summaryData.key_critical_themes.map((theme, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-rose-400 mt-0.5">•</span>
                            <span>{theme}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-zinc-500 italic">Tidak ada isu kritis menonjol.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Recommendations */}
                {summaryData.strategic_recommendations && summaryData.strategic_recommendations.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <div className="font-semibold text-zinc-300 text-[11px] uppercase tracking-wider">
                      Rekomendasi Respons &amp; Kebijakan Komunikasi
                    </div>
                    <ul className="space-y-1 text-zinc-300">
                      {summaryData.strategic_recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-cyan-400 mt-0.5">→</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.08] text-xs">
              <span className="text-zinc-500 font-mono-code text-[11px]">
                {summaryData?.cached_at ? `Diperbarui: ${new Date(summaryData.cached_at).toLocaleTimeString()}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setSummaryTopic(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
