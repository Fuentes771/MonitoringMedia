<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mentions', function (Blueprint $table) {
            if (!Schema::hasColumn('mentions', 'is_inauthentic')) {
                $table->boolean('is_inauthentic')->default(false)->index();
            }
            if (!Schema::hasColumn('mentions', 'inauthentic_score')) {
                $table->decimal('inauthentic_score', 4, 2)->default(0.00);
            }
            if (!Schema::hasColumn('mentions', 'is_sarcasm')) {
                $table->boolean('is_sarcasm')->default(false)->index();
            }
            if (!Schema::hasColumn('mentions', 'bot_cluster_id')) {
                $table->string('bot_cluster_id', 64)->nullable()->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('mentions', function (Blueprint $table) {
            $cols = [];
            foreach (['is_inauthentic', 'inauthentic_score', 'is_sarcasm', 'bot_cluster_id'] as $col) {
                if (Schema::hasColumn('mentions', $col)) {
                    $cols[] = $col;
                }
            }
            if (!empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
