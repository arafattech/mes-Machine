<?php

namespace App\Http\Controllers;

use App\Models\ApprovalType;
use App\Models\LeaveApproval;
use App\Models\LeaveRequest;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class LeaveApprovalController extends Controller
{

    public function approvers(Request $request, LeaveRequest $leaveRequest)
    {
        return response()->json(['data' => $this->loadApprovers($leaveRequest)]);
    }

    public function progress(Request $request)
    {
        $ids = collect(explode(',', (string) $request->query('ids', '')))
            ->map(fn ($id) => (int) trim($id))
            ->filter()
            ->values();

        if ($ids->isEmpty()) {
            return response()->json(['total' => [], 'approved' => [], 'rejected' => []]);
        }

        $leaveRequests = LeaveRequest::with('leavetype.approvalType')
            ->whereIn('id', $ids)
            ->get(['id', 'leave_type_id', 'final_status']);

        $byApprovalType = $leaveRequests->groupBy(fn ($lr) => $lr->leavetype?->approvalType?->id);

        $total = [];
        $approved = [];
        $rejected = [];

        foreach ($byApprovalType as $approvalTypeId => $group) {
            if (!$approvalTypeId) {
                foreach ($group as $lr) {
                    $total[$lr->id] = 0;
                    $approved[$lr->id] = 0;
                    $rejected[$lr->id] = 0;
                }
                continue;
            }

            $approvalType = $group->first()->leavetype->approvalType;
            $employeeIds = $approvalType->employees()->pluck('employees.id');
            $liveTotal = $employeeIds->count();
            $requestIds = $group->pluck('id');

            $counts = LeaveApproval::whereIn('leave_request_id', $requestIds)
                ->whereIn('employee_id', $employeeIds)
                ->selectRaw('leave_request_id, status, count(*) as decision_count')
                ->groupBy('leave_request_id', 'status')
                ->get();

            $approvedCounts = $counts->where('status', 'approved')->pluck('decision_count', 'leave_request_id');
            $rejectedCounts = $counts->where('status', 'rejected')->pluck('decision_count', 'leave_request_id');

            foreach ($group as $lr) {
                $finalized = in_array($lr->final_status, ['approved', 'rejected'], true);
                $decided = (int) $counts->where('leave_request_id', $lr->id)->sum('decision_count');
                $total[$lr->id] = $finalized ? $decided : $liveTotal;
                $approved[$lr->id] = (int) ($approvedCounts[$lr->id] ?? 0);
                $rejected[$lr->id] = (int) ($rejectedCounts[$lr->id] ?? 0);
            }
        }

        return response()->json(['total' => $total, 'approved' => $approved, 'rejected' => $rejected]);
    }

    public function approve(Request $request, $leaveRequestId)
    {
        return $this->recordDecision($leaveRequestId, 'approved');
    }

    public function reject(Request $request, $leaveRequestId)
    {
        return $this->recordDecision($leaveRequestId, 'rejected');
    }

    private function recordDecision($leaveRequestId, string $status)
    {
        $employeeId = auth()->user()?->employee?->id;
        if (!$employeeId) {
            return response()->json(['message' => 'No employee linked to the current user'], 403);
        }

        $leaveRequest = LeaveRequest::with('leavetype')->find($leaveRequestId);
        if (!$leaveRequest) {
            return response()->json(['message' => 'Leave request not found'], 404);
        }
        if ($leaveRequest->final_status !== 'pending') {
            return response()->json(['message' => 'This request has already been finalized — no further action is possible'], 409);
        }

        $approvalType = $leaveRequest->leavetype?->approvalType;
        if (!$approvalType) {
            return response()->json(['message' => 'No approval chain configured for this leave type'], 404);
        }

        $isAssignedApprover = $approvalType->employees()->where('employees.id', $employeeId)->exists();
        if (!$isAssignedApprover) {
            return response()->json(['message' => 'You are not an assigned approver for this request'], 403);
        }

        LeaveApproval::updateOrCreate(
            ['leave_request_id' => $leaveRequestId, 'employee_id' => $employeeId],
            ['status' => $status, 'approved_at' => now()],
        );

        $rows = $this->loadApprovers($leaveRequest, $approvalType);
        $this->finalizeLeaveRequestIfNeeded($leaveRequest, $rows, $status);
        $this->notifyOnDecision($leaveRequest, $rows, $status, auth()->id(), $employeeId);

        return response()->json([
            'data' => $rows,
            'hr_status' => $leaveRequest->hr_status,
            'final_status' => $leaveRequest->final_status,
        ]);
    }

    private function finalizeLeaveRequestIfNeeded(LeaveRequest $leaveRequest, $rows, string $decisionStatus): void
    {
        if ($decisionStatus === 'rejected') {
            $leaveRequest->hr_status = 'rejected';
            $leaveRequest->final_status = 'rejected';
            $leaveRequest->save();
            return;
        }

        $allRequiredApproved = collect($rows)
            ->filter(fn ($row) => $row->pivot->is_required)
            ->every(fn ($row) => $row->status === 'approved');

        if (!$allRequiredApproved) {
            return;
        }

        $leaveRequest->hr_status = 'approved';
        $leaveRequest->final_status = 'approved';
        $leaveRequest->save();
    }

    private function notifyOnDecision(LeaveRequest $leaveRequest, \Illuminate\Support\Collection $rows, string $status, ?int $actingUserId, $actingEmployeeId = null): void
    {
        if (!in_array($leaveRequest->hr_status, ['approved', 'rejected'], true)) {
            $sorted = collect($rows)->sortBy(fn ($row) => $row->pivot->sequence_index ?? 0)->values();
            $nextStep = $sorted->firstWhere('status', 'pending');
            if ($nextStep && $nextStep->user_id) {
                $actingEmployee = collect($rows)->firstWhere('id', $actingEmployeeId);
                $actorName = $actingEmployee
                    ? trim("{$actingEmployee->first_name} {$actingEmployee->last_name}")
                    : 'An approver';

                (new NotificationService())->dispatchToSpecific(
                    [$nextStep->user_id],
                    "Your Approval Needed — Leave Request",
                    "{$actorName} approved the leave request — it's now awaiting your approval.",
                    $actingUserId,
                    'LeaveRequest',
                    (int) $leaveRequest->id,
                    $leaveRequest->id,
                    'pending_approval',
                );
            }
            return;
        }

        $requesterUserId = $leaveRequest->employee?->user_id;
        if (!$requesterUserId) {
            return;
        }

        $title = $status === 'approved' ? 'Leave Approved by HR' : 'Leave Rejected by HR';
        $message = $status === 'approved' ? 'Your leave request has been approved.' : 'Your leave request has been rejected.';

        (new NotificationService())->dispatchToSpecific(
            [$requesterUserId],
            $title,
            $message,
            $actingUserId,
            'LeaveRequest',
            (int) $leaveRequest->id,
            $leaveRequest->id,
            $status,
        );
    }

    private function loadApprovers(LeaveRequest $leaveRequest, ?ApprovalType $approvalType = null)
    {
        $approvalType ??= $leaveRequest->leavetype?->approvalType;
        if (!$approvalType) {
            return collect();
        }

        $employees = $approvalType->employees()
            ->select('employees.id', 'employees.employee_no', 'employees.first_name', 'employees.last_name', 'employees.designation_id', 'employees.user_id')
            ->with(['designation:id,name', 'media'])
            ->get();

        $decisions = LeaveApproval::where('leave_request_id', $leaveRequest->id)
            ->whereIn('employee_id', $employees->pluck('id'))
            ->get()
            ->keyBy('employee_id');

        if (in_array($leaveRequest->final_status, ['approved', 'rejected'], true)) {
            $employees = $employees->filter(fn ($employee) => $decisions->has($employee->id))->values();
        }

        return $employees->map(function ($employee) use ($decisions) {
            $decision = $decisions->get($employee->id);
            $employee->status = $decision?->status ?? 'pending';
            $employee->approved_at = $decision?->approved_at;
            return $employee;
        });
    }
}
