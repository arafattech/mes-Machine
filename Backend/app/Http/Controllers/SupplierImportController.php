<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Imports\SuppliersImport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Validation\ValidationException;

class SupplierImportController extends Controller
{
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv',
        ]);

        try {
            Excel::import(new SuppliersImport, $request->file('file'));

            return response()->json([
                'status' => true,
                'message' => 'Suppliers imported successfully.',
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
                'message' => 'Failed to import suppliers. Error: ' . $e->getMessage(),
            ], 500);
        }
    }
}
