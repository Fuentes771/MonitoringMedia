<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(WorkspaceMember::class);
    }

    public function workspaces(): BelongsToMany
    {
        return $this->belongsToMany(Workspace::class, 'workspace_members')
            ->withPivot('role')
            ->wherePivot('role', WorkspaceMember::ROLE)
            ->withTimestamps();
    }

    public function ownedWorkspaces(): HasMany
    {
        return $this->hasMany(Workspace::class, 'owner_id');
    }

    /**
     * Workspaces owned by or shared with this user, annotated with the single workspace role.
     *
     * @return Collection<int, Workspace>
     */
    public function accessibleWorkspaces(): Collection
    {
        $memberWorkspaces = $this->workspaces()
            ->orderBy('workspaces.id')
            ->get();

        $memberIds = $memberWorkspaces->pluck('id')->all();

        $ownedOnly = $this->ownedWorkspaces()
            ->when(!empty($memberIds), fn ($query) => $query->whereNotIn('id', $memberIds))
            ->orderBy('id')
            ->get();

        return $memberWorkspaces
            ->concat($ownedOnly)
            ->sortBy('id')
            ->values()
            ->map(function (Workspace $ws) {
                $ws->setAttribute('resolved_role', WorkspaceMember::ROLE);
                return $ws;
            });
    }

    public function roleInWorkspace(int $workspaceId): ?string
    {
        $workspace = Workspace::find($workspaceId);
        if (!$workspace) {
            return null;
        }

        if ((int) $workspace->owner_id === (int) $this->id) {
            return WorkspaceMember::ROLE;
        }

        $isMember = $this->memberships()
            ->where('workspace_id', $workspaceId)
            ->where('role', WorkspaceMember::ROLE)
            ->exists();

        return $isMember ? WorkspaceMember::ROLE : null;
    }

    public function canAccessWorkspace(int $workspaceId): bool
    {
        return $this->roleInWorkspace($workspaceId) === WorkspaceMember::ROLE;
    }
}
