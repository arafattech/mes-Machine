<?php

namespace App\Http\Controllers;

use App\Models\Notice;
use App\Models\Employee;
use App\Models\NoticesEmployee;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class NoticeController extends Controller
{
    public function __construct(private NotificationService $notificationService) {}
    public function index()
    {
        try {
            $notices = Notice::with(['departments', 'employees'])->latest()->get();
            return response()->json($notices);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch notices',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
    public function store(Request $request)
    {
        try {

            $validated = $request->validate([
                'title'           => 'required|string|max:255',
                'content'         => 'required|string',
            ]);

            $notice = Notice::create([
                'is_active'       => $request->is_active ?? true,
                'title'           => $request->title,
                'content'         => $request->content,
                'target_audience' => $request->target_audience,
            ]);

            $departmentIds = $request->departments ?? [];
            if (!empty($departmentIds)) {
                $notice->departments()->attach($departmentIds);

                $employeesFromDept = Employee::whereIn('department_id', $departmentIds)->pluck('id');
                foreach ($employeesFromDept as $empId) {
                    $notice->employees()->attach($empId, [
                        'is_acknowledged' => $request->is_acknowledged ?? false,
                        'is_read'         => false,
                        'published_at'    => now(),
                    ]);
                }
            }

            $employeeIds = $request->employees ?? [];
            if (!empty($employeeIds)) {
                $noticeEmployees = [];
                foreach ($employeeIds as $empId) {
                    $noticeEmployees[$empId] = [
                        'is_acknowledged' => $request->is_acknowledged ?? false,
                        'is_read'         => $request->is_read ?? false,
                        'published_at'    => now(),
                    ];
                }
                $notice->employees()->attach($noticeEmployees);
            }

            $recipientUserIds = [];

            if ($notice->is_active) {
                $notice->load('employees');
                $recipientUserIds = $this->resolveNoticeRecipientUserIds($notice);

                if (!empty($recipientUserIds)) {
                    $this->notificationService->dispatchToSpecific(
                        $recipientUserIds,
                        "New Notice: {$notice->title}",
                        "A new notice has been published for you.",
                        Auth::id(),
                        'Notice',
                        $notice->id,
                        $notice->custom_id ?? $notice->id,
                        'created'
                    );
                }
            }

            return response()->json([
                'message'             => 'Notice created successfully',
                'data'                => $notice,
                'recipient_user_ids'  => $recipientUserIds,
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors'  => $e->errors(),
            ], 422);
        }
    }

    /**
     * Recipients = exactly the notice's targeted employees (Individual/Department/All).
     * Keeping this in sync ensures the real-time toast and the persisted
     * notification log/bell count always agree on who was notified.
     */
    private function resolveNoticeRecipientUserIds(Notice $notice): array
    {
        return $notice->employees->pluck('user_id')
            ->filter()
            ->unique()
            ->values()
            ->toArray();
    }

    public function markAsRead(Request $request, $id)
    {
        try {
            $noticeEmployee = NoticesEmployee::findOrFail($id);

            $noticeEmployee->update([
                'is_read' => true,
            ]);

            return response()->json([
                'message' => 'Notice marked as read successfully',
                'data'    => $noticeEmployee
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to mark notice as read',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
    public function feedback($noticeId)
    {
        $feedback = NoticesEmployee::with('employee')
            ->where('notice_id', $noticeId)
            ->get();

        return response()->json([
            'data' => $feedback
        ]);
    }


    public function update(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'title'   => 'required|string|max:255',
                'content' => 'required|string',
            ]);

            $notice = Notice::findOrFail($id);

            $wasDraft = !$notice->is_active;

            $notice->update([
                'is_active'       => $request->is_active ?? $notice->is_active,
                'title'           => $request->title,
                'content'         => $request->content,
                'target_audience' => $request->target_audience,
                'published_at'    => $request->published_at ?? now(),
            ]);

            $departmentIds = $request->departments ?? [];
            $notice->departments()->sync($departmentIds);

            $audience = strtolower($request->target_audience);
            $employeeIds = [];

            if ($audience === 'department' && !empty($departmentIds)) {
                $employeeIds = Employee::whereIn('department_id', $departmentIds)
                    ->where('is_active', true)
                    ->pluck('id')
                    ->toArray();
            } elseif ($audience === 'individual' || $audience === 'employee') {
                $employeeIds = Employee::whereIn('id', $request->employees ?? [])
                    ->where('is_active', true)
                    ->pluck('id')
                    ->toArray();
            } elseif ($audience === 'all') {
                $employeeIds = Employee::where('is_active', true)
                    ->pluck('id')
                    ->toArray();
            }

            $noticeEmployees = [];
            foreach ($employeeIds as $empId) {
                $noticeEmployees[$empId] = [
                    'is_acknowledged' => $request->is_acknowledged ?? false,
                    'is_read'         => $request->is_read ?? false,
                    'published_at'    => now(),
                ];
            }

            $wasPublished = $wasDraft && ($request->is_active === true || $request->is_active === 1 || $request->is_active === 'true');

            $notice->employees()->sync($noticeEmployees);

            $recipientUserIds = [];

            if ($wasPublished) {
                $notice->load('employees');
                $recipientUserIds = $this->resolveNoticeRecipientUserIds($notice);

                if (!empty($recipientUserIds)) {
                    $this->notificationService->dispatchToSpecific(
                        $recipientUserIds,
                        "New Notice: {$notice->title}",
                        "A new notice has been published for you.",
                        Auth::id(),
                        'Notice',
                        $notice->id,
                        $notice->custom_id ?? $notice->id,
                        'created'
                    );
                }
            }

            return response()->json([
                'message'            => 'Notice updated successfully',
                'data'               => $notice->load(['departments', 'employees']),
                'recipient_user_ids' => $recipientUserIds,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors'  => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Update failed',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

}
