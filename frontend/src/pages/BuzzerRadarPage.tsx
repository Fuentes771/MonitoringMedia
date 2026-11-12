import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  BuzzerRadarOverview,
  TopicItem,
  CopypastaCluster,
  SarcasmHighlight,
} from '@/lib/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  ShieldAlert,
  ShieldCheck,
  Bot,
  Sparkles,
  Copy,
  RefreshCw,
  AlertTriangle,
  Users,
  MessageSquareWarning,
  ExternalLink,
  CheckCircle2,
  Activity,
} from 'lucide-react';

interface BuzzerRadarPageProps {
  days: number;
  onOpenAiWithQuery?: (query: string, topicId?: number) => void;
}

export function BuzzerRadarPage({ days, onOpenAiWithQuery }: BuzzerRadarPageProps) {
  const queryClient = useQueryClient();
  const [selectedTopicId, setSelectedTopicId] = useState<number | undefined>(undefined);
  const [scanBanner, setScanBanner] = useState<string | null>(null);

  // Fetch topics for filter dropdown
  const { data: topics } = useQuery({
    queryKey: ['topics-list'],
    queryFn: async () => {
      const res = await api.get<{ data: TopicItem[] }>('/workspaces/1/topics');
      return res.data.data;
    },
  });

  // Fetch Buzzer & Sarcasm Radar Overview
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['buzzer-radar-overview', days, selectedTopicId],
    queryFn: async () => {
      const res = await api.get<{ data: BuzzerRadarOverview }>('/buzzer-radar/overview', {
        params: {
          workspace_id: 1,
          days,
          topic_id: selectedTopicId,
        },
      });
      return res.data.data;
    },
  });

  // Force Deep Scan Mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ message: string; data: BuzzerRadarOverview }>(
        '/buzzer-radar/scan',
        {
          workspace_id: 1,
          days,
          topic_id: selectedTopicId,
        }
      );
      return res.data;
    },
    onSuccess: (resData) => {
      setScanBanner(resData.message);
      queryClient.setQueryData(['buzzer-radar-overview', days, selectedTopicId], resData.data);
      queryClient.invalidateQueries({ queryKey: ['mentions-explorer'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });

  const authIndex = data?.authenticity_index;
  const clusters = data?.copypasta_clusters || [];
  const timeline = data?.burst_timeline || [];
  const sarcasmList = data?.sarcasm_highlights || [];
  const suspectedAccounts = data?.suspected_accounts || [];

  const getThreatBadge = (level?: string) => {
    switch (level) {
      case 'HIGH_ASTROTURFING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono-code font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>HIGH ASTROTURFING</span>
          </span>
        );
      case 'ELEVATED_PROPAGANDA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono-code font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Activity className="w-3.5 h-3.5" />
            <span>ELEVATED AMPLIFICATION</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono-code font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>ORGANIC DOMINANT</span>
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans-ui">
      {/* Top Header & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-white tracking-tight">
                Radar Buzzer, Jaringan Bot &amp; Sarkasme Politik
              </h1>
              {getThreatBadge(authIndex?.threat_level)}
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-3xl">
              Deteksi 3-Lapis Perilaku Inautentik Terkoordinasi (CIB), Kluster Narasi Copypasta, serta Pembedahan Satir &amp; Ironi Netizen Indonesia yang membalikkan sentimen pujian palsu menjadi kritik negatif.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Topic Selector */}
          <select
            value={selectedTopicId || ''}
            onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : undefined)}
            className="bg-[#0e1117] border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400/50 transition-colors"
          >
            <option value="">Semua Topik &amp; Isu Nasional</option>
            {topics?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Deep Scan Button */}
          <button
            type="button"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending || isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-200 font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
            <span>
              {scanMutation.isPending ? 'Memindai Jaringan...' : 'Pindai Jaringan & Sarkasme'}
            </span>
          </button>
        </div>
      </div>

      {/* Scan Notification Banner */}
      {scanBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{scanBanner}</span>
          </div>
          <button
            onClick={() => setScanBanner(null)}
            className="text-xs text-emerald-400/80 hover:text-emerald-200 font-mono-code cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 4-Card KPI Strip: Authenticity Index */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Suara Organik */}
        <div className="bento-card p-5 bg-[#0e1117] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-mono-code uppercase tracking-wider text-[10px]">Suara Asli (Organik)</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-white font-mono-code">
              {authIndex?.organic_percent ?? 100}%
            </span>
            <span className="text-xs text-emerald-400 font-mono-code">
              {authIndex?.organic_count ?? 0} / {authIndex?.total_mentions ?? 0} dok
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, authIndex?.organic_percent ?? 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-400">
            Percakapan publik natural &amp; pemberitaan media terverifikasi
          </p>
        </div>

        {/* Card 2: Indikasi Buzzer / Bot */}
        <div className="bento-card p-5 bg-[#0e1117] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-mono-code uppercase tracking-wider text-[10px]">Indikasi Buzzer / Bot</span>
            <Bot className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-rose-400 font-mono-code">
              {authIndex?.inauthentic_percent ?? 0}%
            </span>
            <span className="text-xs text-zinc-300 font-mono-code">
              {authIndex?.inauthentic_count ?? 0} terindikasi
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, authIndex?.inauthentic_percent ?? 0)}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-400">
            Akun anomali angka acak, rentetan tagar, atau duplikasi seragam
          </p>
        </div>

        {/* Card 3: Sarkasme & Satir Politik */}
        <div className="bento-card p-5 bg-[#0e1117] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-mono-code uppercase tracking-wider text-[10px]">Sarkasme &amp; Satir</span>
            <MessageSquareWarning className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-amber-300 font-mono-code">
              {authIndex?.sarcasm_percent ?? 0}%
            </span>
            <span className="text-xs text-amber-300/90 font-mono-code">
              {authIndex?.sarcasm_count ?? 0} dikoreksi
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, authIndex?.sarcasm_percent ?? 0)}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-400">
            Pujian ironis/sindiran yang otomatis dibalik menjadi sentimen Negatif
          </p>
        </div>

        {/* Card 4: Kluster Copypasta */}
        <div className="bento-card p-5 bg-[#0e1117] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-mono-code uppercase tracking-wider text-[10px]">Kluster Copypasta</span>
            <Copy className="w-4 h-4 text-amber-300" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-white font-mono-code">
              {authIndex?.clusters_count ?? 0}
            </span>
            <span className="text-xs text-zinc-400 font-mono-code">
              Kemiripan &ge;75%
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 pt-1">
            Kelompok teks kampanye seragam yang disebarkan lintas akun dalam jendela waktu berdekatan
          </div>
        </div>
      </div>

      {/* Burst Attack & Sarcasm Timeline Chart */}
      <div className="bento-card p-6 bg-[#0e1117] border border-white/[0.08] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-amber-300 block">
              Kronologi Velositas &amp; Anomali
            </span>
            <h2 className="text-base font-semibold text-white">
              Perbandingan Arus Opini Organik vs. Serangan Bot &amp; Gelombang Sarkasme
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono-code">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Organik
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Indikasi Bot/Buzzer
            </span>
            <span className="flex items-center gap-1.5 text-amber-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              Sarkasme/Satir
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradOrganic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradBot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradSarcasm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="time_label"
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
              />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0c12',
                  borderColor: 'rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#f4f5f8',
                }}
              />
              <Area
                type="monotone"
                dataKey="organic"
                name="Suara Organik"
                stroke="#10b981"
                fill="url(#gradOrganic)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="inauthentic"
                name="Indikasi Bot / Buzzer"
                stroke="#f43f5e"
                fill="url(#gradBot)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="sarcasm"
                name="Komentar Sarkasme"
                stroke="#fbbf24"
                fill="url(#gradSarcasm)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2-Column Deep Analysis: Copypasta Clusters (Left) & Sarcasm Dissection (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (6 cols): Kluster Narasi Copypasta */}
        <div className="lg:col-span-6 bento-card p-6 bg-[#0e1117] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
            <div>
              <span className="text-[10px] font-mono-code uppercase tracking-wider text-rose-400 block">
                Layer 1 &amp; 3 — Deteksi Amplifikasi Seragam
              </span>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Copy className="w-4 h-4 text-rose-400" />
                <span>Kluster Narasi Copypasta Terkoordinasi</span>
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono-code text-zinc-300">
              {clusters.length} Kluster
            </span>
          </div>

          {clusters.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-white/[0.05] bg-white/[0.01] space-y-2">
              <ShieldCheck className="w-8 h-8 text-emerald-400/70 mx-auto" />
              <div className="text-sm font-medium text-zinc-200">
                Tidak Ditemukan Serangan Copypasta Masif
              </div>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Seluruh percakapan pada rentang waktu ini memiliki variasi diksi natural dan tidak menunjukkan duplikasi template beruntun (&ge;75%).
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
              {clusters.map((cluster: CopypastaCluster) => (
                <div
                  key={cluster.cluster_id}
                  className="p-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.04] space-y-3 transition-colors hover:border-rose-500/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono-code text-[10px] font-bold">
                        {cluster.copy_count}x Duplikasi
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/[0.06] text-zinc-200 border border-white/[0.1] font-mono-code text-[10px]">
                        {cluster.unique_accounts_count} Akun
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono-code">
                        #{cluster.cluster_id}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-full">
                      {cluster.narrative_agenda}
                    </span>
                  </div>

                  {/* Canonical Text */}
                  <div className="p-3 rounded-lg bg-[#08090d]/90 border border-white/[0.07] text-xs text-zinc-200 leading-relaxed font-sans-ui">
                    &ldquo;{cluster.canonical_text}&rdquo;
                  </div>

                  {/* Accounts & Metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-zinc-400">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-zinc-500" />
                      {cluster.accounts.slice(0, 5).map((acc, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-zinc-300 font-mono-code text-[10px]"
                        >
                          {acc}
                        </span>
                      ))}
                      {cluster.accounts.length > 5 && (
                        <span className="text-[10px] text-zinc-500 font-mono-code">
                          +{cluster.accounts.length - 5} lainnya
                        </span>
                      )}
                    </div>

                    {onOpenAiWithQuery && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAiWithQuery(
                            `Analisis motif dan agenda di balik kluster narasi copypasta ini (${cluster.copy_count} duplikasi dari ${cluster.unique_accounts_count} akun): "${cluster.canonical_text}". Apa tujuan penggiringan opininya?`
                          )
                        }
                        className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Bedah Agenda AI</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (6 cols): Pembedahan Sarkasme & Satir Politik */}
        <div className="lg:col-span-6 bento-card p-6 bg-[#0e1117] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
            <div>
              <span className="text-[10px] font-mono-code uppercase tracking-wider text-amber-300 block">
                Hybrid Lexicon + 9Router LLM
              </span>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <MessageSquareWarning className="w-4 h-4 text-amber-400" />
                <span>Pembedahan Sarkasme &amp; Satir Politik Netizen</span>
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs font-mono-code text-amber-300">
              {sarcasmList.length} Terdeteksi
            </span>
          </div>

          {sarcasmList.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-white/[0.05] bg-white/[0.01] space-y-2">
              <MessageSquareWarning className="w-8 h-8 text-zinc-500 mx-auto" />
              <div className="text-sm font-medium text-zinc-200">
                Belum Ada Komentar Sarkasme pada Filter Ini
              </div>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Komentar netizen yang menggunakan pujian ironis (seperti &ldquo;saking bagusnya&rdquo;, &ldquo;menyala abangkuh&rdquo;, atau emoji 🗿/🤡) akan otomatis muncul di sini dan dikoreksi menjadi sentimen Negatif.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
              {sarcasmList.map((item: SarcasmHighlight) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] space-y-2.5 transition-colors hover:border-amber-500/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] text-zinc-200 font-mono-code text-[10px] uppercase">
                        {item.provider}
                      </span>
                      <span className="font-semibold text-white">{item.author_name}</span>
                      <span className="text-[11px] text-zinc-400 font-mono-code">{item.time_label}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/35 font-mono-code text-[10px] font-bold">
                        🎭 SARKASME ({Math.round(item.sarcasm_score * 100)}%)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono-code text-[10px] font-bold">
                        &rarr; NEGATIF
                      </span>
                    </div>
                  </div>

                  {/* Comment Text */}
                  <p className="text-xs text-zinc-100 leading-relaxed bg-[#08090d]/80 p-3 rounded-lg border border-white/[0.06]">
                    &ldquo;{item.text}&rdquo;
                  </p>

                  {/* Sarcasm Explanation Box */}
                  <div className="flex items-start justify-between gap-3 pt-1 text-[11px]">
                    <div className="text-amber-200/90 flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-amber-300">Analisis Ironi:</strong> {item.sarcasm_reason}
                      </span>
                    </div>

                    {item.source_url && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-white inline-flex items-center gap-1 shrink-0"
                      >
                        <span>Sumber</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Table: Peringkat Akun Terindikasi Bot / Buzzer */}
      <div className="bento-card p-6 bg-[#0e1117] border border-white/[0.08] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3.5">
          <div>
            <span className="text-[10px] font-mono-code uppercase tracking-wider text-zinc-400 block">
              Layer 2 — Anomali Akun &amp; Frekuensi
            </span>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-rose-400" />
              <span>Daftar Akun Terindikasi Bot / Buzzer Kampanye</span>
            </h3>
          </div>
          <span className="text-xs text-zinc-400 font-mono-code">
            Menampilkan {suspectedAccounts.length} akun dengan skor anomali tertinggi
          </span>
        </div>

        {suspectedAccounts.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-400">
            Belum ditemukan akun dengan pola anomali bot pada jendela waktu ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-[10px] font-mono-code uppercase text-zinc-400">
                  <th className="py-2.5 px-3">Akun / Handle</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3">Volume Post</th>
                  <th className="py-2.5 px-3">Skor Bot</th>
                  <th className="py-2.5 px-3">Sinyal Anomali Terdeteksi</th>
                  <th className="py-2.5 px-3">Sampel Narasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {suspectedAccounts.map((acc, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 font-mono-code font-semibold text-white">
                      {acc.author_name}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] font-mono-code text-[10px] uppercase text-zinc-300">
                        {acc.provider}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono-code text-zinc-200">
                      {acc.post_count} dok
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono-code font-bold text-[11px]">
                        {Math.round(acc.avg_bot_score * 100)}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {acc.signals.map((sig, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[10px] text-zinc-300"
                          >
                            {sig}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-zinc-400 max-w-xs truncate">
                      {acc.sample_text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
