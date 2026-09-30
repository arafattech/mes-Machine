<?php

namespace App\Http\Controllers;

use App\Models\EmployeeWeekend;
use App\Models\Holiday;
use App\Models\LeaveDate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeHolidayController extends Controller
{

    public function index(Request $request)
    {
        $isIndustrial = $request->boolean('is_industrial');

        $request->validate([
            'employee_id' => $isIndustrial ? 'nullable' : 'required|exists:employees,id',
            'year'        => 'nullable|integer',
            'month'       => 'nullable|string',
        ]);

        $query = EmployeeWeekend::query();

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }

        if ($isIndustrial) {
            $query->where('is_industrial', true);
        }

        if ($request->filled('year')) {
            $query->whereYear('weekend_date', $request->year);
        }

        if ($request->filled('month')) {
            $monthMap = [
                'JANUARY' => 1, 'FEBRUARY' => 2, 'MARCH' => 3,
                'APRIL'   => 4, 'MAY'      => 5, 'JUNE'  => 6,
                'JULY'    => 7, 'AUGUST'   => 8, 'SEPTEMBER' => 9,
                'OCTOBER' => 10, 'NOVEMBER' => 11, 'DECEMBER' => 12,
            ];
            $month = $monthMap[$request->month] ?? null;
            if ($month) $query->whereMonth('weekend_date', $month);
        }

        $weekends = $query->orderBy('weekend_date')->distinct()->get(['weekend_date', 'type', 'type_id', 'bonus_mode', 'bonus_amount', 'is_industrial']);

        return response()->json($weekends);
    }


    public function store(Request $request)
    {
        $employeeId = $request->input('employee_id');
        $weekends = $request->input('data', []);
        $type = $request->input('type', 'WEEKEND');
        $leaveId = $request->input('leave_id', null);


        if (empty($employeeId)) {
            return response()->json([
                'success' => false,
                'message' => 'Employee ID is required.'
            ], 422);
        }

        if ($type === 'LEAVE') {
            foreach ($weekends as $leave) {

                $exists = LeaveDate::where('employee_id', $employeeId)
                    ->where('leave_date', $leave)
                    ->where('leave_id', $leaveId)
                    ->exists();

                if ($exists) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Leave day ' . $leave . ' already exists for this employee.'
                    ], 200);
                }

                LeaveDate::create([
                    'employee_id'   => $employeeId,
                    'leave_date'  => $leave,
                    'type'          => 'LEAVE',
                    'status'        => 'APPROVED',
                    'leave_id'      => $leaveId ?? null,
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Leave days saved (duplicates skipped).',
            ]);
        } else {
            if ($request->boolean('sync')) {
                $year = !empty($weekends)
                    ? date('Y', strtotime($weekends[0]['start_date']))
                    : (int) $request->input('year', date('Y'));

                try {
                    DB::transaction(function () use ($employeeId, $year, $weekends) {
                        EmployeeWeekend::where('employee_id', $employeeId)
                            ->whereYear('weekend_date', $year)
                            ->where('type', '!=', 'LEAVE')
                            ->delete();

                        foreach ($weekends as $weekend) {
                            $type = $weekend['type'] ?? 'WEEKEND';
                            if ($type === 'LEAVE') continue;
                            $typeId = $weekend['type_id'] ?? null;
                            EmployeeWeekend::updateOrCreate(
                                [
                                    'employee_id'  => $employeeId,
                                    'weekend_date' => $weekend['start_date'],
                                    'type'         => $type,
                                ],
                                [
                                    'status'       => $weekend['status'] ?? 'APPROVED',
                                    'type_id'      => $typeId ?: null,
                                    'bonus_mode'   => $weekend['bonus_mode'] ?? null,
                                    'bonus_amount' => $weekend['bonus_amount'] ?? null,
                                ]
                            );
                        }
                    });
                } catch (\Throwable $e) {
                    report($e);
                    return response()->json([
                        'success' => false,
                        'message' => 'Failed to sync employee weekends.',
                    ], 500);
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Employee weekends synced successfully.',
                ]);
            }

            if (empty($weekends)) {
                return response()->json([
                    'success' => true,
                    'message' => 'No data provided.',
                ]);
            }

            // Scoped delete (Industrial mode): only touch types present in payload
            $year = date('Y', strtotime($weekends[0]['start_date']));
            $payloadTypes = collect($weekends)->pluck('type')->filter()->unique()->values()->toArray();
            $payloadDates = collect($weekends)->pluck('start_date')->toArray();

            try {
                DB::transaction(function () use ($employeeId, $year, $payloadTypes, $payloadDates, $weekends) {
                    EmployeeWeekend::where('employee_id', $employeeId)
                        ->whereYear('weekend_date', $year)
                        ->when(!empty($payloadTypes), fn($q) => $q->whereIn('type', $payloadTypes))
                        ->whereNotIn('weekend_date', $payloadDates)
                        ->delete();

                    foreach ($weekends as $weekend) {
                        $typeId = $weekend['type_id'] ?? null;
                        EmployeeWeekend::updateOrCreate(
                            [
                                'employee_id'  => $employeeId,
                                'weekend_date' => $weekend['start_date'],
                                'type'         => $weekend['type'] ?? 'WEEKEND',
                            ],
                            [
                                'status'       => $weekend['status'] ?? 'APPROVED',
                                'type_id'      => $typeId ?: null,
                                'bonus_mode'   => $weekend['bonus_mode'] ?? null,
                                'bonus_amount' => $weekend['bonus_amount'] ?? null,
                            ]
                        );
                    }
                });
            } catch (\Throwable $e) {
                report($e);
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to sync employee weekends.',
                ], 500);
            }

            return response()->json([
                'success' => true,
                'message' => 'Employee weekends synced successfully.',
            ]);
        }
    }


    public function getHoliday(Request $request)
    {
        $year = $request->query('year', date('Y'));

        $holidays = Holiday::where('year', $year)->get();

        return response()->json($holidays);
    }

    public function saveHoliday(Request $request)
    {
        $request->validate([
            'year' => 'required|integer',
            'offDays' => 'nullable|array',
            'offDays.*.start_date' => 'required|date',
            'offDays.*.end_date'   => 'required|date',
            'offDays.*.type_id'    => 'required|integer',
            'offDays.*.title'      => 'required|string|max:255',
        ]);

        $year = $request->year;

        Holiday::where('year', $year)->delete();

        foreach ($request->offDays as $data) {
            Holiday::create([
                'year'       => $year,
                'start_date' => $data['start_date'],
                'end_date'   => $data['end_date'],
                'type_id'    => $data['type_id'],
                'title'      => $data['title'],
            ]);
        }

        return response()->json(['message' => 'Holidays saved successfully']);
    }
}
