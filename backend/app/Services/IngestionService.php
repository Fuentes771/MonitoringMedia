<?php

namespace App\Services;

use App\Adapters\ProviderAdapterInterface;
use App\Adapters\RssProviderAdapter;
use App\Adapters\YouTubeProviderAdapter;
use App\Adapters\XProviderAdapter;
use App\Adapters\TikTokProviderAdapter;
use App\Adapters\InstagramProviderAdapter;
use App\Adapters\FacebookProviderAdapter;
use App\Models\Topic;
use App\Models\Connector;
use App\Models\IngestionRun;
use App\Models\Mention;
use App\Models\MentionTopicMatch;
use App\Models\SentimentResult;
use App\Models\MentionKeyword;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Throwable;

class IngestionService
{
    /** @var array<string, ProviderAdapterInterface> */
    protected array $adapters = [];

    public function __construct()
    {
        $this->registerAdapter(new RssProviderAdapter());
        $this->registerAdapter(new YouTubeProviderAdapter());
        $this->registerAdapter(new XProviderAdapter());
        $this->registerAdapter(new TikTokProviderAdapter());
        $this->registerAdapter(new InstagramProviderAdapter());
        $this->registerAdapter(new FacebookProviderAdapter());
    }

    public function registerAdapter(ProviderAdapterInterface $adapter): void
    {
        $this->adapters[$adapter->getProviderKey()] = $adapter;
    }

    /**
     * Ingest mentions for a topic across all its allowed providers.
     * @return array<string, mixed>
     */
    public function ingestTopic(Topic $topic): array
    {
        $providers = $topic->providers ?: ['rss'];
        $results = [];

        foreach ($providers as $providerKey) {
            if (!isset($this->adapters[$providerKey])) {
                continue;
            }

            $adapter = $this->adapters[$providerKey];
            $results[$providerKey] = $this->runAdapterIngestion($topic, $adapter);
        }

        return $results;
    }

    /**
     * Run ingestion for a specific topic and adapter.
     */
    public function runAdapterIngestion(Topic $topic, ProviderAdapterInterface $adapter): array
    {
        $providerKey = $adapter->getProviderKey();
        $startTime = Carbon::now('Asia/Jakarta');

        $connector = Connector::firstOrCreate(
            ['workspace_id' => $topic->workspace_id, 'provider' => $providerKey],
            [
                'status' => 'disconnected',
                'capabilities_json' => $adapter->getCapabilities(),
            ]
        );

        $run = IngestionRun::create([
            'connector_id' => $connector->id,
            'topic_id' => $topic->id,
            'status' => 'running',
            'started_at' => $startTime,
        ]);

        $ingestionResult = $adapter->fetch($topic);

        if (!$ingestionResult->isSuccess()) {
            $run->update([
                'status' => 'failed',
                'error_code' => $ingestionResult->errorCode,
                'error_message' => $ingestionResult->errorMessage,
                'finished_at' => Carbon::now('Asia/Jakarta'),
            ]);

            // Update connector status if needs config or error
            if ($ingestionResult->errorCode === 'NEEDS_CONFIGURATION') {
                $connector->update(['status' => 'needs_config']);
            } else {
                $connector->update(['status' => 'degraded']);
            }

            return [
                'status' => 'failed',
                'error' => $ingestionResult->errorMessage,
                'counts' => ['collected' => 0, 'new' => 0, 'duplicates' => 0],
            ];
        }

        $records = $ingestionResult->records;
        $newCount = 0;
        $dupCount = 0;

        foreach ($records as $record) {
            // Deduplication check: unique by (provider, external_id)
            $existing = Mention::where('provider', $record['provider'])
                ->where('external_id', $record['external_id'])
                ->first();

            if ($existing) {
                $dupCount++;
                // Still ensure topic match relation exists
                MentionTopicMatch::firstOrCreate([
                    'mention_id' => $existing->id,
                    'topic_id' => $topic->id,
                ], [
                    'matched_keywords_json' => $record['matched_keywords'] ?? [],
                ]);
                continue;
            }

            // Create new mention
            $mention = Mention::create([
                'workspace_id' => $topic->workspace_id,
                'provider' => $record['provider'],
                'external_id' => $record['external_id'],
                'source_url' => $record['source_url'] ?? null,
                'author_name' => $record['author_name'] ?? null,
                'published_at' => $record['published_at'],
                'collected_at' => $record['collected_at'] ?? Carbon::now('Asia/Jakarta'),
                'text' => $record['text'],
                'text_normalized' => $record['text_normalized'] ?? mb_strtolower(trim($record['text'])),
                'language' => $record['language'] ?? 'id',
                'deletion_status' => 'active',
                'is_demo' => $record['is_demo'] ?? false,
                'metadata_json' => $record['metadata_json'] ?? null,
            ]);

            // Link to topic
            MentionTopicMatch::create([
                'mention_id' => $mention->id,
                'topic_id' => $topic->id,
                'matched_keywords_json' => $record['matched_keywords'] ?? [],
            ]);

            // Analyze sentiment via FastAPI service (:8001)
            $this->analyzeAndStoreNlp($mention);

            $newCount++;
        }

        $counts = [
            'collected' => count($records),
            'new' => $newCount,
            'duplicates' => $dupCount,
        ];

        $run->update([
            'status' => 'success',
            'counts_json' => $counts,
            'finished_at' => Carbon::now('Asia/Jakarta'),
        ]);

        $connector->update([
            'status' => 'connected',
            'last_successful_sync_at' => Carbon::now('Asia/Jakarta'),
        ]);

        return [
            'status' => 'success',
            'counts' => $counts,
        ];
    }

