<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Topic;
use App\Models\TopicKeyword;
use App\Models\MentionTopicMatch;
use App\Models\Mention;
use App\Models\SentimentResult;
use App\Models\MentionKeyword;
use Illuminate\Support\Facades\DB;

class PurgeLegacyTopicsCommand extends Command
{
    protected $signature = 'pulsescope:purge-legacy';
    protected $description = 'Permanently delete legacy demo topics (Transportation & Fintech) and their associated data';

    public function handle(): int
    {
        $priorityProgramNames = [
            'Makan Bergizi Gratis (MBG)',
            'Cek Kesehatan Gratis (CKG)',
            'Sekolah Rakyat',
            'Sekolah Unggul Garuda',
            'Revitalisasi Sekolah',
            'Digitalisasi Pembelajaran',
            'Magang Nasional',
            'Koperasi Desa/Kelurahan Merah Putih',
            'Program 3 Juta Rumah',
            'Kampung Nelayan Merah Putih',
            'PNM Mekaar',
            'Penghapusan Piutang Macet UMKM',
            'Swasembada Pangan',
            'Hilirisasi Nasional',
            'Ketahanan Energi',
            'Gerakan Indonesia ASRI',
            'Bank Emas (Bullion Bank)',
        ];

        $legacyTopics = Topic::whereNotIn('name', $priorityProgramNames)->get();

        if ($legacyTopics->isEmpty()) {
            $this->info('No legacy non-priority topics found. Database is clean!');
            return 0;
        }

        $this->warn("Found {$legacyTopics->count()} legacy topic(s) to purge permanently:");
        foreach ($legacyTopics as $t) {
            $this->line(" - [ID: {$t->id}] {$t->name}");
        }

        DB::transaction(function () use ($legacyTopics) {
            foreach ($legacyTopics as $topic) {
                // Find all mentions uniquely attached to this topic
                $mentionIds = MentionTopicMatch::where('topic_id', $topic->id)->pluck('mention_id')->toArray();

                // Delete topic keywords
                TopicKeyword::where('topic_id', $topic->id)->delete();

                // Delete topic matches
                MentionTopicMatch::where('topic_id', $topic->id)->delete();

                // Delete mentions and their sentiments/keywords that belong only to this topic
                foreach ($mentionIds as $mId) {
                    $otherMatches = MentionTopicMatch::where('mention_id', $mId)->count();
                    if ($otherMatches === 0) {
                        SentimentResult::where('mention_id', $mId)->delete();
                        MentionKeyword::where('mention_id', $mId)->delete();
                        Mention::where('id', $mId)->delete();
                    }
                }

                // Delete the topic itself
                $topic->delete();
            }
        });

        $this->info('Successfully purged legacy topics and associated data. Only 17 National Priority Programs remain.');
        return 0;
    }
}

