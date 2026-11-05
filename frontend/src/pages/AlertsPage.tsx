import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, AlertEventItem } from '@/lib/api';
import { AlertTriangle, CheckCircle, ShieldAlert, Clock } from 'lucide-react';

export function AlertsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['alerts-data'],
    queryFn: async () => {
      const res = await api.get('/alerts', { params: { workspace_id: 1 } });
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
      setFeedback(res.message || 'Status alert berhasil diperbarui.');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight mb-1">
          Peringatan Dini & Manajemen Isu (Alerts & Incidents)
        </h1>
        <p className="text-xs text-slate-400">
          Notifikasi otomatis berbasis ambang batas lonjakan volume percakapan dan kenaikan drastis sentimen negatif
        </p>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{feedback}</span>
          </div>
        </div>
      )}

      {/* Rules Overview Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule: any) => (
          <div key={rule.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Aturan: {rule.type === 'negative_surge' ? 'Lonjakan Sentimen Negatif' : 'Lonjakan Volume'}
                </h2>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Topik: {rule.topic?.name || 'Semua Topik'}
              </p>
              <p className="text-[11px] text-slate-400">
                Ambang Batas: Proporsi negatif &ge; {rule.threshold_json?.negative_share_percent || 30}% (Cooldown: {rule.cooldown_minutes} menit)
              </p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              AKTIF
            </span>
          </div>
        ))}
      </div>

      {/* Incident / Alert Events List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Kejadian Peringatan Terdeteksi</span>
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center border border-slate-800 rounded-xl bg-slate-900/40">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm text-slate-300 font-semibold mb-1">Semua indikator normal.</p>
            <p className="text-xs text-slate-500">Tidak ada lonjakan anomali yang melewati ambang batas peringatan.</p>
          </div>
        ) : (
          events.map((event) => {
            const ev = event.evidence_json || {};
            const isResolved = event.status === 'resolved';
            const isAck = event.status === 'acknowledged';

            return (
              <div
                key={event.id}
                className={`p-5 rounded-xl border transition-all space-y-3 ${
                  isResolved
                    ? 'border-slate-800/60 bg-slate-950/40 opacity-70'
                    : 'border-rose-900/40 bg-slate-900/70'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                      event.severity === 'critical'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {event.severity}
                    </span>

                    <h3 className="text-xs font-bold text-white">
                      {event.alert?.topic?.name || 'Monitoring Issue'}
                    </h3>

                    <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(event.triggered_at)}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                      isResolved
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : isAck
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                    }`}>
                      {event.status}
                    </span>
                  </div>
                </div>

                {/* Evidence Details */}
                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>
                      Proporsi Sentimen Negatif:{' '}
                      <strong className="text-rose-400 font-bold">{ev.negative_share_percent}%</strong> (Ambang Batas: {ev.threshold_percent}%)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Ukuran Sampel: {ev.sample_count} mention
                    </span>
                  </div>

                  {ev.driving_keywords && ev.driving_keywords.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 text-[11px]">
                      <span className="text-slate-400">Kata kunci pemicu:</span>
                      <div className="flex flex-wrap gap-1">
                        {ev.driving_keywords.map((kw, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {ev.sample_text && (
                    <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-900 mt-2">
                      Contoh bukti: "{ev.sample_text}"
                    </p>
                  )}
                </div>

                {/* Event Actions */}
                {!isResolved && (
                  <div className="flex items-center justify-end gap-2 pt-1 text-xs">
                    {!isAck && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: event.id, status: 'acknowledged' })}
                        disabled={updateStatusMutation.isPending}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium transition-colors"
                      >
                        Tandai Acknowledged
                      </button>
                    )}
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: event.id, status: 'resolved' })}
                      disabled={updateStatusMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                    >
                      Tandai Terselesaikan (Resolved)
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
