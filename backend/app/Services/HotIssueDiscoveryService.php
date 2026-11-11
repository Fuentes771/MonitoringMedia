<?php

namespace App\Services;

use App\Models\Topic;
use App\Models\TopicKeyword;
use App\Services\IngestionService;
use App\Services\TrendService;
use App\Services\AlertService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Throwable;

class HotIssueDiscoveryService
{
    protected IngestionService $ingestionService;
    protected TrendService $trendService;
    protected AlertService $alertService;
    protected string $nlpUrl;

    public function __construct(
        IngestionService $ingestionService,
        TrendService $trendService,
        AlertService $alertService
    ) {
        $this->ingestionService = $ingestionService;
        $this->trendService = $trendService;
        $this->alertService = $alertService;
        $this->nlpUrl = rtrim(env('NLP_SERVICE_URL', 'http://127.0.0.1:8001'), '/');
    }

    /**
     * Discover breaking hot issues from Google News RSS and cluster them via AI.
     * Ingest mentions and update active hot issues radar.
     *
     * @param int $workspaceId
     * @return array<string, mixed>
     */
    public function discoverAndIngest(int $workspaceId = 1): array
    {
        $now = Carbon::now('Asia/Jakarta');
        Log::info("Starting automated Hot Issue discovery for workspace {$workspaceId}...");

        // 1. Fetch Google News Top Headlines & National News
        $headlines = $this->fetchGoogleNewsHeadlines();
        if (empty($headlines)) {
            Log::warning("No headlines fetched from Google News RSS feeds.");
            return [
                'status' => 'empty',
                'discovered_count' => 0,
                'message' => 'Tidak ada berita utama yang berhasil ditarik dari RSS feed.',
                'hot_issues' => [],
            ];
        }

        // 2. Cluster headlines using AI (NLP service / Gemini via 9Router)
        $clusters = $this->clusterHeadlinesWithAi($headlines);

        $processedTopics = [];
        $newCount = 0;

        foreach ($clusters as $item) {
            $name = trim($item['name'] ?? '');
            $keywords = $item['keywords'] ?? [];
            if (empty($name) || empty($keywords)) {
                continue;
            }

            // 3. Deduplicate against existing active topics
            $existingTopic = $this->findExistingSimilarTopic($workspaceId, $name, $keywords);

            if ($existingTopic) {
                // Update surge timestamp and ensure active
                $existingTopic->update([
                    'status' => 'active',
                    'surge_detected_at' => $now,
                ]);

                // Ensure keywords are present
                foreach ($keywords as $kw) {
                    $cleanKw = trim($kw);
                    if ($cleanKw) {
                        TopicKeyword::firstOrCreate([
                            'topic_id' => $existingTopic->id,
                            'keyword' => $cleanKw,
                        ], ['type' => 'include', 'match_mode' => 'broad']);
                    }
                }

                // Ingest latest mentions
                $this->ingestionService->ingestTopic($existingTopic);
                $this->trendService->computeTopicTrend($existingTopic);
                $this->alertService->evaluateTopicAlerts($existingTopic);

                $processedTopics[] = $existingTopic->fresh(['keywords']);
            } else {
                // Create new Topic
                $topic = Topic::create([
                    'workspace_id' => $workspaceId,
                    'name' => $name,
                    'description' => $item['description'] ?? 'Isu hangat nasional terdeteksi otomatis dari lonjakan pemberitaan publik.',
                    'category' => 'trending_issue',
                    'urgency_level' => $item['urgency_level'] ?? 'elevated',
                    'surge_detected_at' => $now,
                    'status' => 'active',
                    'match_mode' => 'any',
                    'providers' => ['rss', 'youtube', 'x', 'tiktok', 'instagram', 'facebook'],
                    'is_demo' => false,
                ]);

                foreach ($keywords as $kw) {
                    $cleanKw = trim($kw);
                    if ($cleanKw) {
                        TopicKeyword::create([
                            'topic_id' => $topic->id,
                            'keyword' => $cleanKw,
                            'type' => 'include',
                            'match_mode' => 'broad',
                        ]);
                    }
                }

                // Ingest mentions right away
                $this->ingestionService->ingestTopic($topic);
                $this->trendService->computeTopicTrend($topic);
                $this->alertService->evaluateTopicAlerts($topic);

                $processedTopics[] = $topic->load('keywords');
                $newCount++;
            }
        }

        // 4. Auto-Archive stale issues (> 48 hours without fresh mentions or keeping Top 10)
        $this->autoArchiveStaleIssues($workspaceId);

        return [
            'status' => 'success',
            'discovered_count' => count($clusters),
            'new_topics_created' => $newCount,
            'topics' => $processedTopics,
            'message' => "Berhasil memindai isu hangat. {$newCount} isu baru ditambahkan, total " . count($processedTopics) . " isu diperbarui.",
        ];
    }

