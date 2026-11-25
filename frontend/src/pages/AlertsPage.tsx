import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, AlertEventItem } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  BellRing,
  Check,
  ShieldCheck,
  Activity,
  Radio,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface AlertsPageProps {
  onNavigateToMentions?: (topicId?: number, sentiment?: string) => void;
  onOpenAiWithQuery?: (query: string, topicId?: number) => void;
}

export function AlertsPage({ onNavigateToMentions, onOpenAiWithQuery }: AlertsPageProps = {}) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id;
  const [feedback, setFeedback] = useState<string | null>(null);
  const [incidentFilter, setIncidentFilter] = useState<'all' | 'active' | 'resolved'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['alerts-data', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get('/alerts', { params: { workspace_id: workspaceId } });
      return res.data.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await api.patch(`/alerts/events/${id}`, { status });
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['alerts-data'] });
      setFeedback(res.message || 'Status peringatan berhasil diperbarui.');
      setTimeout(() => setFeedback(null), 4000);
    },
  });

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB';
    } catch {
      return iso;
    }
  };

  const rules = data?.rules || [];
  const events: AlertEventItem[] = data?.events || [];
  const unresolvedEvents = events.filter((e) => e.status !== 'resolved');
  const filteredEvents = events.filter((e) => {
    if (incidentFilter === 'active') return e.status !== 'resolved';
    if (incidentFilter === 'resolved') return e.status === 'resolved';
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-6 font-sans-ui">
      {/* Page Header */}
      <div className="border-b border-white/[0.08] pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <BellRing className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="font-editorial text-xl sm:text-2xl font-medium text-white tracking-tight text-balance">
              Sinyal &amp; Peringatan Dini
            </h1>
            <p className="text-xs text-zinc-400 font-sans-ui mt-0.5 text-pretty">
              Pusat pengawasan otomatis berbasis ambang batas lonjakan sentimen negatif dan anomali volume
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-code bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.08] shrink-0">
          <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>Pengawas Otomatis: <strong className="text-white">AKTIF</strong></span>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="min-w-9 min-h-9 flex items-center justify-center text-zinc-300 hover:text-white shrink-0" aria-label="Tutup pesan">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Top 3 Bento Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bento-card p-4 sm:p-5 bg-[#0e1117] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 font-mono-code block mb-1">
              Status Sistem Saat Ini
            </span>
            <div className={`text-base font-bold ${
              unresolvedEvents.length > 0 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {unresolvedEvents.length > 0 ? 'Peringatan Memerlukan Atensi' : 'Semua Indikator Normal'}
            </div>
            <span className="text-[11px] text-zinc-400 font-mono-code">
              {unresolvedEvents.length} Isu Terbuka
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bento-card p-4 sm:p-5 bg-[#0e1117] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 font-mono-code block mb-1">
              Ambang Batas Kritis Negatif
            </span>
            <div className="text-2xl font-extrabold text-white font-mono-code">
              &ge; 25% <span className="text-xs font-normal text-zinc-400 font-sans-ui">Rasio</span>
            </div>
            <span className="text-[11px] text-rose-400 font-mono-code">Evaluasi Otomatis per 15 Menit</span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="bento-card p-4 sm:p-5 bg-[#0e1117] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 font-mono-code block mb-1">
              Total Insiden Terekam
            </span>
            <div className="text-2xl font-extrabold text-white font-mono-code">
              {events.length} <span className="text-xs font-normal text-zinc-400 font-sans-ui">Kejadian</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Rules Overview Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono-code">
          Aturan Peringatan Dini Aktif
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule: any) => {
            const isVolumeRule = rule.type === 'volume_spike';
            const thresholdLabel = isVolumeRule
              ? `Ambang: >= ${rule.threshold_json?.spike_multiplier ?? 1.8}x rata-rata (Min. ${rule.threshold_json?.min_volume ?? 5} dok)`
              : `Ambang: >= ${rule.threshold_json?.negative_share_percent ?? 35}% (Min. ${rule.threshold_json?.min_volume ?? 4} opini)`;

            return (
              <div key={rule.id} className="bento-card p-4 sm:p-5 bg-[#0e1117] flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className={`w-4 h-4 shrink-0 ${isVolumeRule ? 'text-amber-400' : 'text-rose-400'}`} aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-white font-sans-ui">
                      {isVolumeRule ? 'Deteksi Lonjakan Volume' : 'Deteksi Lonjakan Sentimen Negatif'}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-300">
                    Target: <strong className="text-white">{rule.topic?.name || 'Semua Topik Terdaftar'}</strong>
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-300 font-mono-code">
                    <span>{thresholdLabel}</span>
                    <span aria-hidden="true">&bull;</span>
                    <span>Jeda: {rule.cooldown_minutes} menit</span>
                  </div>
                </div>
                <span className="self-start px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono-code bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                  {rule.is_active ? 'OTOMATIS AKTIF' : 'NONAKTIF'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incident / Alert Events List */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h2 className="text-xs sm:text-sm font-bold text-white font-mono-code uppercase tracking-wider">
              Riwayat Kejadian Peringatan Terdeteksi
            </h2>
          </div>

          {/* Incident Triage Filtering Tabs */}
          <div className="w-full md:w-auto grid grid-cols-3 sm:flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.08] text-[11px] sm:text-xs">
            <button
              type="button"
              onClick={() => setIncidentFilter('all')}
              aria-pressed={incidentFilter === 'all'}
              className={`min-h-10 sm:min-h-8 px-2.5 sm:px-3 py-1 rounded-lg font-medium transition-all cursor-pointer text-center ${
                incidentFilter === 'all'
                  ? 'bg-white text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Semua ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setIncidentFilter('active')}
              aria-pressed={incidentFilter === 'active'}
              className={`min-h-10 sm:min-h-8 px-2 sm:px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                incidentFilter === 'active'
                  ? 'bg-rose-500 text-white font-bold shadow-xs'
                  : 'text-zinc-300 hover:text-rose-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${incidentFilter === 'active' ? 'bg-white' : 'bg-rose-400'}`} />
              <span className="truncate">Aktif ({unresolvedEvents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setIncidentFilter('resolved')}
              aria-pressed={incidentFilter === 'resolved'}
              className={`min-h-10 sm:min-h-8 px-2.5 sm:px-3 py-1 rounded-lg font-medium transition-all cursor-pointer text-center ${
                incidentFilter === 'resolved'
                  ? 'bg-zinc-700 text-white font-bold shadow-xs'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Selesai ({events.filter((e) => e.status === 'resolved').length})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bento-card p-12 text-center bg-[#0e1117]">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white mb-1 font-sans-ui">
              {incidentFilter === 'active'
                ? 'Semua Peringatan Telah Ditindaklanjuti'
                : 'Tidak Ada Kejadian Terdeteksi'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto font-sans-ui">
              {incidentFilter === 'active'
                ? 'Tidak ada anomali atau lonjakan negatif yang membutuhkan penanganan saat ini.'
                : 'Semua metrik dan indikator sentimen berada dalam batas wajar.'}
            </p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const ev = event.evidence_json || {};
            const isResolved = event.status === 'resolved';
            const isAck = event.status === 'acknowledged';
            const isVolumeSpike = event.alert?.type === 'volume_spike' || ev.actual_multiplier !== undefined;
            const botFiltered = ev.inauthentic_filtered_count ?? 0;
            const dupFiltered = ev.near_duplicate_filtered_count ?? 0;

            return (
              <div
                key={event.id}
                className={`bento-card p-5 sm:p-6 transition-all space-y-4 ${
                  isResolved
                    ? 'bg-[#0e1117]/75 opacity-80 border-white/[0.06]'
                    : 'bg-[#121016] border-rose-500/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center flex-wrap gap-2.5">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono-code ${
                      event.severity === 'critical'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {event.severity === 'critical' ? 'KRITIS' : 'PERINGATAN'}
                    </span>

                    <h3 className="text-sm font-bold text-white font-sans-ui">
                      {event.alert?.topic?.name || 'Isu Pemantauan'}
                    </h3>

                    <span className="text-zinc-300 flex items-center gap-1.5 font-mono-code text-xs">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                      <span>{formatTimestamp(event.triggered_at)}</span>
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {ev.auto_resolved && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono-code bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Auto-Resolved
                      </span>
                    )}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono-code ${
                      isResolved
                        ? 'bg-white/[0.05] text-zinc-300 border border-white/[0.08]'
                        : isAck
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                    }`}>
                      {isResolved ? 'Selesai' : isAck ? 'Sedang Ditinjau' : 'Baru Terdeteksi'}
                    </span>
                  </div>
                </div>

                {/* Evidence Details */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between text-zinc-200 gap-2 font-mono-code text-[11px]">
                    {isVolumeSpike ? (
                      <span>
                        Lonjakan Volume Organik:{' '}
                        <strong className="text-amber-300 font-bold">{ev.actual_multiplier}x</strong> (Volume 24j:{' '}
                        {ev.current_24h_volume ?? ev.sample_count} dok vs rata-rata {ev.baseline_daily_avg ?? 0}/hari)
                      </span>
                    ) : (
                      <span>
                        Proporsi Sentimen Negatif (Organik):{' '}
                        <strong className="text-rose-300 font-bold">{ev.negative_share_percent}%</strong> (Ambang Batas:{' '}
                        {ev.threshold_percent}%)
                      </span>
                    )}
                    <span className="text-zinc-300">
                      Sampel Organik Unik: {ev.organic_sample_count ?? ev.sample_count} sebutan
                    </span>
                  </div>

                  {(botFiltered > 0 || dupFiltered > 0) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-code text-sky-300 bg-sky-500/10 border border-sky-500/25 rounded-lg px-3 py-1.5">
                      <span>Pemisahan Otomatis:</span>
                      <span>
                        {botFiltered} indikasi bot &amp; {dupFiltered} teks near-duplicate disaring dari perhitungan lonjakan.
                      </span>
                    </div>
                  )}

                  {ev.auto_resolved && ev.auto_resolved_reason && (
                    <div className="text-[11px] font-mono-code text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-1.5">
                      Pemulihan Otomatis: {ev.auto_resolved_reason}
                    </div>
                  )}

                  {ev.driving_keywords && ev.driving_keywords.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 font-mono-code">
                      <span className="text-zinc-300 text-xs">Kata kunci pemicu:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {ev.driving_keywords.map((kw: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-semibold">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {ev.sample_text && (
                    <p className="text-xs text-zinc-300 italic pt-2 border-t border-white/[0.05] mt-1 leading-relaxed font-sans-ui break-words">
                      Bukti percakapan: &ldquo;{ev.sample_text}&rdquo;
                    </p>
                  )}
                </div>

                {/* Event Actions & Mitigation Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-2 border-t border-white/[0.06]">
                  {/* Left: Intelligence Bridges */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
                    {onOpenAiWithQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          const topicName = event.alert?.topic?.name || 'Isu Pemantauan';
                          const kwList = ev.driving_keywords?.join(', ') || 'anomali sentimen';
                          const sampleQ = ev.sample_text ? ` Kutipan bukti: "${ev.sample_text}".` : '';
                          onOpenAiWithQuery(
                            isVolumeSpike
                              ? `ANALISIS LONJAKAN VOLUME & NARASI: Peringatan ${event.severity?.toUpperCase()} terdeteksi pada program ${topicName} dengan akselerasi ${ev.actual_multiplier}x (${ev.current_24h_volume ?? ev.sample_count} sebutan organik dalam 24 jam). Kata kunci pemicu: [${kwList}].${sampleQ} Mohon susun ringkasan pemicu viralitas dan langkah komunikasi respons cepat.`
                              : `ANALISIS RESPON KRISIS & MITIGASI: Peringatan ${event.severity?.toUpperCase()} terdeteksi pada program ${topicName} dengan proporsi sentimen negatif ${ev.negative_share_percent}% (ambang batas ${ev.threshold_percent}%). Kata kunci pemicu: [${kwList}].${sampleQ} Mohon susun: 1) Analisis akar masalah pemicu resistensi, 2) Poin klarifikasi / counter-narrative strategis untuk juru bicara, dan 3) Rencana aksi mitigasi 24 jam ke depan.`,
                            event.alert?.topic?.id
                          );
                        }}
                        className="min-h-11 sm:min-h-9 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-500/20 to-amber-500/20 hover:from-rose-500/30 hover:to-amber-500/30 border border-rose-500/40 text-rose-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                        title="Dapatkan rekomendasi respon krisis dan mitigasi dari AI"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />
                        <span>Rekomendasi Respon Krisis AI</span>
                      </button>
                    )}

                    {onNavigateToMentions && (
                      <button
                        type="button"
                        onClick={() =>
                          onNavigateToMentions(
                            event.alert?.topic?.id,
                            isVolumeSpike ? undefined : 'negative'
                          )
                        }
                        className="min-h-11 sm:min-h-9 px-3 py-2 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                        title={
                          isVolumeSpike
                            ? 'Buka seluruh bukti percakapan pada lonjakan volume topik ini'
                            : 'Buka seluruh bukti percakapan berpolaritas negatif untuk topik ini'
                        }
                      >
                        <span>{isVolumeSpike ? 'Investigasi Sebutan' : 'Lihat Bukti Negatif'}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Right: Status Workflow Transition */}
                  {!isResolved && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      {!isAck && (
                        <button
                          type="button"
                          onClick={() => updateStatusMutation.mutate({ id: event.id, status: 'acknowledged' })}
                          disabled={updateStatusMutation.isPending}
                          className="min-h-11 sm:min-h-9 px-3 py-2 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 transition-colors font-medium text-xs cursor-pointer"
                        >
                          Tandai Sedang Ditinjau
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => updateStatusMutation.mutate({ id: event.id, status: 'resolved' })}
                        disabled={updateStatusMutation.isPending}
                        className="min-h-11 sm:min-h-9 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold transition-colors shadow-xs text-xs cursor-pointer"
                      >
                        Tandai Selesai &amp; Arsipkan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
