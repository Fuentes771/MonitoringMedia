<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Mention;
use Illuminate\Http\Request;
use Carbon\Carbon;

class MentionController extends Controller
{
    public function index(Request $request)
    {
        $workspaceId = $request->input('workspace_id', 1);
        $topicId = $request->input('topic_id');
        $provider = $request->input('provider');
        $sentiment = $request->input('sentiment');
        $search = $request->input('search');
        $perPage = min((int)$request->input('per_page', 20), 100);

        $query = Mention::where('workspace_id', $workspaceId)
            ->with(['sentiment', 'keywords' => fn($q) => $q->orderBy('score', 'desc')->limit(4), 'topics:id,name'])
            ->orderBy('published_at', 'desc');

        if ($topicId) {
            $query->whereHas('topics', fn($q) => $q->where('topics.id', $topicId));
        }

        if ($provider) {
            $query->where('provider', $provider);
        }

        if ($sentiment) {
            $query->whereHas('sentiment', fn($q) => $q->where('label', $sentiment));
        }

        if ($search) {
            $query->where('text', 'ilike', '%' . $search . '%');
        }

        $mentions = $query->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => $mentions->items(),
            'pagination' => [
                'current_page' => $mentions->currentPage(),
                'last_page' => $mentions->lastPage(),
                'per_page' => $mentions->perPage(),
                'total' => $mentions->total(),
            ],
        ]);
    }

    public function show($id)
    {
        $mention = Mention::with(['sentiment', 'keywords', 'topics'])->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => $mention,
        ]);
    }
}
