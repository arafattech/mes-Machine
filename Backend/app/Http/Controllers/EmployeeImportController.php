<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Imports\EmployeesImport;
use App\Imports\ItemImport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Validation\ValidationException;

class EmployeeImportController extends Controller
{
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv,text/csv',
        ]);
        try {
            Excel::import(new EmployeesImport, $request->file('file'));

            return response()->json([
                'status' => true,
                'message' => 'Employees imported successfully.',
            ]);
        } catch (ValidationException $e) {
        return response()->json([
            'status' => false,
            'message' => $e->getMessage(),
            'errors' => $e->errors(),
        ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => $e->getMessage(),
        ], 500);
        }
    }

    public function itemImport(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv,text/csv',
        ]);
        try {
            Excel::import(new ItemImport, $request->file('file'));

            return response()->json([
                'status' => true,
                'message' => 'Items imported successfully.',
            ]);
        } catch (ValidationException $e) {
        return response()->json([
            'status' => false,
            'message' => $e->getMessage(),
            'errors' => $e->errors(),
        ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => $e->getMessage(),
        ], 500);
        }
    }
}
