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
        Schema::table('topics', function (Blueprint $table) {
            $table->string('category')->default('national_program')->after('description'); // national_program, trending_issue
            $table->string('urgency_level')->default('normal')->after('category'); // normal, elevated, critical
            $table->timestamp('surge_detected_at')->nullable()->after('urgency_level');
            $table->index(['category', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('topics', function (Blueprint $table) {
            $table->dropIndex(['category', 'status']);
            $table->dropColumn(['category', 'urgency_level', 'surge_detected_at']);
        });
    }
};