    /**
     * Fetch headlines from Google News RSS.
     * @return array<int, array<string, string>>
     */
    protected function fetchGoogleNewsHeadlines(): array
    {
        $feeds = [
            'https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id',
            'https://news.google.com/rss/headlines/section/topic/NATION?hl=id&gl=ID&ceid=ID:id',
        ];

        $headlines = [];
        $seenTitles = [];

        foreach ($feeds as $feedUrl) {
            try {
                $response = Http::timeout(10)
                    ->withHeaders([
                        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PulseScope/2.0 NewsDiscoveryBot',
                    ])
                    ->get($feedUrl);

                if (!$response->successful()) {
                    continue;
                }

                $xmlString = $response->body();
                $prevEntityLoader = libxml_disable_entity_loader(true);
                $xml = simplexml_load_string($xmlString, 'SimpleXMLElement', LIBXML_NOCDATA);
                libxml_disable_entity_loader($prevEntityLoader);

                if ($xml === false || !isset($xml->channel->item)) {
                    continue;
                }

                foreach ($xml->channel->item as $item) {
                    $rawTitle = trim((string)$item->title);
                    $link = trim((string)$item->link);
                    $pubDate = trim((string)$item->pubDate);
                    $source = isset($item->source) ? trim((string)$item->source) : 'Media Nasional';

                    $cleanTitle = preg_replace('/\s*-\s*[^-\n]+$/', '', $rawTitle);
                    $lowerTitle = Str::lower($cleanTitle);

                    if (isset($seenTitles[$lowerTitle]) || strlen($cleanTitle) < 10) {
                        continue;
                    }
                    $seenTitles[$lowerTitle] = true;

                    $headlines[] = [
                        'title' => $cleanTitle,
                        'source' => $source,
                        'url' => $link,
                        'published_at' => $pubDate,
                    ];

                    if (count($headlines) >= 40) {
                        break 2;
                    }
                }
            } catch (Throwable $e) {
                Log::warning("Error fetching RSS feed {$feedUrl}: " . $e->getMessage());
            }
        }

        return $headlines;
    }

