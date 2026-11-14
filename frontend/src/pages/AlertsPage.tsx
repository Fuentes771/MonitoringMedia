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
    <div className="space-y-6 font-sans-ui">
      {/* Page Header */}
      <div className="border-b border-white/[0.08] pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shadow-xs">
            <BellRing className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-editorial text-2xl font-medium text-white tracking-tight">
              Sinyal &amp; Peringatan Dini
            </h1>
            <p className="text-xs text-zinc-400 font-sans-ui">
              Pusat pengawasan otomatis berbasis ambang batas lonjakan sentimen negatif dan anomali volume
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-code bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/[0.08]">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>Pengawas Otomatis: <strong className="text-white">AKTIF</strong></span>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-zinc-400 hover:text-white" aria-label="Tutup pesan">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top 3 Bento Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          {rules.map((rule: any) => (
            <div key={rule.id} className="bento-card p-5 bg-[#0e1117] flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-semibold text-white font-sans-ui">
                    {rule.type === 'negative_surge' ? 'Deteksi Lonjakan Sentimen Negatif' : 'Deteksi Lonjakan Volume'}
                  </h3>
                </div>
                <p className="text-xs text-zinc-300">
                  Target: <strong className="text-white">{rule.topic?.name || 'Semua Topik Terdaftar'}</strong>
                </p>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono-code">
                  <span>Ambang: &ge; {rule.threshold_json?.negative_share_percent || 25}%</span>
                  <span>&bull;</span>
                  <span>Jeda: {rule.cooldown_minutes} menit</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono-code bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                AKTIF
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Incident / Alert Events List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white font-mono-code uppercase tracking-wider">
              Riwayat Kejadian Peringatan Terdeteksi
            </h2>
          </div>

          {/* Incident Triage Filtering Tabs */}
          <div className="flex items-center gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={() => setIncidentFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                incidentFilter === 'all'
                  ? 'bg-white text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Semua ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setIncidentFilter('active')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                incidentFilter === 'active'
                  ? 'bg-rose-500 text-white font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-rose-400'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              <span>Perlu Tindakan ({unresolvedEvents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setIncidentFilter('resolved')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                incidentFilter === 'resolved'
                  ? 'bg-zinc-700 text-white font-bold shadow-xs'
                  : 'text-zinc-400 hover:text-white'
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

            return (
              <div
                key={event.id}
                className={`bento-card p-5 sm:p-6 transition-all space-y-4 ${
                  isResolved
                    ? 'bg-[#0e1117]/60 opacity-60 border-white/[0.05]'
                    : 'bg-[#121016] border-rose-500/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center flex-wrap gap-2.5">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono-code ${
                      event.severity === 'critical'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}>
                      {event.severity === 'critical' ? 'KRITIS' : 'PERINGATAN'}
                    </span>

                    <h3 className="text-sm font-bold text-white font-sans-ui">
                      {event.alert?.topic?.name || 'Isu Pemantauan'}
                    </h3>

                    <span className="text-zinc-400 flex items-center gap-1.5 font-mono-code text-xs">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{formatTimestamp(event.triggered_at)}</span>
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono-code ${
                      isResolved
                        ? 'bg-white/[0.05] text-zinc-400 border border-white/[0.08]'
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
                  <div className="flex flex-wrap items-center justify-between text-zinc-300 gap-2 font-mono-code text-[11px]">
                    <span>
                      Proporsi Sentimen Negatif:{' '}
                      <strong className="text-rose-400 font-bold">{ev.negative_share_percent}%</strong> (Ambang Batas: {ev.threshold_percent}%)
                    </span>
                    <span className="text-zinc-400">
                      Ukuran Sampel: {ev.sample_count} sebutan
                    </span>
                  </div>

                  {ev.driving_keywords && ev.driving_keywords.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 font-mono-code">
                      <span className="text-zinc-400 text-xs">Kata kunci pemicu:</span>
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
                    <p className="text-xs text-zinc-400 italic pt-2 border-t border-white/[0.05] mt-1 leading-relaxed font-sans-ui">
                      Bukti percakapan: &ldquo;{ev.sample_text}&rdquo;
                    </p>
                  )}
                </div>

                {/* Event Actions & Mitigation Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                  {/* Left: Intelligence Bridges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {onOpenAiWithQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          const topicName = event.alert?.topic?.name || 'Isu Pemantauan';
                          const kwList = ev.driving_keywords?.join(', ') || 'anomali sentimen';
                          const sampleQ = ev.sample_text ? ` Kutipan bukti: "${ev.sample_text}".` : '';
                          onOpenAiWithQuery(
                            `ANALISIS RESPON KRISIS & MITIGASI: Peringatan ${event.severity?.toUpperCase()} terdeteksi pada program ${topicName} dengan proporsi sentimen negatif ${ev.negative_share_percent}% (ambang batas ${ev.threshold_percent}%). Kata kunci pemicu: [${kwList}].${sampleQ} Mohon susun: 1) Analisis akar masalah pemicu resistensi, 2) Poin klarifikasi / counter-narrative strategis untuk juru bicara, dan 3) Rencana aksi mitigasi 24 jam ke depan.`,
                            event.alert?.topic?.id
                          );
                        }}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500/20 to-amber-500/20 hover:from-rose-500/30 hover:to-amber-500/30 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        title="Dapatkan rekomendasi respon krisis dan mitigasi dari AI"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                        <span>Rekomendasi Respon Krisis AI</span>
                      </button>
                    )}

                    {onNavigateToMentions && (
                      <button
                        type="button"
                        onClick={() => onNavigateToMentions(event.alert?.topic?.id, 'negative')}
                        className="px-3 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        title="Buka seluruh bukti percakapan berpolaritas negatif untuk topik ini"
                      >
                        <span>Lihat Bukti Negatif</span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                    )}
                  </div>

                  {/* Right: Status Workflow Transition */}
                  {!isResolved && (
                    <div className="flex items-center gap-2 shrink-0">
                      {!isAck && (
                        <button
                          type="button"
                          onClick={() => updateStatusMutation.mutate({ id: event.id, status: 'acknowledged' })}
                          disabled={updateStatusMutation.isPending}
                          className="px-3 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 transition-colors font-medium text-xs cursor-pointer"
                        >
                          Tandai Sedang Ditinjau
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => updateStatusMutation.mutate({ id: event.id, status: 'resolved' })}
                        disabled={updateStatusMutation.isPending}
                        className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold transition-colors shadow-xs text-xs cursor-pointer"
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
