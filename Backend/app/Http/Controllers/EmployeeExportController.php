<?php

namespace App\Http\Controllers;

use App\Exports\EmployeesExport;
use App\Exports\ItemExport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Http\Request;

class EmployeeExportController extends Controller
{
    public function export(Request $request)
    {
        $filters = $request->only(['gender', 'department']);

        return Excel::download(new EmployeesExport($filters), 'employees.xlsx');
    }

    public function Itemexport(Request $request)
    {
        return Excel::download(new ItemExport(), 'items.xlsx');
    }
}
