<?php

namespace App\Http\Controllers;

use App\Models\Reminder;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ReminderController extends Controller
{
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'mrr_id' => 'required|exists:material_receipts,id',
                'message' => 'required|string',
                'purchase_message' => 'nullable|string',
                'reminder_date' => 'required|date',
            ]);

            $reminder = Reminder::create([
                ...$validated,
                'created_by' => auth()->id(),
            ]);

            return response()->json([
                'message' => 'Reminder created successfully',
                'data' => $reminder,
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        }
    }

    public function update(Request $request, Reminder $reminder)
    {
        try {
            $validated = $request->validate([
                'mrr_id' => 'required|exists:material_receipts,id',
                'message' => 'required|string',
                'purchase_message' => 'nullable|string',
                'reminder_date' => 'required|date',
                'is_read' => 'sometimes|boolean',
            ]);

            $reminder->update($validated);

            return response()->json([
                'message' => 'Reminder updated successfully',
                'data' => $reminder,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        }
    }
}
