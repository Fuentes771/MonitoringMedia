<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const MAX_LOGIN_ATTEMPTS = 5;
    private const LOCKOUT_SECONDS = 60;

    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'remember' => 'sometimes|boolean',
        ]);

        $throttleKey = $this->throttleKey($validated['email'], (string) $request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_LOGIN_ATTEMPTS)) {
            $seconds = max(1, RateLimiter::availableIn($throttleKey));
            $existingUser = User::where('email', $validated['email'])->first();
            $this->recordAuthAudit(
                $existingUser,
                $existingUser?->accessibleWorkspaces()->first(),
                'auth.login_rate_limited',
                $request,
                ['retry_after' => $seconds]
            );

            return response()->json([
                'status' => 'error',
                'message' => "Terlalu banyak percobaan login gagal. Coba lagi dalam {$seconds} detik.",
                'retry_after' => $seconds,
            ], 429);
        }

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($throttleKey, self::LOCKOUT_SECONDS);
            $this->recordAuthAudit(
                $user,
                $user?->accessibleWorkspaces()->first(),
                'auth.login_failed',
                $request
            );

            throw ValidationException::withMessages([
                'email' => ['Kredensial yang dimasukkan tidak cocok dengan data kami.'],
            ]);
        }

        RateLimiter::clear($throttleKey);

        $remember = $request->boolean('remember');
        $expiresAt = $remember ? now()->addDays(30) : now()->addHours(12);
        $token = $user->createToken('auth-token', ['*'], $expiresAt)->plainTextToken;

        $workspaces = $user->accessibleWorkspaces();
        $activeWorkspace = $workspaces->first();

        $this->recordAuthAudit($user, $activeWorkspace, 'auth.login', $request, [
            'remember' => $remember,
            'expires_at' => $expiresAt->toIso8601String(),
        ]);

        return response()->json([
            'status' => 'success',
            'token' => $token,
            'expires_at' => $expiresAt->toIso8601String(),
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'active_workspace' => $activeWorkspace ? $this->formatWorkspacePayload($activeWorkspace) : null,
            'workspaces' => $workspaces->map(fn (Workspace $ws) => $this->formatWorkspacePayload($ws))->values(),
        ]);
    }

    public function me(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $workspaces = $user->accessibleWorkspaces();
        $activeWorkspace = $workspaces->first();
        $currentToken = $user->currentAccessToken();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'active_workspace' => $activeWorkspace ? $this->formatWorkspacePayload($activeWorkspace) : null,
            'workspaces' => $workspaces->map(fn (Workspace $ws) => $this->formatWorkspacePayload($ws))->values(),
            'token_expires_at' => $currentToken?->expires_at?->toIso8601String(),
        ]);
    }

    public function logout(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $workspace = $user->accessibleWorkspaces()->first();

        $this->recordAuthAudit($user, $workspace, 'auth.logout', $request);
        $user->currentAccessToken()?->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Berhasil logout.',
        ]);
    }

    private function throttleKey(string $email, string $ip): string
    {
        return Str::transliterate(Str::lower(trim($email)) . '|' . $ip);
    }

    private function formatWorkspacePayload(Workspace $workspace): array
    {
        return [
            'id' => $workspace->id,
            'name' => $workspace->name,
            'slug' => $workspace->slug,
            'role' => WorkspaceMember::ROLE,
        ];
    }

    private function recordAuthAudit(
        ?User $user,
        ?Workspace $workspace,
        string $action,
        Request $request,
        array $extraMetadata = []
    ): void {
        if (!$user || !$workspace) {
            return;
        }

        AuditLog::create([
            'workspace_id' => $workspace->id,
            'actor_id' => $user->id,
            'action' => $action,
            'target_type' => 'user',
            'target_id' => $user->id,
            'metadata_json' => array_merge([
                'user_agent' => Str::limit((string) $request->userAgent(), 200),
            ], $extraMetadata),
            'ip_address' => $request->ip(),
        ]);
    }
}
