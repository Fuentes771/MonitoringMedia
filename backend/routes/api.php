<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\TopicController;
use App\Http\Controllers\Api\V1\MentionController;
use App\Http\Controllers\Api\V1\TrendController;
use App\Http\Controllers\Api\V1\ConnectorController;
use App\Http\Controllers\Api\V1\AlertController;
use App\Http\Controllers\Api\V1\ReportController;

Route::prefix('v1')->group(function () {
    // 1. Authentication
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });

    // Public/analyst accessible with workspace context for seamless dev
    // 2. Dashboard
    Route::get('/dashboard/overview', [DashboardController::class, 'overview']);
    Route::get('/dashboard/timeseries', [DashboardController::class, 'timeseries']);

    // 3. Topics (Monitors)
    Route::get('/workspaces/{id}/topics', [TopicController::class, 'index']);
    Route::post('/workspaces/{id}/topics', [TopicController::class, 'store']);
    Route::get('/topics/{id}', [TopicController::class, 'show']);
    Route::patch('/topics/{id}', [TopicController::class, 'update']);
    Route::delete('/topics/{id}', [TopicController::class, 'destroy']);
    Route::post('/topics/{id}/sync', [TopicController::class, 'sync']);

    // 4. Mentions
    Route::get('/mentions', [MentionController::class, 'index']);
    Route::get('/mentions/{id}', [MentionController::class, 'show']);

    // 5. Trends & Intelligence
    Route::get('/trends', [TrendController::class, 'index']);

    // 6. Connectors (Data Sources)
    Route::get('/connectors', [ConnectorController::class, 'index']);
    Route::post('/connectors/{provider}/connect', [ConnectorController::class, 'connect']);
    Route::post('/connectors/{provider}/test', [ConnectorController::class, 'test']);

    // 7. Alerts & Notifications
    Route::get('/alerts', [AlertController::class, 'index']);
    Route::post('/alerts', [AlertController::class, 'store']);
    Route::patch('/alerts/events/{id}', [AlertController::class, 'updateEvent']);
    Route::get('/notifications', [AlertController::class, 'notifications']);

    // 8. Reports & Exports
    Route::post('/reports/export', [ReportController::class, 'export']);
});
