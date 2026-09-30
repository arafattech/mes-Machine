<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\JsonResponse;

class NotificationController extends Controller
{
    public function markRead(int $id): JsonResponse
    {
        $notification = Notification::where('recipient_id', auth()->id())->findOrFail($id);
        $notification->update(['is_read' => true, 'read_at' => now()]);

        return response()->json(['message' => 'Notification marked as read.']);
    }

    public function destroy(int $id): JsonResponse
    {
        Notification::where('recipient_id', auth()->id())->findOrFail($id)->delete();

        return response()->json(['message' => 'Notification removed.']);
    }

    public function clearAll(): JsonResponse
    {
        Notification::where('recipient_id', auth()->id())->delete();

        return response()->json(['message' => 'All notifications cleared.']);
    }

    public function markAllRead(): JsonResponse
    {
        $updated = Notification::where('recipient_id', auth()->id())
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);

        return response()->json([
            'updated_count' => $updated,
            'message'       => 'All notifications marked as read.',
        ]);
    }

}
