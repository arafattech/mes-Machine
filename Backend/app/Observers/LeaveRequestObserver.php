<?php

namespace App\Observers;

use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Auth;

class LeaveRequestObserver
{
    public function __construct(private NotificationService $notificationService) {}

    public function created(LeaveRequest $leaveRequest): void
    {
        // LeaveService auto-approves at creation when the employee is their own
        // supervisor (or has none) — nothing pending on the supervisor side, so
        // notify HR directly instead of asking a (non-existent or self) supervisor to act.
        if (strtolower($leaveRequest->supervisor_status ?? '') === 'approved') {
            $this->notifyHrPendingReview($leaveRequest);
            return;
        }

        $employee = Employee::with('supervisor')->find($leaveRequest->employee_id);
        $employeeName = trim("{$employee?->first_name} {$employee?->last_name}");
        $supervisorUserId = $employee?->supervisor?->user_id;

        if (!$supervisorUserId) {
            return;
        }

        $this->notificationService->dispatchToSpecific(
            [$supervisorUserId],
            "New Leave Request from {$employeeName}",
            "{$employeeName} has applied for leave.",
            Auth::id(),
            'LeaveRequest',
            $leaveRequest->id,
            $leaveRequest->id,
            'applied'
        );
    }

    public function saved(LeaveRequest $leaveRequest): void
    {
        if ($leaveRequest->wasRecentlyCreated) {
            return;
        }

        if ($leaveRequest->wasChanged('supervisor_status')) {
            $this->handleSupervisorStatusChange($leaveRequest);
        }

        if ($leaveRequest->wasChanged('hr_status')) {
            $this->handleHrStatusChange($leaveRequest);
        }
    }

    private function handleSupervisorStatusChange(LeaveRequest $leaveRequest): void
    {
        $employee = Employee::find($leaveRequest->employee_id);
        $employeeUserId = $employee?->user_id;

        if (!$employeeUserId) {
            return;
        }

        $status = strtolower($leaveRequest->supervisor_status ?? '');

        if ($status === 'approved') {
            $this->notificationService->dispatchToSpecific(
                [$employeeUserId],
                'Leave Approved by Supervisor',
                'Your leave request has been approved by your supervisor.',
                Auth::id(),
                'LeaveRequest',
                $leaveRequest->id,
                $leaveRequest->id,
                'supervisor-approved'
            );

            $this->notifyHrPendingReview($leaveRequest);
        } elseif ($status === 'rejected') {
            $this->notificationService->dispatchToSpecific(
                [$employeeUserId],
                'Leave Rejected by Supervisor',
                'Your leave request has been rejected by your supervisor.',
                Auth::id(),
                'LeaveRequest',
                $leaveRequest->id,
                $leaveRequest->id,
                'supervisor-rejected'
            );
        }
    }

    private function notifyHrPendingReview(LeaveRequest $leaveRequest): void
    {
        $hrUserIds = User::permission('HR_LEAVE_REQUEST_APPROVE')
            ->get(['id'])
            ->pluck('id')
            ->toArray();

        if (empty($hrUserIds)) {
            return;
        }

        $this->notificationService->dispatchToSpecific(
            $hrUserIds,
            "Leave Supervisor Approved (#{$leaveRequest->id})",
            'A leave request has been approved by the supervisor and is pending HR review.',
            Auth::id(),
            'LeaveRequest',
            $leaveRequest->id,
            $leaveRequest->id,
            'supervisor-approved'
        );
    }

    private function handleHrStatusChange(LeaveRequest $leaveRequest): void
    {
        $employee = Employee::find($leaveRequest->employee_id);
        $employeeUserId = $employee?->user_id;

        if (!$employeeUserId) {
            return;
        }

        $status     = strtolower($leaveRequest->hr_status ?? '');
        $isApproved = $status === 'approved';

        $this->notificationService->dispatchToSpecific(
            [$employeeUserId],
            $isApproved ? 'Leave Approved by HR' : 'Leave Rejected by HR',
            $isApproved
                ? 'Your leave request has been fully approved by HR.'
                : 'Your leave request has been rejected by HR.',
            Auth::id(),
            'LeaveRequest',
            $leaveRequest->id,
            $leaveRequest->id,
            $isApproved ? 'hr-approved' : 'hr-rejected'
        );
    }
}
