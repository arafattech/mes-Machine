<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;

class NotificationClear extends Controller
{
    public function markAllAsRead(): JsonResponse
    {
        $query = ActivityLog::query();

        $updated = $query->where('is_read', false)->update(['is_read' => true]);

        return response()->json([
            'updated_count' => $updated,
            'message' => 'All unread activity logs marked as read.',
        ]);
    }
}
