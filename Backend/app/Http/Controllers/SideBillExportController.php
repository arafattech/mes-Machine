<?php

namespace App\Http\Controllers;

use App\Exports\SideBillsExport;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class SideBillExportController extends Controller
{
    public function export(Request $request)
    {
        $filters = $request->only(['employee_id', 'from', 'to']);
        $filename = 'side-bills';

        if (!empty($filters['from']) && !empty($filters['to'])) {
            $filename .= '-' . $filters['from'] . '-to-' . $filters['to'];
        }

        return Excel::download(new SideBillsExport($filters), $filename . '.xlsx');
    }
}
