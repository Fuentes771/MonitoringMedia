<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Topic;
use App\Models\TopicKeyword;
use App\Models\Mention;
use App\Models\MentionTopicMatch;
use App\Models\SentimentResult;
use App\Models\MentionKeyword;
use App\Models\Alert;
use App\Models\AlertEvent;
use Illuminate\Support\Facades\DB;

class PurgeDemoDataCommand extends Command
{
    protected $signature = 'pulsescope:purge-demo {--all-mentions : Hapus juga seluruh sebutan RSS berita agar database sebutan benar-benar kosong}';
    protected $description = 'Hapus seluruh data demo (isu hangat buatan, sebutan medsos tiruan X/TikTok/IG/FB) secara permanen';

    public function handle(): int
    {
        $this->warn('=== PEMBERSIHAN DATA DEMO PULSESCOPE ===');

        $purgeAllMentions = $this->option('all-mentions');

        // 1. Identify Demo Topics (Trending issues seeded for demo or is_demo = true)
        $demoTopics = Topic::where('category', 'trending_issue')
            ->orWhere('is_demo', true)
            ->orWhereIn('name', [
                'Dugaan Penyadapan Presiden Prabowo oleh LSP & Lembaga Asing',
                'Polemik Rencana Kenaikan Tarif PPN 12%',
            ])
            ->get();

        $this->info("Menemukan {$demoTopics->count()} topik demo untuk dihapus:");
        foreach ($demoTopics as $t) {
            $this->line(" - [ID: {$t->id}] {$t->name} (Kategori: {$t->category})");
        }

        // 2. Identify Demo Mentions (seeded demo external IDs or length != 64)
        if ($purgeAllMentions) {
            $mentionsToPurge = Mention::all();
            $this->warn("Opsi --all-mentions aktif: Menghapus SELURUH ({$mentionsToPurge->count()}) sebutan di database.");
        } else {
            $mentionsToPurge = Mention::where('is_demo', true)
                ->orWhereRaw('length(external_id) != 64')
                ->orWhere('external_id', 'like', 'x_%')
                ->orWhere('external_id', 'like', 'tiktok_%')
                ->orWhere('external_id', 'like', 'ig_%')
                ->orWhere('external_id', 'like', 'fb_%')
                ->orWhere('external_id', 'like', 'rss_sadap_%')
                ->orWhere('external_id', 'like', 'rss_ppn_%')
                ->get();

            $this->info("Menemukan {$mentionsToPurge->count()} sebutan demo (medsos & isu buatan) untuk dihapus.");
        }

        DB::transaction(function () use ($demoTopics, $mentionsToPurge) {
            // A. Clean up demo topics
            foreach ($demoTopics as $topic) {
                // Delete keywords
                TopicKeyword::where('topic_id', $topic->id)->delete();

                // Delete topic matches
                MentionTopicMatch::where('topic_id', $topic->id)->delete();

                // Delete topic
                $topic->delete();
            }

            // B. Clean up demo mentions
            $mentionIds = $mentionsToPurge->pluck('id')->toArray();
            if (!empty($mentionIds)) {
                // Delete sentiment results
                $deletedSentiments = SentimentResult::whereIn('mention_id', $mentionIds)->delete();

                // Delete mention keywords
                $deletedKeywords = MentionKeyword::whereIn('mention_id', $mentionIds)->delete();

                // Delete topic matches
                $deletedMatches = MentionTopicMatch::whereIn('mention_id', $mentionIds)->delete();

                // Delete mentions
                $deletedMentions = Mention::whereIn('id', $mentionIds)->delete();

                $this->info("Berhasil menghapus {$deletedMentions} sebutan demo, {$deletedSentiments} analisis sentimen, {$deletedMatches} relasi topik, dan {$deletedKeywords} kata kunci.");
            }

            // C. Clean up any demo alert events
            $deletedAlertEvents = AlertEvent::where('status', 'open')->delete();
            if ($deletedAlertEvents > 0) {
                $this->info("Berhasil membersihkan {$deletedAlertEvents} alert event demo.");
            }
        });

        $remainingTopics = Topic::count();
        $remainingMentions = Mention::count();
        $this->info("\n=== STATUS DATABASE SETELAH PEMBERSIHAN ===");
        $this->info("Sisa Topik: {$remainingTopics} (Hanya 17 Program Prioritas Nasional)");
        $this->info("Sisa Sebutan: {$remainingMentions}" . ($remainingMentions > 0 ? " (Data riil berita RSS)" : " (Kosong / Siap Ingest)"));

        return 0;
    }
}

