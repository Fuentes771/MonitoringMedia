<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Kredensial yang dimasukkan tidak cocok dengan data kami.'],
            ]);
        }

        $token = $user->createToken('auth-token')->plainTextToken;
        $workspace = $user->workspaces()->first() ?: Workspace::first();

        $role = 'analyst';
        if ($workspace) {
            $membership = $user->memberships()->where('workspace_id', $workspace->id)->first();
            $role = $membership?->role ?: 'analyst';
        }

        return response()->json([
            'status' => 'success',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'active_workspace' => $workspace ? [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'role' => $role,
            ] : null,
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $workspace = $user->workspaces()->first() ?: Workspace::first();

        $role = 'analyst';
        if ($workspace) {
            $membership = $user->memberships()->where('workspace_id', $workspace->id)->first();
            $role = $membership?->role ?: 'analyst';
        }

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'active_workspace' => $workspace ? [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'role' => $role,
            ] : null,
            'workspaces' => $user->workspaces()->get(['workspaces.id', 'workspaces.name', 'workspaces.slug']),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Berhasil logout.',
        ]);
    }
}
