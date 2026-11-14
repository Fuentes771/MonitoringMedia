<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

class WorkspaceMember extends Model
{
    use HasFactory;

    public const ROLE = 'operator';

    protected $attributes = [
        'role' => self::ROLE,
    ];

    protected $fillable = [
        'workspace_id',
        'user_id',
        'role',
    ];

    protected static function booted(): void
    {
        static::saving(function (WorkspaceMember $member) {
            $role = $member->role ?? self::ROLE;
            if ($role !== self::ROLE) {
                throw new InvalidArgumentException(
                    "Role '{$role}' tidak didukung. Sistem hanya menggunakan 1 role: '" . self::ROLE . "'."
                );
            }

            $member->role = self::ROLE;
        });
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