    /**
     * Send mention text to Python NLP service for sentiment & keyword extraction.
     */
    protected function analyzeAndStoreNlp(Mention $mention): void
    {
        $nlpUrl = env('NLP_SERVICE_URL', 'http://127.0.0.1:8001');

        try {
            $useAi = (bool)env('NLP_INGEST_USE_AI', false);
            $response = Http::timeout(10)->post("{$nlpUrl}/analyze", [
                'text' => $mention->text,
                'language' => $mention->language,
                'top_keywords' => 5,
                'use_ai' => $useAi,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $sent = $data['sentiment'] ?? [];
                $kws = $data['keywords'] ?? [];

                SentimentResult::updateOrCreate(
                    ['mention_id' => $mention->id],
                    [
                        'label' => $sent['label'] ?? 'unknown',
                        'confidence' => $sent['confidence'] ?? 0.50,
                        'probabilities_json' => $sent['probabilities'] ?? null,
                        'model_version' => $sent['model_version'] ?? 'v2.0-9router',
                        'analyzed_at' => Carbon::now('Asia/Jakarta'),
                    ]
                );

                // Store rich AI reasoning in mention metadata
                if (isset($sent['aspect']) || isset($sent['key_reason'])) {
                    $meta = $mention->metadata_json ?? [];
                    $meta['ai_analysis'] = [
                        'aspect' => $sent['aspect'] ?? 'umum',
                        'key_reason' => $sent['key_reason'] ?? '',
                        'urgency' => $sent['urgency'] ?? 'low',
                        'engine' => $sent['engine'] ?? 'nlp-service',
                    ];
                    $mention->update(['metadata_json' => $meta]);
                }

                foreach ($kws as $kw) {
                    MentionKeyword::firstOrCreate(
                        ['mention_id' => $mention->id, 'keyword' => $kw['keyword']],
                        ['score' => $kw['score'] ?? 1.0]
                    );
                }
                return;
            }
        } catch (Throwable $e) {
            Log::warning("NLP service call failed: {$e->getMessage()}. Using fallback neutral.");
        }

        // Fallback if NLP service unavailable
        SentimentResult::updateOrCreate(
            ['mention_id' => $mention->id],
            [
                'label' => 'neutral',
                'confidence' => 0.60,
                'probabilities_json' => ['positive' => 0.15, 'neutral' => 0.70, 'negative' => 0.15],
                'model_version' => 'fallback-v1',
                'analyzed_at' => Carbon::now('Asia/Jakarta'),
            ]
        );
    }
}

