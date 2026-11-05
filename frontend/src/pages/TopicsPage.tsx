import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, TopicItem } from '@/lib/api';
import { Plus, RefreshCw, Target, X, Check } from 'lucide-react';

export function TopicsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncingTopicId, setSyncingTopicId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includeKeywords, setIncludeKeywords] = useState('');
  const [excludeKeywords, setExcludeKeywords] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['rss']);

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
      setFeedbackMsg('Topik monitoring berhasil dibuat.');
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
      setFeedbackMsg(res.data.message || 'Sinkronisasi berhasil.');
    } catch {
      setFeedbackMsg('Gagal melakukan sinkronisasi topik.');
    } finally {
      setSyncingTopicId(null);
      setTimeout(() => setFeedbackMsg(null), 4000);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight mb-1">
            Topik Monitor (Social Listening Monitors)
          </h1>
          <p className="text-xs text-slate-400">
            Kelola kata kunci pantauan, aturan pengecualian (exclusion), dan konektor platform aktif
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Monitor Baru</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Topic Cards List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : topics && topics.length === 0 ? (
          <div className="p-12 text-center border border-slate-800 rounded-xl bg-slate-900/40">
            <p className="text-sm text-slate-400 mb-2">Belum ada topik monitoring dibuat.</p>
            <p className="text-xs text-slate-500">Klik "Buat Monitor Baru" untuk mulai memantau kata kunci publik.</p>
          </div>
        ) : (
          topics?.map((topic) => {
            const isSyncing = syncingTopicId === topic.id;
            const incKws = topic.keywords.filter((k) => k.type === 'include');
            const excKws = topic.keywords.filter((k) => k.type === 'exclude');

            return (
              <div
                key={topic.id}
                className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-white tracking-tight">
                          {topic.name}
                        </h2>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase font-mono ${
                          topic.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {topic.status}
                        </span>
                      </div>
                      {topic.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{topic.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-mono">
                      {topic.mentions_count} Mention
                    </span>

                    <button
                      onClick={() => handleSyncTopic(topic.id)}
                      disabled={isSyncing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-850 hover:bg-slate-800 text-xs text-slate-200 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-400' : ''}`} />
                      <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
                    </button>
                  </div>
                </div>

                {/* Keywords Rules */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                  {/* Include Keywords */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-400 text-[11px] font-medium w-24">Kata Kunci Pantau:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {incKws.map((kw) => (
                        <span key={kw.id} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-medium">
                          +{kw.keyword}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Exclude Keywords */}
                  {excKws.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-400 text-[11px] font-medium w-24">Pengecualian:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {excKws.map((kw) => (
                          <span key={kw.id} className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[11px]">
                            -{kw.keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Platform Active */}
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                    <span className="w-24">Konektor Aktif:</span>
                    <span className="uppercase font-mono text-slate-400">
                      {topic.providers?.join(', ') || 'RSS'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Topic Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white tracking-tight">
                Buat Topik Monitor Baru
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Nama Topik Monitor *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kualitas Layanan Provider X"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Deskripsi / Konteks Pemantauan
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan tujuan atau fokus pemantauan..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Kata Kunci yang Dipantau (Pisahkan dengan koma) *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Brand X, layanan Brand X, aplikasi error"
                  value={includeKeywords}
                  onChange={(e) => setIncludeKeywords(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Kata Kunci Pengecualian / Exclude (Pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: lowongan, karir, loker"
                  value={excludeKeywords}
                  onChange={(e) => setExcludeKeywords(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-2">
                  Pilih Konektor Platform
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes('rss')}
                      onChange={() => toggleProvider('rss')}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Media Berita (RSS)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes('youtube')}
                      onChange={() => toggleProvider('youtube')}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>YouTube Publik</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!name.trim() || !includeKeywords.trim() || createTopicMutation.isPending}
                onClick={() => createTopicMutation.mutate()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {createTopicMutation.isPending ? 'Menyimpan...' : 'Simpan & Aktifkan Monitor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
