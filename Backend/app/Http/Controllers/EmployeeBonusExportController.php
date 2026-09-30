<?php

namespace App\Http\Controllers;

use App\Exports\EmployeeBonusesExport;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class EmployeeBonusExportController extends Controller
{
    public function export(Request $request)
    {
        $filters = $request->only(['emp_id', 'from', 'to', 'bonus_type']);
        $filename = 'employee-bonuses';

        if (!empty($filters['from']) && !empty($filters['to'])) {
            $filename .= '-' . $filters['from'] . '-to-' . $filters['to'];
        }

        return Excel::download(new EmployeeBonusesExport($filters), $filename . '.xlsx');
    }
}
