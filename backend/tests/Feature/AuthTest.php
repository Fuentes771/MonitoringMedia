<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Mention;
use App\Models\Topic;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use InvalidArgumentException;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected User $otherUser;
    protected Workspace $workspace;
    protected Workspace $otherWorkspace;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Operator Utama',
            'email' => 'operator@pulsescope.local',
            'password' => Hash::make('password123'),
        ]);

        $this->otherUser = User::create([
            'name' => 'Operator Eksternal',
            'email' => 'other@pulsescope.local',
            'password' => Hash::make('password123'),
        ]);

        $this->workspace = Workspace::create([
            'name' => 'PulseScope Intelligence Hub',
            'slug' => 'pulsescope-hub',
            'owner_id' => $this->otherUser->id,
        ]);

        WorkspaceMember::create([
            'workspace_id' => $this->workspace->id,
            'user_id' => $this->user->id,
            'role' => WorkspaceMember::ROLE,
        ]);

        $this->otherWorkspace = Workspace::create([
            'name' => 'External Confidential Hub',
            'slug' => 'external-hub',
            'owner_id' => $this->otherUser->id,
        ]);

        WorkspaceMember::create([
            'workspace_id' => $this->otherWorkspace->id,
            'user_id' => $this->otherUser->id,
        ]);
    }

    public function test_user_can_login_with_valid_credentials_and_audit_log_is_recorded(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'operator@pulsescope.local',
            'password' => 'password123',
            'remember' => false,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('user.email', 'operator@pulsescope.local')
            ->assertJsonPath('active_workspace.id', $this->workspace->id)
            ->assertJsonPath('active_workspace.role', WorkspaceMember::ROLE)
            ->assertJsonPath('workspaces.0.role', WorkspaceMember::ROLE)
            ->assertJsonCount(1, 'workspaces')
            ->assertJsonStructure([
                'status',
                'token',
                'expires_at',
                'user' => ['id', 'name', 'email'],
                'active_workspace' => ['id', 'name', 'slug', 'role'],
                'workspaces',
            ]);

        $tokenRecord = PersonalAccessToken::latest('id')->first();
        $this->assertNotNull($tokenRecord);
        $this->assertNotNull($tokenRecord->expires_at);
        $hoursUntilExpiry = Carbon::now()->diffInHours($tokenRecord->expires_at, false);
        $this->assertGreaterThanOrEqual(11, $hoursUntilExpiry);
        $this->assertLessThanOrEqual(13, $hoursUntilExpiry);

        $this->assertDatabaseHas('audit_logs', [
            'workspace_id' => $this->workspace->id,
            'actor_id' => $this->user->id,
            'action' => 'auth.login',
        ]);
    }

    public function test_workspace_creator_and_member_both_resolve_to_single_operator_role(): void
    {
        $this->assertSame(WorkspaceMember::ROLE, $this->user->roleInWorkspace($this->workspace->id));
        $this->assertSame(WorkspaceMember::ROLE, $this->otherUser->roleInWorkspace($this->workspace->id));
        $this->assertSame(WorkspaceMember::ROLE, $this->otherUser->roleInWorkspace($this->otherWorkspace->id));
        $this->assertNull($this->user->roleInWorkspace($this->otherWorkspace->id));

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'other@pulsescope.local',
            'password' => 'password123',
        ])->assertStatus(200);

        $login->assertJsonPath('active_workspace.role', WorkspaceMember::ROLE);
        $token = $login->json('token');

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/me')
            ->assertStatus(200)
            ->assertJsonPath('active_workspace.role', WorkspaceMember::ROLE)
            ->assertJsonPath('workspaces.0.role', WorkspaceMember::ROLE)
            ->assertJsonPath('workspaces.1.role', WorkspaceMember::ROLE);
    }

    public function test_legacy_and_unsupported_roles_are_rejected_and_default_role_is_operator(): void
    {
        $thirdUser = User::create([
            'name' => 'Operator Baru',
            'email' => 'baru@pulsescope.local',
            'password' => Hash::make('password123'),
        ]);

        $defaultMember = WorkspaceMember::create([
            'workspace_id' => $this->workspace->id,
            'user_id' => $thirdUser->id,
        ]);

        $this->assertSame('operator', $defaultMember->role);

        foreach (['owner', 'admin', 'analyst', 'viewer', 'superadmin'] as $legacyRole) {
            try {
                WorkspaceMember::create([
                    'workspace_id' => $this->otherWorkspace->id,
                    'user_id' => $thirdUser->id,
                    'role' => $legacyRole,
                ]);
                $this->fail("Expected InvalidArgumentException for unsupported role '{$legacyRole}'.");
            } catch (InvalidArgumentException $e) {
                $this->assertStringContainsString($legacyRole, $e->getMessage());
            }
        }

        $this->expectException(QueryException::class);
        DB::table('workspace_members')->insert([
            'workspace_id' => $this->otherWorkspace->id,
            'user_id' => $thirdUser->id,
            'role' => 'viewer',
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ]);
    }

    public function test_user_without_workspace_membership_cannot_access_workspace_endpoints(): void
    {
        $unassignedUser = User::create([
            'name' => 'Tanpa Akses',
            'email' => 'no-workspace@pulsescope.local',
            'password' => Hash::make('password123'),
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'no-workspace@pulsescope.local',
            'password' => 'password123',
        ])->assertStatus(200)
            ->assertJsonPath('active_workspace', null)
            ->assertJsonCount(0, 'workspaces');

        $token = $login->json('token');

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/dashboard/overview')
            ->assertStatus(403);

        $this->assertFalse($unassignedUser->canAccessWorkspace($this->workspace->id));
    }

    public function test_remember_me_issues_thirty_day_token(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'operator@pulsescope.local',
            'password' => 'password123',
            'remember' => true,
        ]);

        $response->assertStatus(200);
        $tokenRecord = PersonalAccessToken::latest('id')->first();
        $this->assertNotNull($tokenRecord);
        $daysUntilExpiry = Carbon::now()->diffInDays($tokenRecord->expires_at, false);
        $this->assertGreaterThanOrEqual(29, $daysUntilExpiry);
        $this->assertLessThanOrEqual(31, $daysUntilExpiry);
    }

    public function test_invalid_credentials_return_validation_error_and_record_failed_audit(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'operator@pulsescope.local',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        $this->assertDatabaseHas('audit_logs', [
            'workspace_id' => $this->workspace->id,
            'actor_id' => $this->user->id,
            'action' => 'auth.login_failed',
        ]);
    }

    public function test_login_is_rate_limited_after_five_failed_attempts_and_cleared_after_success(): void
    {
        RateLimiter::clear('operator@pulsescope.local|127.0.0.1');

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'operator@pulsescope.local',
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        $blocked = $this->postJson('/api/v1/auth/login', [
            'email' => 'operator@pulsescope.local',
            'password' => 'password123',
        ]);

        $blocked->assertStatus(429)
            ->assertJsonPath('status', 'error')
            ->assertJsonStructure(['status', 'message', 'retry_after']);

        RateLimiter::clear('operator@pulsescope.local|127.0.0.1');

        $this->postJson('/api/v1/auth/login', [
            'email' => 'operator@pulsescope.local',
            'password' => 'password123',
        ])->assertStatus(200);
    }

    public function test_unauthenticated_requests_to_protected_endpoints_return_401_json(): void
    {
        $this->getJson('/api/v1/me')->assertStatus(401);
        $this->getJson('/api/v1/dashboard/overview')->assertStatus(401);
        $this->getJson('/api/v1/mentions')->assertStatus(401);
        $this->get('/api/v1/trends')->assertStatus(401);
    }

    public function test_expired_token_is_rejected_with_401(): void
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'operator@pulsescope.local',
            'password' => 'password123',
        ])->assertStatus(200);

        $token = $login->json('token');
        $pat = PersonalAccessToken::findToken($token);
        $this->assertNotNull($pat);
        $pat->forceFill(['expires_at' => Carbon::now()->subMinute()])->save();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/me')
            ->assertStatus(401);
    }

    public function test_cross_workspace_access_is_forbidden_with_403(): void
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'operator@pulsescope.local',
            'password' => 'password123',
        ])->assertStatus(200);

        $token = $login->json('token');

        $foreignTopic = Topic::create([
            'workspace_id' => $this->otherWorkspace->id,
            'name' => 'Rahasia Eksternal',
            'status' => 'active',
        ]);

        $foreignMention = Mention::create([
            'workspace_id' => $this->otherWorkspace->id,
            'provider' => 'rss',
            'external_id' => 'ext_forbidden_1',
            'text' => 'Konten rahasia workspace lain',
            'published_at' => Carbon::now(),
            'collected_at' => Carbon::now(),
        ]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/v1/dashboard/overview?workspace_id={$this->otherWorkspace->id}")
            ->assertStatus(403);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/v1/workspaces/{$this->otherWorkspace->id}/topics")
            ->assertStatus(403);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/v1/topics/{$foreignTopic->id}")
            ->assertStatus(403);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/v1/mentions/{$foreignMention->id}")
            ->assertStatus(403);
    }

    public function test_logout_revokes_active_token_and_records_audit_log(): void
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'operator@pulsescope.local',
            'password' => 'password123',
        ])->assertStatus(200);

        $token = $login->json('token');

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/auth/logout')
            ->assertStatus(200)
            ->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('audit_logs', [
            'workspace_id' => $this->workspace->id,
            'actor_id' => $this->user->id,
            'action' => 'auth.logout',
        ]);

        // Clear cached guard state in the same test process before verifying token revocation
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/me')
            ->assertStatus(401);

        $this->assertSame(0, PersonalAccessToken::where('tokenable_id', $this->user->id)->count());
        $this->assertGreaterThanOrEqual(2, AuditLog::where('actor_id', $this->user->id)->count());
    }
}
