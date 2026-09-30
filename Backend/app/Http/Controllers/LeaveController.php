<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use App\Services\hrModule\LeaveService;
use Illuminate\Http\Request;
use Carbon\Carbon;

class LeaveController extends Controller
{
    private $leaveService;

    public function __construct(LeaveService $leaveService)
    {
        $this->leaveService = $leaveService;
    }

    public function getLeaveRequest(Request $request)
    {
        $request->validate([
            'leave_id' => 'required|integer|exists:leave_requests,id',
        ]);

        $leaveRequest = LeaveRequest::with(['leaveDates'])
            ->find($request->leave_id);

        if (!$leaveRequest) {
            return response()->json([
                'error' => true,
                'message' => 'Leave request not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => $leaveRequest
        ]);
    }

    public function storeLeaveRequest(Request $request)
    {
        return $this->leaveService->store($request);
    }

    public function updateLeaveRequest(Request $request, $id)
    {
        return $this->leaveService->update($request, $id);
    }

    public function getEmployeeLeaveSummary(Request $request)
    {
        return $this->leaveService->summary($request);
    }


    public function getTakenLeaveDates(Request $request)
    {
        $request->validate(['employee_id' => 'required|exists:employees,id']);

        $year = $request->input('year', date('Y'));

        $leaves = LeaveRequest::with(['leaveDates' => function($query) use ($year) {
                $query->whereYear('leave_date', $year);
            }])
            ->where('employee_id', $request->employee_id)
            ->where('final_status', 'approved')
            ->whereHas('leaveDates', function($query) use ($year) {
                $query->whereYear('leave_date', $year);
            })
            ->get();

        $takenByType = [];

        foreach ($leaves as $leave) {
            $typeId = $leave->leave_type_id;
            if (!isset($takenByType[$typeId])) {
                $takenByType[$typeId] = [];
            }
            foreach ($leave->leaveDates as $date) {
                $takenByType[$typeId][] = Carbon::parse($date->leave_date)->format('Y-m-d');
            }
        }

        return response()->json($takenByType);
    }
    public function countTakenLeavesInRange(Request $request)
    {
        $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'start_date'  => 'required|date',
            'end_date'    => 'required|date|after_or_equal:start_date',
        ]);

        $employeeId = $request->employee_id;
        $startDate  = Carbon::parse($request->start_date)->format('Y-m-d');
        $endDate    = Carbon::parse($request->end_date)->format('Y-m-d');
        $leaveRequests = LeaveRequest::with(['leaveDates', 'leaveType'])
            ->where('employee_id', $employeeId)
            ->where('final_status', 'approved')
            ->whereHas('leaveDates', function ($query) use ($startDate, $endDate) {
                $query->whereBetween('leave_date', [$startDate, $endDate]);
            })
            ->with(['leaveDates' => function ($query) use ($startDate, $endDate) {
                $query->whereBetween('leave_date', [$startDate, $endDate]);
            }])
            ->get();

        $totalCount = 0;
        $takenDates = [];
        $typeCount = [];

        foreach ($leaveRequests as $leave) {
            $typeId = $leave->leave_type_id;
            $typeName = $leave->leaveType->name ?? 'Unknown';

            if (!isset($typeCount[$typeId])) {
                $typeCount[$typeId] = [
                    'leave_type_id' => $typeId,
                    'leave_type_name' => $typeName,
                    'count' => 0
                ];
            }

            foreach ($leave->leaveDates as $date) {
                $totalCount++;
                $takenDates[] = Carbon::parse($date->leave_date)->format('Y-m-d');

                $typeCount[$typeId]['count']++;
            }
        }

        return response()->json([
            'success' => true,
            'employee_id' => $employeeId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'total_taken_leaves' => $totalCount,
            'dates' => $takenDates,
            'leave_count_by_type' => array_values($typeCount),
        ]);
    }
}
