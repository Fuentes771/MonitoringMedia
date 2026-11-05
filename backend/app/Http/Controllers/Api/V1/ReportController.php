<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Mention;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Carbon\Carbon;

class ReportController extends Controller
{
    public function export(Request $request)
    {
        $workspaceId = $request->input('workspace_id', 1);
        $topicId = $request->input('topic_id');
        $provider = $request->input('provider');
        $sentiment = $request->input('sentiment');

        $query = Mention::where('workspace_id', $workspaceId)
            ->with(['sentiment', 'topics:id,name'])
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

        $mentions = $query->limit(1000)->get();

        $filename = 'pulsescope_export_' . Carbon::now('Asia/Jakarta')->format('Ymd_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        $callback = function () use ($mentions) {
            $file = fopen('php://output', 'w');
            fputcsv($file, [
                'ID', 'Provider', 'External ID', 'Author', 'Published At', 'Sentiment', 'Confidence', 'Topics', 'Source URL', 'Text'
            ]);

            foreach ($mentions as $m) {
                fputcsv($file, [
                    $m->id,
                    $m->provider,
                    $m->external_id,
                    $m->author_name ?: 'Anonymous',
                    $m->published_at?->toIso8601String(),
                    $m->sentiment?->label ?: 'unknown',
                    $m->sentiment?->confidence ?: 0.0,
                    $m->topics->pluck('name')->join(', '),
                    $m->source_url,
                    $m->text,
                ]);
            }

            fclose($file);
        };

        return new StreamedResponse($callback, 200, $headers);
    }
}
