<?php

namespace App\Http\Controllers;

use App\Exports\AttendanceExport;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class AttendanceExportController extends Controller
{
    public function export(Request $request)
    {
        $filters = $request->only(['from', 'to', 'employee_type_id']);
        $parts   = [];

        if (!empty($filters['from']) && !empty($filters['to'])) {
            $parts[] = $filters['from'] . '-to-' . $filters['to'];
        }

        if (!empty($request->employee_type_name)) {
            $parts[] = Str::slug($request->employee_type_name, '_');
        }

        $parts[]  = 'attendance';
        $filename = implode('_', $parts);

        return Excel::download(new AttendanceExport($filters), $filename . '.xlsx');
    }
}
