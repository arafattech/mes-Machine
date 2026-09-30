<?php

namespace App\Http\Controllers;

use App\Models\ApprovalType;
use App\Models\RequisitionApproval;
use App\Models\Store\PurchaseRequisition;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class ApprovalTypeController extends Controller
{
    public function approvers(Request $request, ApprovalType $approvalType)
    {
        $requisitionId = $request->query('requisition_id');
        return response()->json(['data' => $this->loadApprovers($approvalType, $requisitionId)]);
    }

    // Bypasses OData/Lodata entirely — this app's Lodata schema discovery has proven to
    // go stale after a column is added to an already-discovered entity (survives even a
    // config/cache:clear; only a process restart refreshes it), so a plain Eloquent
    // lookup-by-code is more robust than `ApprovalTypes?$filter=code eq '...'` for a
    // simple, frequently-called lookup like this.
    public function approversByCode(Request $request, string $code)
    {
        $approvalType = ApprovalType::where('code', strtoupper($code))->first();
        if (!$approvalType) {
            return response()->json(['data' => []]);
        }

        $requisitionId = $request->query('requisition_id');
        return response()->json(['data' => $this->loadApprovers($approvalType, $requisitionId)]);
    }

    // Marks the current user's linked employee as having approved/rejected a specific
    // requisition — a separate, per-request checklist layered on top of the SR type's
    // assigned-approver roster (`approval_type_has_employees`, which is master-data
    // config, not per-request state). Deliberately resolves the employee server-side
    // from the authenticated user rather than trusting a client-supplied employee_id,
    // and rejects anyone not actually assigned as an SR approver. This does NOT touch
    // SprStatus/the real SR approval flow.
    public function approve(Request $request, $requisitionId)
    {
        return $this->recordDecision($request, $requisitionId, 'approved');
    }

    public function reject(Request $request, $requisitionId)
    {
        return $this->recordDecision($request, $requisitionId, 'rejected');
    }

    private function recordDecision(Request $request, $requisitionId, string $status)
    {
        $employeeId = auth()->user()?->employee?->id;
        if (!$employeeId) {
            return response()->json(['message' => 'No employee linked to the current user'], 403);
        }

        $code = strtoupper($request->input('code', 'SR'));
        $approvalType = ApprovalType::where('code', $code)->first();
        if (!$approvalType) {
            return response()->json(['message' => "No '{$code}' approval type configured"], 404);
        }

        $requisition = PurchaseRequisition::find($requisitionId);
        if (!$requisition) {
            return response()->json(['message' => 'Requisition not found'], 404);
        }
        if (in_array($requisition->status, ['FINAL_APPROVAL', 'REJECTED'], true)) {
            return response()->json(['message' => 'This request has already been finalized — no further action is possible'], 409);
        }

        $isAssignedApprover = $approvalType->employees()->where('employees.id', $employeeId)->exists();
        if (!$isAssignedApprover) {
            return response()->json(['message' => 'You are not an assigned approver for this request'], 403);
        }

        RequisitionApproval::updateOrCreate(
            ['requisition_id' => $requisitionId, 'employee_id' => $employeeId],
            ['status' => $status, 'approved_at' => now()],
        );

        $rows = $this->loadApprovers($approvalType, $requisitionId);
        $this->finalizeRequisitionIfNeeded($requisition, $rows, $status);
        $this->notifyOnDecision($rows, $requisitionId, $status, auth()->id(), $employeeId);

        return response()->json(['data' => $rows, 'requisition_status' => $requisition->status]);
    }

    // Once every REQUIRED approver has approved, the SR is done — locks it (via the
    // model's own SUBMITTED→APPROVED→FINAL_APPROVAL state machine in
    // PurchaseRequisition::booted(), which forbids skipping straight to
    // FINAL_APPROVAL) and stops anyone from approving/rejecting it further (see the
    // guard at the top of recordDecision()). Optional (non-required) approvers never
    // block completion. A single rejection immediately closes the request as REJECTED
    // — the chain halts there regardless of how many other approvers are pending.
    private function finalizeRequisitionIfNeeded(PurchaseRequisition $requisition, $rows, string $decisionStatus): void
    {
        if ($decisionStatus === 'rejected') {
            if (in_array($requisition->status, ['SUBMITTED', 'APPROVED'], true)) {
                $requisition->status = 'REJECTED';
                $requisition->save();
            }
            return;
        }

        $allRequiredApproved = collect($rows)
            ->filter(fn ($row) => $row->pivot->is_required)
            ->every(fn ($row) => $row->status === 'approved');

        if (!$allRequiredApproved) {
            return;
        }

        if ($requisition->status === 'SUBMITTED') {
            $requisition->status = 'APPROVED';
            $requisition->approved_by = auth()->id();
            $requisition->approved_at = now();
            $requisition->save();
        }

        if ($requisition->status === 'APPROVED') {
            $requisition->status = 'FINAL_APPROVAL';
            $requisition->final_approved_by = auth()->id();
            $requisition->final_approved_at = now();
            $requisition->save();
        }
    }

    // Separate from SprStatus/the observer-driven "everyone with STORE_SR_APPROVE
    // permission" broadcast (PurchaseRequisitionObserver + NotificationService::dispatch)
    // — this targets the two people who actually care about THIS specific per-person
    // chain step: the original requester (told the outcome), and, once a step is
    // approved, whichever employee is now the next current step (told it's their turn).
    // A rejection halts the chain, so there's no "next" to notify in that case.
    private function notifyOnDecision(\Illuminate\Support\Collection $rows, $requisitionId, string $status, ?int $actingUserId, $actingEmployeeId = null): void
    {
        $requisition = PurchaseRequisition::find($requisitionId);
        if (!$requisition) {
            return;
        }

        $notificationService = new NotificationService();
        $customId = $requisition->custom_id ?? $requisition->id;

        // Embedded directly in the message text rather than relying on `sender_id`
        // resolution elsewhere — guarantees the actual approver's name shows up here
        // regardless of how any other notification path resolves (or fails to resolve)
        // the acting user.
        $actingEmployee = collect($rows)->firstWhere('id', $actingEmployeeId);
        $actorName = $actingEmployee
            ? trim("{$actingEmployee->first_name} {$actingEmployee->last_name}")
            : 'An approver';

        if ($requisition->requested_by) {
            $title = $status === 'approved'
                ? "SR #{$customId} Approved by {$actorName}"
                : "SR #{$customId} Rejected by {$actorName}";
            $message = $status === 'approved'
                ? "{$actorName} has approved SR #{$customId}."
                : "{$actorName} has rejected SR #{$customId}.";

            $notificationService->dispatchToSpecific(
                [$requisition->requested_by],
                $title,
                $message,
                $actingUserId,
                'PurchaseRequisition',
                (int) $requisitionId,
                $customId,
                $status,
            );
        }

        if ($status !== 'approved' || in_array($requisition->status, ['FINAL_APPROVAL', 'APPROVED'], true)) {
            // Already fully resolved (or one step away, awaiting the SR's own
            // final-approval stage rather than another chain approver) — no
            // "your turn" notice needed.
            return;
        }

        $sorted = collect($rows)->sortBy(fn ($row) => $row->pivot->sequence_index ?? 0)->values();
        $nextStep = $sorted->firstWhere('status', 'pending');
        if (!$nextStep || !$nextStep->user_id) {
            return;
        }

        $notificationService->dispatchToSpecific(
            [$nextStep->user_id],
            "Your Approval Needed — SR #{$customId}",
            "{$actorName} approved SR #{$customId} — it's now awaiting your approval.",
            $actingUserId,
            'PurchaseRequisition',
            (int) $requisitionId,
            $customId,
            'pending_approval',
        );
    }

    // Batch progress lookup for a list of requisitions (e.g. an SR list grid) — avoids
    // an N+1 of per-row `approvers` calls. Returns the fixed total (how many employees
    // are assigned as SR approvers, same for every row), plus per-requisition approved
    // and rejected counts.
    public function progressByCode(Request $request, string $code)
    {
        $approvalType = ApprovalType::where('code', strtoupper($code))->first();
        if (!$approvalType) {
            return response()->json(['total' => [], 'approved' => [], 'rejected' => []]);
        }

        $employeeIds = $approvalType->employees()->pluck('employees.id');
        $liveTotal = $employeeIds->count();

        $requisitionIds = collect(explode(',', (string) $request->query('ids', '')))
            ->map(fn ($id) => (int) trim($id))
            ->filter();

        $counts = RequisitionApproval::whereIn('requisition_id', $requisitionIds)
            ->whereIn('employee_id', $employeeIds)
            ->selectRaw('requisition_id, status, count(*) as decision_count')
            ->groupBy('requisition_id', 'status')
            ->get();

        $approved = $counts->where('status', 'approved')->pluck('decision_count', 'requisition_id');
        $rejected = $counts->where('status', 'rejected')->pluck('decision_count', 'requisition_id');

        // A requisition already finalized (approved/rejected) keeps the approver count it
        // was actually decided against as its `total` — so approvers added to the type
        // afterwards don't reopen it (it must keep showing fully-approved, not gain new
        // pending slots for people who never had a chance to act on it).
        $finalizedIds = PurchaseRequisition::whereIn('id', $requisitionIds)
            ->whereIn('status', ['FINAL_APPROVAL', 'REJECTED'])
            ->pluck('id');

        $decidedCounts = RequisitionApproval::whereIn('requisition_id', $finalizedIds)
            ->whereIn('employee_id', $employeeIds)
            ->selectRaw('requisition_id, count(*) as decided_count')
            ->groupBy('requisition_id')
            ->pluck('decided_count', 'requisition_id');

        $total = $requisitionIds->mapWithKeys(function ($id) use ($finalizedIds, $decidedCounts, $liveTotal) {
            $value = $finalizedIds->contains($id) ? ($decidedCounts[$id] ?? $liveTotal) : $liveTotal;
            return [$id => $value];
        });

        return response()->json(['total' => $total, 'approved' => $approved, 'rejected' => $rejected]);
    }

    private function loadApprovers(ApprovalType $approvalType, $requisitionId = null)
    {
        $employees = $approvalType->employees()
            ->select('employees.id', 'employees.employee_no', 'employees.first_name', 'employees.last_name', 'employees.designation_id', 'employees.user_id')
            ->with(['designation:id,name', 'media'])
            ->get();

        if (!$requisitionId) {
            return $employees;
        }

        $decisions = RequisitionApproval::where('requisition_id', $requisitionId)
            ->whereIn('employee_id', $employees->pluck('id'))
            ->get()
            ->keyBy('employee_id');

        // Already-finalized requisitions must not surface approvers added to the type
        // afterwards — they never had a chance to act, and the requisition is done.
        $requisition = PurchaseRequisition::find($requisitionId);
        if ($requisition && in_array($requisition->status, ['FINAL_APPROVAL', 'REJECTED'], true)) {
            $employees = $employees->filter(fn ($employee) => $decisions->has($employee->id))->values();
        }

        return $employees->map(function ($employee) use ($decisions) {
            $decision = $decisions->get($employee->id);
            $employee->status = $decision?->status ?? 'pending';
            $employee->approved_at = $decision?->approved_at;
            return $employee;
        });
    }

    public function associate(Request $request)
    {
        $validated = $request->validate([
            'approval_type_id' => 'required|exists:approval_types,id',
            'employees' => 'array',
            'employees.*.employee_id' => 'required|exists:employees,id',
            'employees.*.is_required' => 'boolean',
            'employees.*.sequence_index' => 'integer|min:1',
        ]);

        $approvalType = ApprovalType::findOrFail($validated['approval_type_id']);

        $syncData = collect($validated['employees'] ?? [])->mapWithKeys(fn ($row) => [
            $row['employee_id'] => [
                'is_required' => $row['is_required'] ?? true,
                'sequence_index' => $row['sequence_index'] ?? 1,
            ],
        ])->all();

        $approvalType->employees()->sync($syncData);

        return response()->json(['message' => 'Approvers updated successfully']);
    }
}
