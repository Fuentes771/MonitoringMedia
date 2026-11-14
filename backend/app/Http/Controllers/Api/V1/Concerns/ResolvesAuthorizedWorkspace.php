<?php

namespace App\Http\Controllers\Api\V1\Concerns;

use App\Models\User;
use Illuminate\Http\Request;

trait ResolvesAuthorizedWorkspace
{
    /**
     * Resolve and verify workspace access for the authenticated user.
     */
    protected function resolveAuthorizedWorkspaceId(Request $request, int|string|null $explicitWorkspaceId = null): int
    {
        /** @var User|null $user */
        $user = $request->user();
        if (!$user) {
            abort(401, 'Autentikasi diperlukan.');
        }

        $rawId = $explicitWorkspaceId ?? $request->input('workspace_id');

        if ($rawId === null || $rawId === '') {
            $firstWorkspace = $user->accessibleWorkspaces()->first();
            if (!$firstWorkspace) {
                abort(403, 'Akun Anda belum terhubung ke workspace mana pun.');
            }

            return (int) $firstWorkspace->id;
        }

        $workspaceId = (int) $rawId;
        if ($workspaceId <= 0 || !$user->canAccessWorkspace($workspaceId)) {
            abort(403, 'Anda tidak memiliki akses ke workspace ini.');
        }

        return $workspaceId;
    }

    /**
     * Verify the authenticated user can access a resource belonging to the given workspace.
     */
    protected function authorizeResourceWorkspace(Request $request, int $resourceWorkspaceId): void
    {
        $this->resolveAuthorizedWorkspaceId($request, $resourceWorkspaceId);
    }
}

