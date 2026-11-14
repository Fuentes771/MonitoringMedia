<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesAuthorizedWorkspace;
use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\AlertEvent;
use App\Models\Notification;
use App\Models\Topic;
use Illuminate\Http\Request;
use Carbon\Carbon;

class AlertController extends Controller
{
    use ResolvesAuthorizedWorkspace;

    public function index(Request $request)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);

        $rules = Alert::where('workspace_id', $workspaceId)
            ->with('topic:id,name')
            ->orderBy('id', 'desc')
            ->get();

        $events = AlertEvent::whereHas('alert', fn($q) => $q->where('workspace_id', $workspaceId))
            ->with(['alert.topic:id,name', 'acknowledgedByUser:id,name'])
            ->orderBy('triggered_at', 'desc')
            ->limit(30)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'rules' => $rules,
                'events' => $events,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);

        $validated = $request->validate([
            'topic_id' => 'required|exists:topics,id',
            'type' => 'required|in:volume_spike,negative_surge',
            'threshold_json' => 'required|array',
            'cooldown_minutes' => 'nullable|integer|min:15|max:1440',
        ]);

        $topic = Topic::findOrFail($validated['topic_id']);
        $this->authorizeResourceWorkspace($request, (int) $topic->workspace_id);
        if ((int) $topic->workspace_id !== $workspaceId) {
            abort(403, 'Topik bukan milik workspace yang dipilih.');
        }

        $alert = Alert::create([
            'workspace_id' => $workspaceId,
            'topic_id' => $validated['topic_id'],
            'type' => $validated['type'],
            'threshold_json' => $validated['threshold_json'],
            'cooldown_minutes' => $validated['cooldown_minutes'] ?? 60,
            'is_active' => true,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Aturan alert berhasil dibuat.',
            'data' => $alert,
        ], 201);
    }

    public function updateEvent(Request $request, $id)
    {
        $event = AlertEvent::with('alert')->findOrFail($id);
        $this->authorizeResourceWorkspace($request, (int) $event->alert->workspace_id);

        $validated = $request->validate([
            'status' => 'required|in:acknowledged,resolved,false_positive',
        ]);

        $now = Carbon::now('Asia/Jakarta');
        $user = $request->user();

        $updates = ['status' => $validated['status']];
        if ($validated['status'] === 'acknowledged') {
            $updates['acknowledged_at'] = $now;
            $updates['acknowledged_by'] = $user?->id;
        } elseif ($validated['status'] === 'resolved') {
            $updates['resolved_at'] = $now;
        }

        $event->update($updates);

        return response()->json([
            'status' => 'success',
            'message' => "Status alert diubah menjadi {$validated['status']}.",
            'data' => $event,
        ]);
    }

    public function notifications(Request $request)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);

        $notifications = Notification::where('workspace_id', $workspaceId)
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $notifications,
        ]);
    }
}

