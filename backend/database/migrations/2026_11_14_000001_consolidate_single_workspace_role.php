<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check');
            DB::table('workspace_members')->update(['role' => 'operator']);
            DB::statement("ALTER TABLE workspace_members ALTER COLUMN role SET DEFAULT 'operator'");
            DB::statement("ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check CHECK (role::text = 'operator'::text)");
            return;
        }

        DB::table('workspace_members')->update(['role' => 'operator']);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check');
            DB::statement("ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check CHECK (role::text = 'operator'::text)");
        }
    }
};

