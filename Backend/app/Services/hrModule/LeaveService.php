<?php

namespace App\Services\hrModule;

use App\Models\LeaveRequest;
use App\Models\LeaveDate;
use App\Models\LeaveType;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class LeaveService
{
    public function store($request)
    {
        try {

            $validator = Validator::make($request->all(), [
                'employee_id'   => 'required|integer|exists:employees,id',
                'leave_type_id' => 'required|integer|exists:leave_types,id',
                'dates'         => 'required|array|min:1',
                'dates.*'       => 'required|date_format:Y-m-d',
                'reason'        => 'required|string|min:3',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $employeeId  = $request->employee_id;
            $leaveTypeId = $request->leave_type_id;
            $dates       = array_unique($request->dates);
            $reason      = $request->reason;
            $year        = Carbon::parse($dates[0])->year;

            $overlap = LeaveDate::join('leave_requests', 'leave_dates.leave_id', '=', 'leave_requests.id')
                ->where('leave_dates.employee_id', $employeeId)
                ->whereIn('leave_requests.final_status', ['approved', 'pending'])
                ->where('leave_requests.supervisor_status', '!=', 'rejected')
                ->whereIn('leave_dates.leave_date', $dates)
                ->count();

            if ($overlap > 0) {
                return response()->json([
                    'error'   => true,
                    'message' => "You have already applied leave for selected dates (approved or pending)."
                ], 409);
            }

            $leaveType = LeaveType::find($leaveTypeId);

            if ($leaveType && $leaveType->max_days) {
                $taken = LeaveDate::join('leave_requests', 'leave_dates.leave_id', '=', 'leave_requests.id')
                    ->where('leave_dates.employee_id', $employeeId)
                    ->where('leave_requests.leave_type_id', $leaveTypeId)
                    ->where('leave_requests.final_status', 'approved')
                    ->whereYear('leave_dates.leave_date', $year)
                    ->count();

                $remaining = $leaveType->max_days - $taken;

                if (count($dates) > $remaining) {
                    return response()->json([
                        'error'   => true,
                        'message' => "Limit Reached: You only have {$remaining} {$leaveType->name} leave days left for {$year}."
                    ], 403);
                }
            }

            $employee     = Employee::find($employeeId);
            $supervisorId = $employee?->supervisor_id;

            $isSelfOrNoSupervisor = ($supervisorId && $supervisorId === $employeeId) || is_null($supervisorId);
            $supervisorStatus     = $isSelfOrNoSupervisor ? 'approved' : 'pending';
            $supervisorRemarks    = $isSelfOrNoSupervisor ? 'Auto-approved' : null;
            $supervisorActionAt   = $isSelfOrNoSupervisor ? now() : null;

            // Mirrors LeaveRequestObserver::created() — kept in sync so the
            // real-time toast only ever reaches whoever was actually notified.
            $recipientUserIds = $isSelfOrNoSupervisor
                ? User::permission('HR_LEAVE_REQUEST_APPROVE')->pluck('id')->toArray()
                : array_values(array_filter([Employee::find($supervisorId)?->user_id]));

            $createdBy = auth()->id();

            $leaveRequest = DB::transaction(function () use ($employeeId, $leaveTypeId, $dates, $reason, $supervisorId, $supervisorStatus, $supervisorRemarks, $supervisorActionAt, $createdBy) {

                $leaveRequest = LeaveRequest::create([
                    'employee_id'           => $employeeId,
                    'leave_type_id'         => $leaveTypeId,
                    'start_date'            => min($dates),
                    'end_date'              => max($dates),
                    'reason'                => $reason,
                    'supervisor_id'         => $supervisorId,
                    'supervisor_status'     => $supervisorStatus,
                    'supervisor_remarks'    => $supervisorRemarks,
                    'supervisor_action_at'  => $supervisorActionAt,
                    'hr_status'             => 'pending',
                    'final_status'          => 'pending',
                    'is_active'             => true,
                    'created_by'            => $createdBy,
                ]);

                foreach ($dates as $date) {
                    LeaveDate::create([
                        'employee_id' => $employeeId,
                        'leave_id'    => $leaveRequest->id,
                        'leave_date'  => $date,
                        'status'      => 'PENDING',
                        'type'        => 'LEAVE',
                    ]);
                }

                return $leaveRequest;
            });

            return response()->json([
                'success'            => true,
                'message'            => 'Leave request submitted successfully!',
                'id'                 => $leaveRequest->id,
                'recipient_user_ids' => $recipientUserIds,
            ], 201);

        } catch (\Exception $e) {

            return response()->json([
                'error'   => true,
                'message' => $e->getMessage(),
                'line'    => $e->getLine(),
                'file'    => $e->getFile(),
            ], 500);
        }
    }

    public function update($request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'leave_type_id' => 'required|integer|exists:leave_types,id',
                'dates'         => 'required|array|min:1',
                'dates.*'       => 'required|date_format:Y-m-d',
                'reason'        => 'required|string|min:3',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $leaveRequest = LeaveRequest::findOrFail($id);
            $dates = array_unique($request->dates);
            $leaveTypeId = $request->leave_type_id;

            $overlap = LeaveDate::join('leave_requests', 'leave_dates.leave_id', '=', 'leave_requests.id')
                ->where('leave_dates.employee_id', $leaveRequest->employee_id)
                ->where('leave_dates.leave_id', '!=', $id)
                ->whereIn('leave_requests.final_status', ['approved', 'pending'])
                ->whereIn('leave_dates.leave_date', $dates)
                ->count();

            if ($overlap > 0) {
                return response()->json([
                    'error'   => true,
                    'message' => "Selected dates conflict with another existing leave request."
                ], 409);
            }

            DB::transaction(function () use ($leaveRequest, $dates, $request, $leaveTypeId) {

                $leaveRequest->update([
                    'leave_type_id' => $leaveTypeId,
                    'reason'        => $request->reason,
                    'start_date'    => min($dates),
                    'end_date'      => max($dates),
                    'supervisor_status' => 'pending',
                    'final_status'      => 'pending'
                ]);

                LeaveDate::where('leave_id', $leaveRequest->id)->delete();

                foreach ($dates as $date) {
                    LeaveDate::create([
                        'employee_id' => $leaveRequest->employee_id,
                        'leave_id'    => $leaveRequest->id,
                        'leave_date'  => $date,
                        'status'      => 'PENDING',
                        'type'        => 'LEAVE',
                    ]);
                }
            });

            return response()->json([
                'success' => true,
                'message' => 'Leave request updated successfully!'
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'error'   => true,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function summary($request)
    {
        $year = $request->input('year', date('Y'));

        $leaves = LeaveRequest::with(['leaveDates' => function($query) use ($year) {
                $query->whereYear('leave_date', $year);
            }, 'leavetype'])
            ->where('employee_id', $request->employee_id)
            ->where('final_status', 'approved')
            ->get();

        $summary = [];

        foreach ($leaves as $leave) {
            $typeName = $leave->leavetype->name ?? 'Unknown';
            $count = count($leave->leaveDates);
            $summary[$typeName] = ($summary[$typeName] ?? 0) + $count;
        }

        return response()->json([
            'success' => true,
            'year'    => $year,
            'summary' => $summary,
            'total'   => array_sum($summary)
        ]);
    }
}
