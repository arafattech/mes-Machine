<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;
use App\Models\Payroll;


class PDFController extends Controller
{
    public function generatePDF(Request $request)
    {
        $validated = $request->validate([
            'payroll_id' => 'nullable|integer',
            'template' => 'required|string',
        ]);

        try {
            $payrollId = $validated['payroll_id'] ?? null;
            $template = $validated['template'];

            $payroll = Payroll::with('employee.department')->find($payrollId);
            if (!$payroll) {
                return response()->json(['error' => 'Payroll not found'], 404);
            }

            $employee = $payroll->employee;

            if (!$employee) {
                return response()->json(['error' => 'Employee not found'], 404);
            }

            $department = $employee->getRelation('department')->toArray();
            $data = [
                'employee_name' => ($employee->first_name ?? '') . ' ' . ($employee->last_name ?? ''),
                'employee_id' => $employee->employee_no ?? 'N/A',
                'basic_salary' => $payroll->basic_salary ?? 0,
                'overtime' => $payroll->overtime_bonus ?? $payroll->overtime ?? 0,
                'overtime_bonus' => $payroll->overtime_bonus ?? $payroll->overtime ?? 0,
                'bonus' => $payroll->bonuses ?? 0,
                'other_deductions' => $payroll->other_deductions ?? 0,
                'tax' => $payroll->tax ?? 0,
                'total_deductions' => $payroll->total_deductions ?? 0,
                'gross_salary' => $payroll->gross_salary ?? 0,
                'net_salary' => max(0, $payroll->net_salary ?? 0),
                'payment_status' => $payroll->status ?? 'Pending',
                'payment_method' => $payroll->payment_method ?? 'N/A',
                'process_date' => $payroll->created_at ? \Carbon\Carbon::parse($payroll->created_at)->format('d-m-Y') : now()->format('d-m-Y'),
                'pay_period' => ($payroll->month ?? 'N/A') . '/' . ($payroll->year ?? 'N/A'),
                'designation' => $employee->designation ?? 'N/A',
                'department' => $department['name'] ?? 'N/A',
                'allowances' => $payroll->allowances ?? 0,
                'nightshift_bonus' => $payroll->nightshift_bonus ?? 0,
                'attendance_bonus' => $payroll->attendance_bonus ?? 0,
                'side_bill' => $payroll->side_bill ?? 0,
                'total_attendance' => $payroll->total_attendance ?? 0
            ];

            $viewPath = "pdf-templates.{$template}";
            if (!view()->exists($viewPath)) {
                return response()->json(['error' => "Template not found: {$template}"], 404);
            }

            try {
                $pdf = Pdf::loadView($viewPath, ['data' => $data])->setPaper('A4', 'portrait');
            } catch (\Exception $e) {
                Log::error("DomPDF generation failed: " . $e->getMessage());
                return response()->json(['error' => 'Failed to generate PDF: ' . $e->getMessage()], 500);
            }

            $filename = "Payroll_Slip_{$employee->first_name}_{$payroll->processed_at->format('Y-m-d')}.pdf";

            return response($pdf->output(), 200)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');

        } catch (\Exception $e) {
            Log::error("PDF generation failed: " . $e->getMessage() . "\n" . $e->getTraceAsString());
            return response()->json(['error' => 'Failed to generate PDF: ' . $e->getMessage()], 500);
        }
    }

}
