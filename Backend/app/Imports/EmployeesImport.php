<?php

namespace App\Imports;

use App\Models\Employee;
use App\Models\Department;
use App\Models\EmployeeSalary;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class EmployeesImport implements ToModel, WithHeadingRow
{
    /**
     * @param array $row
     * @return \Illuminate\Database\Eloquent\Model|null
     */
    public function model(array $row)
    {
        // ---------------- VALIDATION ----------------
        if (!empty($row['email']) && Employee::where('email', $row['email'])->exists()) {
            throw ValidationException::withMessages([
                'email' => 'Email Already Exists: ' . $row['email'],
            ]);
        }

        $firstName = trim((string) ($row['first_name'] ?? ''));
        if (empty($firstName)) {
            return null;
        }

        // ---------------- DEPARTMENT ----------------
        $department_id = null;
        $department_name = null;

        if (!empty($row['department'])) {
            $department = Department::firstOrCreate(
                ['name' => trim($row['department'])],
                ['is_active' => true]
            );

            $department_id = $department->id;
            $department_name = $department->name;
        }

        // ---------------- FIND EMPLOYEE ----------------
        $employee = null;
        if (!empty($row['employee_id'])) {
            $employee = Employee::where('employee_no', $row['employee_id'])->first();
        }

        $data = [
            'is_active' => true,
            'first_name' => $firstName,
            'last_name' => $row['last_name'] ?? null,
            'gender' => $row['gender'] ?? null,
            'nid' => $row['nid'] ?? null,
            'religion' => $row['religion'] ?? null,
            'present_address' => $row['present_address'] ?? null,
            'permanent_address' => $row['permanent_address'] ?? null,
            'emgerency_contact_person_name' => $row['emgerency_contact_person_name'] ?? null,
            'emgerency_contact_number' => $row['emgerency_contact_number'] ?? null,
            'emgerency_contact_relation' => $row['emgerency_contact_relation'] ?? null,
            'supervisor_name' => $row['supervisor_name'] ?? null,
            'date_of_birth' => $this->transformDate($row['date_of_birth']),
            'blood_group' => $row['blood_group'] ?? null,
            'marital_status' => $row['marital_status'] ?? null,
            'joining_date' => $this->transformDate($row['joining_date']),
            'contact_number' => $row['contact_number'] ?? null,
            'email' => $row['email'] ?? null,
            'employee_no' => $row['employee_id'] ?? null,
            'refered_by' => $row['refered_by'] ?? null,
            'department' => $department_name,
            'department_id' => $department_id,
            'designation' => $row['designation'] ?? null,
            'section' => $row['section'] ?? null,
            'employee_type' => $row['employee_type'] ?? null,
            'employee_shift' => $row['employee_shift'] ?? null,
        ];

        // ---------------- SAVE EMPLOYEE + SALARY ----------------
        DB::transaction(function () use ($employee, $data, $row) {

            // Create or Update Employee
            if ($employee) {
                $employee->update($data);
            } else {
                $employee = Employee::create($data);
            }
            // Skip if total_salary is empty
            if (empty($row['total_salary'])) {
                return;
            }

            $totalSalary = (float) $row['total_salary'];
            $basic = $totalSalary * 0.5;
            $houseRent = $totalSalary * 0.3;
            $medicalAllowance = 750;
            $transportAllowance = 400;

            $otherAllowance =
                $totalSalary
                - $basic
                - $houseRent
                - $medicalAllowance
                - $transportAllowance;

            EmployeeSalary::updateOrCreate(
                ['employee_id' => $employee->id],
                [
                    'total_salary' => $totalSalary,
                    'basic' => $basic,
                    'house_rent' => $houseRent,
                    'medical_allowance' => $medicalAllowance,
                    'transport_allowance' => $transportAllowance,
                    'other_allowance' => $otherAllowance,
                ]
            );
        });

        return null;
    }

    private function transformDate($value)
    {
        if (empty($value)) {
            return null;
        }

        if (is_numeric($value)) {
            return Date::excelToDateTimeObject($value)->format('Y-m-d');
        }

        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Exception $e) {
            return null;
        }
    }
}
