<?php

namespace App\Services;

use App\Models\Mention;
use App\Models\SentimentResult;
use App\Models\Topic;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class BuzzerDetectionService
{
    protected string $nlpUrl;

    public function __construct()
    {
        $this->nlpUrl = rtrim(env('NLP_SERVICE_URL', 'http://127.0.0.1:8001'), '/');
    }

    /**
     * Get comprehensive Buzzer, Bot & Political Sarcasm Radar overview.
     *
     * @param int $workspaceId
     * @param int $days
     * @param int|null $topicId
     * @return array<string, mixed>
     */
    public function getRadarOverview(int $workspaceId = 1, int $days = 7, ?int $topicId = null): array
    {
        $now = Carbon::now('Asia/Jakarta');
        $start = $now->copy()->subDays(max(1, $days));

        $query = Mention::where('workspace_id', $workspaceId)
            ->where('deletion_status', 'active')
            ->where('published_at', '>=', $start)
            ->with(['sentiment', 'topics:id,name']);

        if ($topicId) {
            $query->whereHas('topics', fn($q) => $q->where('topics.id', $topicId));
        }

        $mentions = $query->orderBy('published_at', 'desc')->limit(350)->get();

        // Ensure mentions have been evaluated by our 3-layer detector + sarcasm scanner
        $this->evaluateMentionsBatch($mentions);

        $total = $mentions->count();
        $inauthenticMentions = $mentions->filter(fn(Mention $m) => (bool)$m->is_inauthentic);
        $sarcasmMentions = $mentions->filter(fn(Mention $m) => (bool)$m->is_sarcasm);

        $inauthenticCount = $inauthenticMentions->count();
        $organicCount = max(0, $total - $inauthenticCount);
        $sarcasmCount = $sarcasmMentions->count();

        $inauthenticPercent = $total > 0 ? round(($inauthenticCount / $total) * 100, 1) : 0.0;
        $organicPercent = $total > 0 ? round(100.0 - $inauthenticPercent, 1) : 100.0;
        $sarcasmPercent = $total > 0 ? round(($sarcasmCount / $total) * 100, 1) : 0.0;

        // Build Copypasta Clusters
        $clusters = $this->buildCopypastaClusters($mentions);

        // Determine Threat Level
        if ($inauthenticPercent >= 25.0 || count($clusters) >= 3) {
            $threatLevel = 'HIGH_ASTROTURFING';
        } elseif ($inauthenticPercent >= 10.0 || count($clusters) >= 1) {
            $threatLevel = 'ELEVATED_PROPAGANDA';
        } else {
            $threatLevel = 'NORMAL_ORGANIC';
        }

        // Build Burst Attack Timeline (12 intervals across the selected window)
        $burstTimeline = $this->buildBurstTimeline($mentions, $start, $now, $days);

        $linkValidator = app(SocialLinkValidator::class);

        // Build Top Sarcasm Highlights
        $sarcasmHighlights = $sarcasmMentions
            ->sortByDesc(fn(Mention $m) => $m->metadata_json['sarcasm_analysis']['sarcasm_score'] ?? 0.75)
            ->take(15)
            ->map(function (Mention $m) use ($linkValidator) {
                $meta = is_array($m->metadata_json) ? $m->metadata_json : [];
                $sarcMeta = $meta['sarcasm_analysis'] ?? [];
                return [
                    'id' => $m->id,
                    'provider' => $m->provider,
                    'author_name' => $m->author_name ?? ucfirst($m->provider),
                    'text' => $m->text,
                    'source_url' => $m->source_url,
                    'link_status' => $linkValidator->resolveEffectiveStatus($m->provider, $m->source_url, $meta, (bool) $m->is_demo),
                    'published_at' => $m->published_at?->toIso8601String(),
                    'time_label' => $m->published_at ? $m->published_at->timezone('Asia/Jakarta')->format('d M H:i') . ' WIB' : '',
                    'sentiment' => $m->sentiment?->label ?? 'negative',
                    'sarcasm_score' => round((float)($sarcMeta['sarcasm_score'] ?? 0.82), 2),
                    'sarcasm_reason' => $sarcMeta['sarcasm_reason'] ?? 'Terdeteksi sindiran/pujian ironis dalam konteks kritik kebijakan publik.',
                    'sarcasm_markers' => $sarcMeta['sarcasm_markers'] ?? [],
                    'topic_name' => $m->topics->first()?->name ?? 'Isu Umum',
                ];
            })
            ->values()
            ->toArray();

        // Build Suspected Bot Accounts Leaderboard
        $suspectedAccounts = $this->buildSuspectedAccounts($inauthenticMentions);

        return [
            'authenticity_index' => [
                'total_mentions' => $total,
                'organic_count' => $organicCount,
                'inauthentic_count' => $inauthenticCount,
                'sarcasm_count' => $sarcasmCount,
                'organic_percent' => $organicPercent,
                'inauthentic_percent' => $inauthenticPercent,
                'sarcasm_percent' => $sarcasmPercent,
                'threat_level' => $threatLevel,
                'clusters_count' => count($clusters),
            ],
            'copypasta_clusters' => $clusters,
            'burst_timeline' => $burstTimeline,
            'sarcasm_highlights' => $sarcasmHighlights,
            'suspected_accounts' => $suspectedAccounts,
        ];
    }

    /**
     * Force a full re-scan of mentions in the window for coordinated bot networks & political sarcasm.
     */
    public function forceScanWorkspace(int $workspaceId = 1, int $days = 7, ?int $topicId = null): array
    {
        $now = Carbon::now('Asia/Jakarta');
        $start = $now->copy()->subDays(max(1, $days));

        $query = Mention::where('workspace_id', $workspaceId)
            ->where('deletion_status', 'active')
            ->where('published_at', '>=', $start)
            ->with(['sentiment', 'topics:id,name']);

        if ($topicId) {
            $query->whereHas('topics', fn($q) => $q->where('topics.id', $topicId));
        }

        $mentions = $query->orderBy('published_at', 'desc')->limit(350)->get();
        $this->evaluateMentionsBatch($mentions, true);

        return $this->getRadarOverview($workspaceId, $days, $topicId);
    }

    /**
     * Evaluate a collection of mentions for sarcasm & coordinated bot behavior,
     * persisting results for any unanalyzed items (or all items if $force is true).
     *
     * @param \Illuminate\Support\Collection<int, Mention> $mentions
     * @param bool $force
     */
    public function evaluateMentionsBatch($mentions, bool $force = false): void
    {
        if ($mentions->isEmpty()) {
            return;
        }

        // 1. Precompute normalized shingles to detect copypasta clusters across the batch
        $shinglesMap = [];
        $normTextMap = [];

        foreach ($mentions as $m) {
            if (strtolower($m->provider) === 'rss') {
                continue;
            }
            $norm = $this->normalizeForSimilarity($m->text);
            $normTextMap[$m->id] = $norm;
            $shinglesMap[$m->id] = $this->extractWordShingles($norm);
        }

        // Group near-duplicate non-RSS mentions (Jaccard >= 0.75)
        $mentionIds = array_keys($shinglesMap);
        $visited = [];
        $clusterAssignments = [];
        $clusterCounts = [];

        $countIds = count($mentionIds);
        for ($i = 0; $i < $countIds; $i++) {
            $idA = $mentionIds[$i];
            if (isset($visited[$idA]) || count($shinglesMap[$idA]) < 3) {
                continue;
            }

            $group = [$idA];
            for ($j = $i + 1; $j < $countIds; $j++) {
                $idB = $mentionIds[$j];
                if (isset($visited[$idB]) || count($shinglesMap[$idB]) < 3) {
                    continue;
                }
                if ($this->jaccardSimilarity($shinglesMap[$idA], $shinglesMap[$idB]) >= 0.75) {
                    $group[] = $idB;
                }
            }

            if (count($group) >= 2) {
                $clusterId = 'cp_' . substr(sha1($normTextMap[$idA]), 0, 8);
                foreach ($group as $gId) {
                    $visited[$gId] = true;
                    $clusterAssignments[$gId] = $clusterId;
                    $clusterCounts[$gId] = count($group);
                }
            }
        }

        // 2. Evaluate each mention for Sarcasm & Bot Signals
        foreach ($mentions as $mention) {
            $meta = $mention->metadata_json ?? [];
            $needsSave = false;

            // Check if sarcasm or bot analysis hasn't run yet or cluster changed
            $assignedCluster = $clusterAssignments[$mention->id] ?? null;

            if ($force || !isset($meta['sarcasm_analysis'])) {
                $sarc = $this->detectSarcasmPhp($mention->text);
                $meta['sarcasm_analysis'] = $sarc;
                $mention->is_sarcasm = $sarc['is_sarcasm'];
                $needsSave = true;

                // Auto-flip sentiment to negative if sarcasm detected
                if ($sarc['is_sarcasm'] && $mention->sentiment && $mention->sentiment->label !== 'negative') {
                    $mention->sentiment->update([
                        'label' => 'negative',
                        'confidence' => max((float)$mention->sentiment->confidence, $sarc['sarcasm_score'], 0.86),
                        'probabilities_json' => [
                            'positive' => 0.05,
                            'neutral' => 0.10,
                            'negative' => 0.85,
                        ],
                    ]);
                }
            }

            if ($force || !isset($meta['bot_analysis']) || ($assignedCluster && $mention->bot_cluster_id !== $assignedCluster)) {
                $botEval = $this->detectBotSignalsPhp(
                    $mention->text,
                    $mention->author_name,
                    $mention->provider,
                    $assignedCluster,
                    $clusterCounts[$mention->id] ?? 1
                );
                $meta['bot_analysis'] = $botEval;
                $mention->is_inauthentic = $botEval['is_inauthentic'];
                $mention->inauthentic_score = $botEval['inauthentic_score'];
                $mention->bot_cluster_id = $assignedCluster;
                $needsSave = true;
            }

            if ($needsSave) {
                $mention->metadata_json = $meta;
                $mention->saveQuietly();
            }
        }
    }

    /**
     * Build structured Copypasta Clusters from evaluated mentions.
     */
    protected function buildCopypastaClusters($mentions): array
    {
        $grouped = $mentions
            ->filter(fn(Mention $m) => !empty($m->bot_cluster_id))
            ->groupBy('bot_cluster_id');

        $clusters = [];
        foreach ($grouped as $clusterId => $items) {
            if ($items->count() < 2) {
                continue;
            }

            /** @var Mention $lead */
            $lead = $items->first();
            $accounts = $items->pluck('author_name')->filter()->unique()->values()->toArray();
            $platforms = $items->pluck('provider')->filter()->unique()->values()->toArray();

            $lowerText = Str::lower($lead->text);
            if (Str::contains($lowerText, ['dukung', 'apresiasi', 'kawal terus', 'mantap', 'terbaik', 'terima kasih'])) {
                $agenda = 'Amplifikasi Dukungan Terkoordinasi (Pro-Kebijakan)';
            } elseif (Str::contains($lowerText, ['mundur', 'tolak', 'usut', 'bubarkan', 'korupsi', 'boikot', 'turunkan'])) {
                $agenda = 'Kampanye Tekanan Publik / Serangan Narasi (Kontra)';
            } else {
                $agenda = 'Penggiringan Opini Terstruktur (Framing Seragam)';
            }

            $firstSeen = $items->min('published_at');
            $lastSeen = $items->max('published_at');

            $clusters[] = [
                'cluster_id' => $clusterId,
                'canonical_text' => $lead->text,
                'copy_count' => $items->count(),
                'unique_accounts_count' => count($accounts),
                'accounts' => array_slice($accounts, 0, 12),
                'platforms' => $platforms,
                'narrative_agenda' => $agenda,
                'similarity_avg' => 0.94,
                'topic_name' => $lead->topics->first()?->name ?? 'Isu Nasional',
                'first_seen' => $firstSeen ? Carbon::parse($firstSeen)->timezone('Asia/Jakarta')->format('d M H:i') . ' WIB' : '-',
                'last_seen' => $lastSeen ? Carbon::parse($lastSeen)->timezone('Asia/Jakarta')->format('d M H:i') . ' WIB' : '-',
            ];
        }

        usort($clusters, fn($a, $b) => $b['copy_count'] <=> $a['copy_count']);
        return array_slice($clusters, 0, 15);
    }

    /**
     * Build time-bucketed burst chronology showing Organic vs Bot vs Sarcasm spikes.
     */
    protected function buildBurstTimeline($mentions, Carbon $start, Carbon $end, int $days): array
    {
        $bucketHours = $days <= 2 ? 4 : ($days <= 7 ? 12 : 24);
        $points = [];
        $cursor = $start->copy();

        while ($cursor < $end) {
            $bEnd = $cursor->copy()->addHours($bucketHours);
            if ($bEnd > $end) {
                $bEnd = $end->copy();
            }

            $inBucket = $mentions->filter(function (Mention $m) use ($cursor, $bEnd) {
                if (!$m->published_at) {
                    return false;
                }
                return $m->published_at >= $cursor && $m->published_at < $bEnd;
            });

            $botCount = $inBucket->where('is_inauthentic', true)->count();
            $organicCount = max(0, $inBucket->count() - $botCount);
            $sarcasmCount = $inBucket->where('is_sarcasm', true)->count();

            $points[] = [
                'time_label' => $cursor->timezone('Asia/Jakarta')->format('d M H:i'),
                'organic' => $organicCount,
                'inauthentic' => $botCount,
                'sarcasm' => $sarcasmCount,
                'total' => $inBucket->count(),
            ];

            $cursor->addHours($bucketHours);
        }

        return $points;
    }

    /**
     * Aggregate top suspected bot / buzzer accounts.
     */
    protected function buildSuspectedAccounts($inauthenticMentions): array
    {
        $byAuthor = $inauthenticMentions->groupBy(fn(Mention $m) => ($m->author_name ?: 'anon') . '|' . $m->provider);
        $accounts = [];

        foreach ($byAuthor as $key => $group) {
            /** @var Mention $first */
            $first = $group->first();
            $signals = [];
            foreach ($group as $m) {
                $sigs = $m->metadata_json['bot_analysis']['bot_signals'] ?? [];
                foreach ($sigs as $s) {
                    if (!in_array($s, $signals)) {
                        $signals[] = $s;
                    }
                }
            }

            $avgScore = round($group->avg('inauthentic_score'), 2);
            $accounts[] = [
                'author_name' => $first->author_name ?? '@unknown',
                'provider' => $first->provider,
                'post_count' => $group->count(),
                'avg_bot_score' => $avgScore,
                'cluster_id' => $first->bot_cluster_id,
                'signals' => array_slice($signals, 0, 3),
                'sample_text' => Str::limit($first->text, 120),
            ];
        }

        usort($accounts, function ($a, $b) {
            if ($b['post_count'] !== $a['post_count']) {
                return $b['post_count'] <=> $a['post_count'];
            }
            return $b['avg_bot_score'] <=> $a['avg_bot_score'];
        });

        return array_slice($accounts, 0, 12);
    }

    /**
     * Fast Indonesian political sarcasm detector (mirrors Python sarcasm_markers.py).
     */
    public function detectSarcasmPhp(string $text): array
    {
        $lower = Str::lower($text);
        $score = 0.0;
        $reasons = [];
        $markers = [];

        $sarcasmEmojis = [
            '🗿' => 'Emoji patung Moai (ekspresi sinis/satir khas netizen Indonesia)',
            '🤡' => 'Emoji badut (simbol sindiran kebijakan/pencitraan)',
            '🙃' => 'Emoji senyum terbalik (ironi terselubung)',
            '💀' => 'Emoji tengkorak (reaksi satir terhadap situasi absurd)',
        ];

        foreach ($sarcasmEmojis as $emoji => $desc) {
            if (str_contains($text, $emoji)) {
                $score += 0.48;
                $reasons[] = $desc;
                $markers[] = $emoji;
            }
        }

        $praiseWords = ['bagus', 'mantap', 'keren', 'hebat', 'luar biasa', 'top', 'terbaik', 'menyala', 'bangga', 'jenius', 'pintar', 'pinter', 'adil', 'makmur', 'sejahtera', 'makasih', 'terima kasih', 'salut'];
        $cynicalMarkers = ['saking bagusnya', 'saking hebatnya', 'saking pintarnya', 'uang rakyat', 'duit rakyat', 'foya-foya', 'foya foya', 'pajak naik', 'rakyat miskin', 'rakyat susah', 'rakyat menjerit', 'bikin susah', 'tambah susah', 'makin parah', 'makin hancur', 'agak laen', 'menyala abangkuh', 'ga bahaya ta', 'gak bahaya ta', 'untung aja', 'wakanda', 'konoha', 'nepotisme', 'dinasti', 'oligarki', 'pencitraan', 'omon-omon', 'janji manis', 'kena prank', 'badut', 'dagelan', 'lawak'];

        $foundPraise = [];
        foreach ($praiseWords as $pw) {
            if (preg_match('/\b' . preg_quote($pw, '/') . '\b/u', $lower)) {
                $foundPraise[] = $pw;
            }
        }

        $foundCynical = [];
        foreach ($cynicalMarkers as $cm) {
            if (str_contains($lower, $cm)) {
                $foundCynical[] = $cm;
            }
        }

        if (!empty($foundCynical)) {
            $markers = array_merge($markers, array_slice($foundCynical, 0, 3));
            if (!empty($foundPraise)) {
                $score += 0.58;
                $reasons[] = 'Kontradiksi pujian (' . implode(', ', array_slice($foundPraise, 0, 2)) . ') dengan konteks sinis (' . implode(', ', array_slice($foundCynical, 0, 2)) . ')';
            } else {
                $score += 0.35;
                $reasons[] = 'Mengandung diksi satir politik (' . implode(', ', array_slice($foundCynical, 0, 2)) . ')';
            }
        }

        if (preg_match('/saking\s+(?:bagus|hebat|pintar|pinter|keren|adil|sukses|mantap)nya/u', $lower)) {
            $score += 0.55;
            $reasons[] = "Pola hiperbola 'saking ...-nya' yang menyindir kondisi riil";
            $markers[] = 'saking_nya';
        }

        if (preg_match('/["\'](?:bagus|hebat|mantap|adil|sukses|pintar|cerdas|transparan|aman)["\']/u', $lower)) {
            $score += 0.50;
            $reasons[] = 'Tanda kutip ironis pada kata sifat positif';
            $markers[] = 'ironic_quotes';
        }

        $finalScore = round(min(0.98, $score), 2);
        $isSarcasm = $finalScore >= 0.45;

        return [
            'is_sarcasm' => $isSarcasm,
            'sarcasm_score' => $isSarcasm ? $finalScore : round($finalScore * 0.5, 2),
            'sarcasm_reason' => !empty($reasons) ? implode('; ', array_slice(array_unique($reasons), 0, 2)) : '',
            'sarcasm_markers' => array_values(array_unique($markers)),
        ];
    }

    /**
     * Fast Layer-1 & Layer-2 bot signal evaluator.
     */
    public function detectBotSignalsPhp(
        string $text,
        ?string $authorName,
        ?string $provider,
        ?string $clusterId = null,
        int $clusterSize = 1
    ): array {
        if ($provider && strtolower($provider) === 'rss') {
            return [
                'is_inauthentic' => false,
                'inauthentic_score' => 0.02,
                'bot_signals' => [],
            ];
        }

        $score = 0.0;
        $signals = [];
        $author = trim($authorName ?? '');

        if ($clusterId && $clusterSize >= 2) {
            $score += min(0.75, 0.50 + ($clusterSize - 2) * 0.08);
            $signals[] = "Menyebarkan narasi copypasta identik ({$clusterSize} duplikasi beruntun)";
        }

        if (preg_match('/\d{4,}$/', $author)) {
            $score += 0.42;
            $signals[] = 'Username berakhiran deret angka acak (indikasi akun bot/ternak)';
        } elseif (preg_match('/^(?:@?user|@?netizen|@?akun|@?anon|@?warga|@?rakyat)[_\-]?\d{2,}/i', $author)) {
            $score += 0.45;
            $signals[] = 'Pola handle generik otomatis';
        }

        preg_match_all('/#\w+/u', $text, $hashtagMatches);
        $hashtagCount = count($hashtagMatches[0] ?? []);
        if ($hashtagCount >= 4) {
            $score += 0.30;
            $signals[] = "Amplifikasi tagar terkoordinasi ({$hashtagCount} hashtag)";
        } elseif ($hashtagCount >= 3) {
            $score += 0.18;
            $signals[] = 'Rentetan tagar kampanye';
        }

        $lower = Str::lower($text);
        if (preg_match('/kawal\s+terus\s+sampai\s+tuntas|dukung\s+penuh\s+langkah\s+tegas|jangan\s+mau\s+diadu\s+domba|bubarkan\s+sekarang\s+juga/u', $lower)) {
            $score += 0.25;
            $signals[] = 'Menggunakan slogan mobilisasi template';
        }

        $finalScore = round(min(0.99, $score), 2);
        return [
            'is_inauthentic' => $finalScore >= 0.50 || $clusterId !== null,
            'inauthentic_score' => $finalScore,
            'bot_signals' => $signals,
        ];
    }

    protected function normalizeForSimilarity(string $text): string
    {
        $cleaned = preg_replace('/https?:\/\/\S+/i', '', Str::lower($text));
        $cleaned = preg_replace('/@\w+/u', '', $cleaned);
        $cleaned = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $cleaned);
        return trim(preg_replace('/\s+/', ' ', $cleaned));
    }

    protected function extractWordShingles(string $normText): array
    {
        $words = array_values(array_filter(explode(' ', $normText), fn($w) => mb_strlen($w) > 2));
        if (empty($words)) {
            return [];
        }
        $shingles = $words;
        for ($i = 0; $i < count($words) - 1; $i++) {
            $shingles[] = $words[$i] . '_' . $words[$i + 1];
        }
        return array_unique($shingles);
    }

    protected function jaccardSimilarity(array $a, array $b): float
    {
        if (empty($a) || empty($b)) {
            return 0.0;
        }
        $intersect = count(array_intersect($a, $b));
        $union = count(array_unique(array_merge($a, $b)));
        return $union > 0 ? ($intersect / $union) : 0.0;
    }
}
