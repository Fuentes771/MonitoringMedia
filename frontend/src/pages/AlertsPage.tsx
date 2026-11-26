import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, AlertEventItem } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  Check,
  ShieldCheck,
  Activity,
  Radio,
  X,
  MessageSquareText,
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
    onSuccess: (res: { message?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['alerts-data'] });
      setFeedback(res.message || 'Status peringatan berhasil diperbarui.');
      setTimeout(() => setFeedback(null), 4000);
    },
  });

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return (
        d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }) + ' WIB'
      );
    } catch {
      return iso;
    }
  };

  const rules = data?.rules || [];
  const events: AlertEventItem[] = data?.events || [];
  const unresolvedEvents = events.filter((e) => e.status !== 'resolved');
  const resolvedCount = events.filter((e) => e.status === 'resolved').length;
  const filteredEvents = events.filter((e) => {
    if (incidentFilter === 'active') return e.status !== 'resolved';
    if (incidentFilter === 'resolved') return e.status === 'resolved';
    return true;
  });

  return (
    <div className="space-y-6 font-sans-ui animate-surface-enter">
      {/* Clean Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
        <div className="space-y-1">
          <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[var(--text-primary)] tracking-tight">
            Sinyal &amp; Peringatan Dini
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Pengawasan otomatis berbasis ambang batas lonjakan sentimen negatif dan anomali volume.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 text-xs px-3.5 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] shrink-0 self-start sm:self-auto">
          <Radio className="w-3.5 h-3.5 text-[var(--sentiment-pos)] shrink-0" aria-hidden="true" />
          <span className="text-[var(--text-secondary)]">
            Pengawas Otomatis: <strong className="text-[var(--text-primary)]">Aktif</strong>
          </span>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className="p-3.5 rounded-2xl border border-[var(--sentiment-pos-border)] bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] text-xs font-medium flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="min-w-9 min-h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] shrink-0"
            aria-label="Tutup pesan"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Unified Summary Dock */}
      <div className="surface-card p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-muted)] block">Status Sistem Saat Ini</span>
              <div
                className={`text-base font-bold ${
                  unresolvedEvents.length > 0 ? 'text-[var(--accent-gold-text)]' : 'text-[var(--sentiment-pos)]'
                }`}
              >
                {unresolvedEvents.length > 0 ? 'Memerlukan Atensi' : 'Semua Indikator Normal'}
              </div>
              <span className="text-xs text-[var(--text-secondary)] font-tabular">
                {unresolvedEvents.length} isu terbuka
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4.5 h-4.5" aria-hidden="true" />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 sm:border-l sm:border-[var(--border-subtle)] sm:pl-5">
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-muted)] block">Ambang Batas Kritis</span>
              <div className="text-2xl font-bold text-[var(--text-primary)] font-tabular">
                &ge; 25% <span className="text-xs font-normal text-[var(--text-secondary)]">rasio negatif</span>
              </div>
              <span className="text-xs text-[var(--sentiment-neg)]">Evaluasi otomatis tiap 15 menit</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4.5 h-4.5" aria-hidden="true" />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 sm:border-l sm:border-[var(--border-subtle)] sm:pl-5">
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-muted)] block">Total Insiden Terekam</span>
              <div className="text-2xl font-bold text-[var(--text-primary)] font-tabular">
                {events.length} <span className="text-xs font-normal text-[var(--text-secondary)]">kejadian</span>
              </div>
              <span className="text-xs text-[var(--text-muted)] font-tabular">{resolvedCount} selesai ditangani</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] flex items-center justify-center shrink-0">
              <Activity className="w-4.5 h-4.5" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      {/* Active Rules */}
      {rules.length > 0 && (
        <section aria-label="Aturan peringatan dini aktif" className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Aturan Peringatan Aktif</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule: {
              id: number;
              type: string;
              is_active: boolean;
              cooldown_minutes: number;
              topic?: { name?: string };
              threshold_json?: {
                spike_multiplier?: number;
                min_volume?: number;
                negative_share_percent?: number;
              };
            }) => {
              const isVolumeRule = rule.type === 'volume_spike';
              const thresholdLabel = isVolumeRule
                ? `Ambang: >= ${rule.threshold_json?.spike_multiplier ?? 1.8}x rata-rata (Min. ${rule.threshold_json?.min_volume ?? 5} dok)`
                : `Ambang: >= ${rule.threshold_json?.negative_share_percent ?? 35}% (Min. ${rule.threshold_json?.min_volume ?? 4} opini)`;

              return (
                <div
                  key={rule.id}
                  className="surface-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <ShieldAlert
                        className={`w-4 h-4 shrink-0 ${
                          isVolumeRule ? 'text-[var(--accent-gold-text)]' : 'text-[var(--sentiment-neg)]'
                        }`}
                        aria-hidden="true"
                      />
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {isVolumeRule ? 'Deteksi Lonjakan Volume' : 'Deteksi Lonjakan Sentimen Negatif'}
                      </h3>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Target: <strong className="text-[var(--text-primary)]">{rule.topic?.name || 'Semua Topik Terdaftar'}</strong>
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] font-tabular">
                      {thresholdLabel} (Jeda {rule.cooldown_minutes} menit)
                    </p>
                  </div>

                  <span className="self-start px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border border-[var(--sentiment-pos-border)] shrink-0">
                    {rule.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Incident History */}
      <section aria-label="Riwayat kejadian peringatan" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <h2 className="font-editorial text-xl font-medium text-[var(--text-primary)]">
            Riwayat Kejadian Peringatan
          </h2>

          <div
            role="group"
            aria-label="Filter status insiden"
            className="w-full md:w-auto inline-flex items-center p-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
          >
            <button
              type="button"
              onClick={() => setIncidentFilter('all')}
              aria-pressed={incidentFilter === 'all'}
              className={`min-h-9 flex-1 md:flex-none px-3.5 rounded-full font-semibold transition-colors font-tabular ${
                incidentFilter === 'all'
                  ? 'bg-[var(--action-contrast-bg)] text-[var(--action-contrast-fg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Semua ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setIncidentFilter('active')}
              aria-pressed={incidentFilter === 'active'}
              className={`min-h-9 flex-1 md:flex-none px-3.5 rounded-full font-semibold transition-colors font-tabular ${
                incidentFilter === 'active'
                  ? 'bg-[var(--sentiment-neg-bar)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--sentiment-neg)]'
              }`}
            >
              Aktif ({unresolvedEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setIncidentFilter('resolved')}
              aria-pressed={incidentFilter === 'resolved'}
              className={`min-h-9 flex-1 md:flex-none px-3.5 rounded-full font-semibold transition-colors font-tabular ${
                incidentFilter === 'resolved'
                  ? 'bg-[var(--action-contrast-bg)] text-[var(--action-contrast-fg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Selesai ({resolvedCount})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3" role="status" aria-label="Memuat daftar peringatan">
            {[1, 2].map((i) => (
              <div key={i} className="h-36 surface-card animate-pulse" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="surface-card p-10 text-center space-y-2">
            <ShieldCheck className="w-9 h-9 text-[var(--sentiment-pos)] mx-auto" aria-hidden="true" />
            <h3 className="font-editorial text-lg text-[var(--text-primary)]">
              {incidentFilter === 'active'
                ? 'Semua Peringatan Telah Ditindaklanjuti'
                : 'Tidak Ada Kejadian Terdeteksi'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              {incidentFilter === 'active'
                ? 'Tidak ada anomali atau lonjakan negatif terbuka saat ini.'
                : 'Seluruh indikator sentimen dan volume masih berada dalam batas normal.'}
            </p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const ev = event.evidence_json || {};
            const isResolved = event.status === 'resolved';
            const isAck = event.status === 'acknowledged';
            const isVolumeSpike =
              event.alert?.type === 'volume_spike' || ev.actual_multiplier !== undefined;
            const botFiltered = ev.inauthentic_filtered_count ?? 0;
            const dupFiltered = ev.near_duplicate_filtered_count ?? 0;

            return (
              <article
                key={event.id}
                className={`surface-card p-5 sm:p-6 space-y-4 ${
                  isResolved
                    ? 'opacity-80'
                    : 'border-[var(--sentiment-neg-border)]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center flex-wrap gap-2.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${
                        event.severity === 'critical'
                          ? 'bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border-[var(--sentiment-neg-border)]'
                          : 'bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border-[var(--accent-gold-border)]'
                      }`}
                    >
                      {event.severity === 'critical' ? 'Kritis' : 'Peringatan'}
                    </span>

                    <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                      {event.alert?.topic?.name || 'Isu Pemantauan'}
                    </h3>

                    <span className="text-[var(--text-muted)] inline-flex items-center gap-1.5 font-mono-code font-tabular">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{formatTimestamp(event.triggered_at)}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {ev.auto_resolved && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border border-[var(--sentiment-pos-border)]">
                        Auto-Resolved
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                        isResolved
                          ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                          : isAck
                            ? 'bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border-[var(--accent-gold-border)]'
                            : 'bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border-[var(--sentiment-neg-border)]'
                      }`}
                    >
                      {isResolved ? 'Selesai' : isAck ? 'Sedang Ditinjau' : 'Baru Terdeteksi'}
                    </span>
                  </div>
                </div>

                {/* Evidence Box */}
                <div className="surface-inset p-4 text-xs space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[var(--text-primary)] font-tabular">
                    {isVolumeSpike ? (
                      <span>
                        Lonjakan Volume Organik:{' '}
                        <strong className="text-[var(--accent-gold-text)]">{ev.actual_multiplier}x</strong>{' '}
                        (Volume 24j: {ev.current_24h_volume ?? ev.sample_count} dok vs rata-rata {ev.baseline_daily_avg ?? 0}/hari)
                      </span>
                    ) : (
                      <span>
                        Proporsi Sentimen Negatif (Organik):{' '}
                        <strong className="text-[var(--sentiment-neg)]">{ev.negative_share_percent}%</strong>{' '}
                        (Ambang batas: {ev.threshold_percent}%)
                      </span>
                    )}
                    <span className="text-[var(--text-muted)]">
                      Sampel unik: {ev.organic_sample_count ?? ev.sample_count} sebutan
                    </span>
                  </div>

                  {(botFiltered > 0 || dupFiltered > 0) && (
                    <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2">
                      Pemisahan otomatis: {botFiltered} indikasi bot dan {dupFiltered} teks duplikat disaring dari hitungan lonjakan.
                    </div>
                  )}

                  {ev.auto_resolved && ev.auto_resolved_reason && (
                    <div className="text-[11px] text-[var(--sentiment-pos)] bg-[var(--sentiment-pos-subtle)] border border-[var(--sentiment-pos-border)] rounded-lg px-3 py-2">
                      Pemulihan otomatis: {ev.auto_resolved_reason}
                    </div>
                  )}

                  {ev.driving_keywords && ev.driving_keywords.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[var(--text-muted)]">Pemicu:</span>
                      {ev.driving_keywords.map((kw: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] text-[11px] font-semibold"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}

                  {ev.sample_text && (
                    <p className="text-xs text-[var(--text-secondary)] italic pt-2 border-t border-[var(--border-subtle)] leading-relaxed break-words">
                      Bukti percakapan: &ldquo;{ev.sample_text}&rdquo;
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
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
                              : `ANALISIS RESPON KRISIS & MITIGASI: Peringatan ${event.severity?.toUpperCase()} terdeteksi pada program ${topicName} dengan proporsi sentimen negatif ${ev.negative_share_percent}% (ambang batas ${ev.threshold_percent}%). Kata kunci pemicu: [${kwList}].${sampleQ} Mohon susun: 1) Analisis akar masalah pemicu resistensi, 2) Poin klarifikasi strategis untuk juru bicara, dan 3) Rencana aksi mitigasi 24 jam ke depan.`,
                            event.alert?.topic?.id
                          );
                        }}
                        className="min-h-10 px-3.5 rounded-xl bg-[var(--accent-gold-subtle)] hover:opacity-90 border border-[var(--accent-gold-border)] text-[var(--accent-gold-text)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-opacity"
                      >
                        <MessageSquareText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Rekomendasi Respon AI</span>
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
                        className="btn-ghost-surface min-h-10 px-3.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                      >
                        <span>{isVolumeSpike ? 'Investigasi Sebutan' : 'Lihat Bukti Negatif'}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {!isResolved && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      {!isAck && (
                        <button
                          type="button"
                          onClick={() =>
                            updateStatusMutation.mutate({ id: event.id, status: 'acknowledged' })
                          }
                          disabled={updateStatusMutation.isPending}
                          className="btn-ghost-surface min-h-10 px-3.5 text-xs font-semibold"
                        >
                          Tandai Ditinjau
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          updateStatusMutation.mutate({ id: event.id, status: 'resolved' })
                        }
                        disabled={updateStatusMutation.isPending}
                        className="btn-contrast min-h-10 px-4 text-xs"
                      >
                        Tandai Selesai
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
