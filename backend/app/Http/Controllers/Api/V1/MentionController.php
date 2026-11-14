<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesAuthorizedWorkspace;
use App\Http\Controllers\Controller;
use App\Models\Mention;
use App\Services\BuzzerDetectionService;
use App\Services\SocialLinkValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MentionController extends Controller
{
    use ResolvesAuthorizedWorkspace;

    private const SOCIAL_PROVIDERS = ['x', 'tiktok', 'instagram', 'facebook', 'youtube', 'reddit'];

    public function index(Request $request, BuzzerDetectionService $buzzerService, SocialLinkValidator $validator)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);
        $topicId = $request->input('topic_id');
        $provider = trim((string) $request->input('provider', ''));
        $sentiment = $request->input('sentiment');
        $search = $request->input('search');
        $linkStatus = trim((string) $request->input('link_status', ''));
        $interactionType = trim((string) $request->input('interaction_type', ''));
        $excludeInauthentic = $request->boolean('exclude_inauthentic');
        $onlySarcasm = $request->boolean('only_sarcasm');
        $onlyInauthentic = $request->boolean('only_inauthentic');
        $perPage = min((int) $request->input('per_page', 20), 100);

        $query = Mention::where('workspace_id', $workspaceId)
            ->with(['sentiment', 'keywords' => fn ($q) => $q->orderBy('score', 'desc')->limit(4), 'topics:id,name'])
            ->orderBy('published_at', 'desc');

        if ($excludeInauthentic) {
            $query->where('is_inauthentic', false);
        }

        if ($onlySarcasm) {
            $query->where('is_sarcasm', true);
        }

        if ($onlyInauthentic) {
            $query->where('is_inauthentic', true);
        }

        if ($topicId) {
            $query->whereHas('topics', fn ($q) => $q->where('topics.id', $topicId));
        }

        if ($provider !== '') {
            if ($provider === 'social') {
                $query->whereIn('provider', self::SOCIAL_PROVIDERS);
            } elseif (str_contains($provider, ',')) {
                $providers = array_values(array_filter(array_map('trim', explode(',', $provider))));
                if (!empty($providers)) {
                    $query->whereIn('provider', $providers);
                }
            } else {
                $query->where('provider', $provider);
            }
        }

        if (in_array($interactionType, ['comment', 'comments'], true)) {
            $query->where('metadata_json->is_comment', true);
        } elseif (in_array($interactionType, ['post', 'posts'], true)) {
            $query->where(function ($q) {
                $q->where('metadata_json->is_comment', false)
                    ->orWhereNull('metadata_json->is_comment');
            });
        }

        if ($linkStatus === 'verified') {
            $query->whereIn('metadata_json->link_status', [
                SocialLinkValidator::STATUS_VERIFIED_POST,
                SocialLinkValidator::STATUS_VERIFIED_ARTICLE,
            ]);
        } elseif ($linkStatus !== '') {
            $query->where('metadata_json->link_status', $linkStatus);
        }

        if ($sentiment) {
            $query->whereHas('sentiment', fn ($q) => $q->where('label', $sentiment));
        }

        if ($search) {
            $likeOp = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where('text', $likeOp, '%' . $search . '%');
        }

        $mentions = $query->paginate($perPage);
        $collection = collect($mentions->items());

        // Ensure current page mentions have up-to-date sarcasm & bot signals
        $buzzerService->evaluateMentionsBatch($collection);

        // Compute normalized link_status cleanly for legacy records lacking metadata_json.link_status
        $serialized = $collection->map(function (Mention $m) use ($validator) {
            $arr = $m->toArray();
            $meta = is_array($m->metadata_json) ? $m->metadata_json : [];
            $effectiveStatus = $validator->resolveEffectiveStatus(
                $m->provider,
                $m->source_url,
                $meta,
                (bool) $m->is_demo
            );
            $arr['link_status'] = $effectiveStatus;
            $arr['metrics_available'] = (bool) ($meta['metrics_available'] ?? (!empty($meta['metrics'])));
            return $arr;
        })->values();

        return response()->json([
            'status' => 'success',
            'data' => $serialized,
            'pagination' => [
                'current_page' => $mentions->currentPage(),
                'last_page' => $mentions->lastPage(),
                'per_page' => $mentions->perPage(),
                'total' => $mentions->total(),
            ],
        ]);
    }

    public function show(Request $request, $id, SocialLinkValidator $validator)
    {
        $mention = Mention::with(['sentiment', 'keywords', 'topics'])->findOrFail($id);
        $this->authorizeResourceWorkspace($request, (int) $mention->workspace_id);

        $arr = $mention->toArray();
        $meta = is_array($mention->metadata_json) ? $mention->metadata_json : [];
        $arr['link_status'] = $validator->resolveEffectiveStatus(
            $mention->provider,
            $mention->source_url,
            $meta,
            (bool) $mention->is_demo
        );
        $arr['metrics_available'] = (bool) ($meta['metrics_available'] ?? (!empty($meta['metrics'])));

        return response()->json([
            'status' => 'success',
            'data' => $arr,
        ]);
    }
}
