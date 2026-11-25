<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mention_keywords', function (Blueprint $table) {
            $table->index(['mention_id', 'score'], 'idx_mention_keywords_mention_score');
        });

        Schema::table('mentions', function (Blueprint $table) {
            $table->index(['workspace_id', 'is_inauthentic', 'published_at'], 'idx_mentions_ws_inauth_pub');
            $table->index(['workspace_id', 'author_name'], 'idx_mentions_ws_author');
        });

        Schema::table('sentiment_results', function (Blueprint $table) {
            $table->index(['mention_id', 'label'], 'idx_sentiment_mention_label');
        });

        Schema::table('trend_snapshots', function (Blueprint $table) {
            $table->index(['workspace_id', 'window_end', 'score'], 'idx_trends_ws_end_score');
        });

        Schema::table('topics', function (Blueprint $table) {
            $table->index(['workspace_id', 'category', 'status'], 'idx_topics_ws_cat_status');
        });
    }

    public function down(): void
    {
        Schema::table('mention_keywords', function (Blueprint $table) {
            $table->dropIndex('idx_mention_keywords_mention_score');
        });

        Schema::table('mentions', function (Blueprint $table) {
            $table->dropIndex('idx_mentions_ws_inauth_pub');
            $table->dropIndex('idx_mentions_ws_author');
        });

        Schema::table('sentiment_results', function (Blueprint $table) {
            $table->dropIndex('idx_sentiment_mention_label');
        });

        Schema::table('trend_snapshots', function (Blueprint $table) {
            $table->dropIndex('idx_trends_ws_end_score');
        });

        Schema::table('topics', function (Blueprint $table) {
            $table->dropIndex('idx_topics_ws_cat_status');
        });
    }
};
