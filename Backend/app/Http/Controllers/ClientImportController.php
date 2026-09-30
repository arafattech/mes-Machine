<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Imports\ClientsImport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Validation\ValidationException;

class ClientImportController extends Controller
{
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv',
        ]);

        try {
            Excel::import(new ClientsImport, $request->file('file'));

            return response()->json([
                'status' => true,
                'message' => 'Clients imported successfully.',
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
                'message' => 'Failed to import clients. Error: ' . $e->getMessage(),
            ], 500);
        }
    }
}