    /**
     * Cluster headlines using NLP Service or fallback.
     * @param array<int, array<string, string>> $headlines
     * @return array<int, array<string, mixed>>
     */
    protected function clusterHeadlinesWithAi(array $headlines): array
    {
        try {
            $response = Http::timeout(25)->post("{$this->nlpUrl}/ai/cluster-hot-issues", [
                'headlines' => $headlines,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                if (!empty($data['hot_issues']) && is_array($data['hot_issues'])) {
                    return $data['hot_issues'];
                }
            }
        } catch (Throwable $e) {
            Log::warning("NLP Service cluster-hot-issues unavailable: " . $e->getMessage());
        }

        // Heuristic fallback
        return $this->heuristicCluster($headlines);
    }

    /**
     * Internal PHP heuristic fallback when AI is unreachable.
     * @param array<int, array<string, string>> $headlines
     * @return array<int, array<string, mixed>>
     */
    protected function heuristicCluster(array $headlines): array
    {
        $clusters = [];
        $criticalKeywords = ['mundur', 'pengunduran diri', 'krisis', 'sadap', 'korupsi', 'ditangkap', 'darurat', 'bencana'];

        foreach (array_slice($headlines, 0, 5) as $h) {
            $title = $h['title'];
            $lower = Str::lower($title);
            $isCritical = false;
            foreach ($criticalKeywords as $ck) {
                if (str_contains($lower, $ck)) {
                    $isCritical = true;
                    break;
                }
            }

            // Generate keywords from words
            $words = array_values(array_filter(explode(' ', preg_replace('/[^a-zA-Z0-9\s]/', '', $lower)), fn($w) => strlen($w) >= 4));
            $kws = [$title];
            if (count($words) >= 2) {
                $kws[] = $words[0] . ' ' . $words[1];
            }
            if (count($words) >= 3) {
                $kws[] = $words[0] . ' ' . $words[2];
            }

            $clusters[] = [
                'name' => $title,
                'description' => "Pemberitaan terhangat dan perkembangan percakapan publik mengenai '{$title}'.",
                'urgency_level' => $isCritical ? 'critical' : 'elevated',
                'keywords' => array_unique($kws),
            ];
        }

        return $clusters;
    }

    /**
     * Deduplicate topic against existing active ones in workspace.
     */
    protected function findExistingSimilarTopic(int $workspaceId, string $name, array $keywords): ?Topic
    {
        $activeTopics = Topic::where('workspace_id', $workspaceId)
            ->where('category', 'trending_issue')
            ->where('status', 'active')
            ->with('keywords')
            ->get();

        $lowerName = Str::lower($name);

        foreach ($activeTopics as $topic) {
            // Check direct string similarity
            similar_text($lowerName, Str::lower($topic->name), $percent);
            if ($percent >= 60.0) {
                return $topic;
            }

            // Check keyword overlap
            $topicKeywords = $topic->keywords->pluck('keyword')->map(fn($k) => Str::lower($k))->toArray();
            foreach ($keywords as $kw) {
                $lkw = Str::lower(trim($kw));
                if (in_array($lkw, $topicKeywords)) {
                    return $topic;
                }
            }
        }

        return null;
    }

    /**
     * Auto-archive topics older than 48 hours or beyond top 10 limit.
     */
    protected function autoArchiveStaleIssues(int $workspaceId): void
    {
        $cutoff = Carbon::now('Asia/Jakarta')->subHours(48);

        // 1. Archive topics with no surge or mentions in the last 48 hours
        $topics = Topic::where('workspace_id', $workspaceId)
            ->where('category', 'trending_issue')
            ->where('status', 'active')
            ->get();

        foreach ($topics as $topic) {
            $latestMention = $topic->mentions()->orderBy('published_at', 'desc')->first();
            $lastActivity = $latestMention?->published_at ?: $topic->surge_detected_at ?: $topic->created_at;

            if ($lastActivity && $lastActivity < $cutoff) {
                $topic->update(['status' => 'archived']);
                Log::info("Auto-archived stale hot issue: {$topic->name} (Last active: {$lastActivity})");
            }
        }

        // 2. Cap active hot issues to Top 10 by mention count and recency
        $remainingActive = Topic::where('workspace_id', $workspaceId)
            ->where('category', 'trending_issue')
            ->where('status', 'active')
            ->withCount('mentions')
            ->orderBy('mentions_count', 'desc')
            ->orderBy('surge_detected_at', 'desc')
            ->get();

        if ($remainingActive->count() > 10) {
            $toArchive = $remainingActive->slice(10);
            foreach ($toArchive as $staleTopic) {
                $staleTopic->update(['status' => 'archived']);
            }
        }
    }
}
