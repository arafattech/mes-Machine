<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Exports\SuppliersExport;
use Maatwebsite\Excel\Facades\Excel;

class SupplierExportController extends Controller
{
    public function export()
    {
        return Excel::download(new SuppliersExport, 'suppliers.xlsx');
    }
}

