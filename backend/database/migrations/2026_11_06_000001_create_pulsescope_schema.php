<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Workspaces
        Schema::create('workspaces', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });

        // 2. Workspace Members (RBAC: owner, admin, analyst, viewer)
        Schema::create('workspace_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('role', ['owner', 'admin', 'analyst', 'viewer'])->default('analyst');
            $table->timestamps();

            $table->unique(['workspace_id', 'user_id']);
        });

        // 3. Topics (Monitors)
        Schema::create('topics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status')->default('active'); // active, paused, archived
            $table->string('match_mode')->default('any'); // any, all
            $table->jsonb('language_filters')->nullable(); // ["id", "en"]
            $table->jsonb('providers')->nullable(); // ["rss", "youtube", "reddit"]
            $table->boolean('is_demo')->default(false);
            $table->timestamps();

            $table->index(['workspace_id', 'status']);
        });

        // 4. Topic Keywords (Include / Exclude)
        Schema::create('topic_keywords', function (Blueprint $table) {
            $table->id();
            $table->foreignId('topic_id')->constrained('topics')->cascadeOnDelete();
            $table->string('keyword');
            $table->enum('type', ['include', 'exclude'])->default('include');
            $table->string('match_mode')->default('broad'); // broad, exact
            $table->timestamps();

            $table->index(['topic_id', 'type']);
        });

        // 5. Connectors (Data Sources)
        Schema::create('connectors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->string('provider'); // rss, youtube, reddit, x
            $table->string('status')->default('disconnected'); // connected, needs_config, rate_limited, degraded, disconnected
            $table->jsonb('capabilities_json')->nullable();
            $table->timestamp('last_successful_sync_at')->nullable();
            $table->timestamps();

            $table->unique(['workspace_id', 'provider']);
        });

        // 6. Connector Credentials (Encrypted)
        Schema::create('connector_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('connector_id')->constrained('connectors')->cascadeOnDelete();
            $table->text('encrypted_payload');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // 7. Ingestion Runs (Audit and Run History)
        Schema::create('ingestion_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('connector_id')->constrained('connectors')->cascadeOnDelete();
            $table->foreignId('topic_id')->nullable()->constrained('topics')->nullOnDelete();
            $table->string('status')->default('running'); // running, success, failed
            $table->jsonb('counts_json')->nullable(); // {"collected": 24, "new": 18, "duplicates": 6}
            $table->string('error_code')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index(['connector_id', 'started_at']);
        });

        // 8. Mentions (Collected Public Posts/Articles)
        Schema::create('mentions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->string('provider'); // rss, youtube, reddit
            $table->string('external_id');
            $table->text('source_url')->nullable();
            $table->string('author_name')->nullable();
            $table->timestamp('published_at');
            $table->timestamp('collected_at');
            $table->text('text');
            $table->text('text_normalized')->nullable();
            $table->string('language', 10)->default('id');
            $table->string('deletion_status')->default('active'); // active, deleted_at_source, purged
            $table->boolean('is_demo')->default(false);
            $table->jsonb('metadata_json')->nullable(); // engagement metrics, view count, comments
            $table->timestamps();

            $table->unique(['provider', 'external_id']);
            $table->index(['workspace_id', 'published_at']);
            $table->index(['workspace_id', 'provider']);
            $table->index('deletion_status');
        });

        // 9. Mention Topic Matches (Relation)
        Schema::create('mention_topic_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mention_id')->constrained('mentions')->cascadeOnDelete();
            $table->foreignId('topic_id')->constrained('topics')->cascadeOnDelete();
            $table->jsonb('matched_keywords_json')->nullable();
            $table->timestamps();

            $table->unique(['mention_id', 'topic_id']);
            $table->index(['topic_id', 'mention_id']);
        });

        // 10. Sentiment Results
        Schema::create('sentiment_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mention_id')->constrained('mentions')->cascadeOnDelete();
            $table->enum('label', ['positive', 'neutral', 'negative', 'unknown'])->default('unknown');
            $table->float('confidence')->default(0.0);
            $table->jsonb('probabilities_json')->nullable(); // {"positive": 0.05, "neutral": 0.10, "negative": 0.85}
            $table->string('model_version')->default('v1.0-hybrid');
            $table->timestamp('analyzed_at');
            $table->timestamps();

            $table->unique('mention_id');
            $table->index(['label', 'confidence']);
        });

        // 11. Mention Keywords (Extracted Unigrams / Bigrams)
        Schema::create('mention_keywords', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mention_id')->constrained('mentions')->cascadeOnDelete();
            $table->string('keyword');
            $table->float('score')->default(1.0);
            $table->timestamps();

            $table->index(['keyword', 'score']);
        });

        // 12. Trend Snapshots
        Schema::create('trend_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('topic_id')->constrained('topics')->cascadeOnDelete();
            $table->timestamp('window_start');
            $table->timestamp('window_end');
            $table->float('score')->default(0.0); // 0 - 100
            $table->integer('sample_count')->default(0);
            $table->jsonb('components_json')->nullable(); // volume, growth, acceleration, diversity, persistence
            $table->text('explanation')->nullable();
            $table->timestamps();

            $table->index(['workspace_id', 'topic_id', 'window_end']);
        });

        // 13. Alerts
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('topic_id')->constrained('topics')->cascadeOnDelete();
            $table->string('type'); // volume_spike, negative_surge
            $table->jsonb('threshold_json'); // {"volume_threshold": 50, "growth_percent": 100, "negative_share_percent": 40}
            $table->integer('cooldown_minutes')->default(60);
            $table->timestamp('last_triggered_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['workspace_id', 'is_active']);
        });

        // 14. Alert Events
        Schema::create('alert_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_id')->constrained('alerts')->cascadeOnDelete();
            $table->string('status')->default('open'); // open, acknowledged, resolved, false_positive
            $table->string('severity')->default('medium'); // low, medium, high, critical
            $table->jsonb('evidence_json')->nullable();
            $table->timestamp('triggered_at');
            $table->timestamp('acknowledged_at')->nullable();
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['alert_id', 'status']);
        });

        // 15. Notifications
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('type'); // alert_triggered, connector_error, system_info
            $table->string('title');
            $table->text('message');
            $table->jsonb('payload_json')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['workspace_id', 'read_at']);
        });

        // 16. Audit Logs
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('target_type');
            $table->unsignedBigInteger('target_id')->nullable();
            $table->jsonb('metadata_json')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['workspace_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('alert_events');
        Schema::dropIfExists('alerts');
        Schema::dropIfExists('trend_snapshots');
        Schema::dropIfExists('mention_keywords');
        Schema::dropIfExists('sentiment_results');
        Schema::dropIfExists('mention_topic_matches');
        Schema::dropIfExists('mentions');
        Schema::dropIfExists('ingestion_runs');
        Schema::dropIfExists('connector_credentials');
        Schema::dropIfExists('connectors');
        Schema::dropIfExists('topic_keywords');
        Schema::dropIfExists('topics');
        Schema::dropIfExists('workspace_members');
        Schema::dropIfExists('workspaces');
    }
};

