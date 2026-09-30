<?php

namespace App\Exports;

use App\Models\Employee;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Illuminate\Support\Collection;

// Headers match the employee_import.xlsx template exactly (same names, same order,
// including its quirks — "total _salary"/"employee _shift" space typos, and
// "employee_id" as the header for the employees.employee_no column) so an exported
// file can be re-imported without editing headers.
class EmployeesExport implements FromCollection, WithHeadings, WithMapping
{
    protected $filters;

    public function __construct($filters = [])
    {
        $this->filters = $filters;
    }

    public function collection()
    {
        $query = Employee::query()->with('salary');

        if (!empty($this->filters['gender'])) {
            $query->where('gender', $this->filters['gender']);
        }

        if (!empty($this->filters['department'])) {
            $query->where('department', $this->filters['department']);
        }

        return $query->get();
    }

    public function headings(): array
    {
        return [
            'is_active',
            'first_name',
            'last_name',
            'employee_id',
            'employee_type',
            'designation',
            'department',
            'section',
            'gender',
            'nid',
            'religion',
            'present_address',
            'permanent_address',
            'emgerency_contact_person_name',
            'emgerency_contact_number',
            'emgerency_contact_relation',
            'supervisor_name',
            'date_of_birth',
            'blood_group',
            'marital_status',
            'joining_date',
            'contact_number',
            'email',
            'refered_by',
            'total _salary',
            'employee _shift',
            'joining_month',
        ];
    }

    public function map($employee): array
    {
        return [
            $employee->is_active,
            $employee->first_name,
            $employee->last_name,
            $employee->employee_no,
            $employee->employee_type,
            $employee->designation,
            $employee->department,
            $employee->section,
            $employee->gender,
            $employee->nid,
            $employee->religion,
            $employee->present_address,
            $employee->permanent_address,
            $employee->emgerency_contact_person_name,
            $employee->emgerency_contact_number,
            $employee->emgerency_contact_relation,
            $employee->supervisor_name,
            $employee->date_of_birth,
            $employee->blood_group,
            $employee->marital_status,
            $employee->joining_date,
            $employee->contact_number,
            $employee->email,
            $employee->refered_by,
            $employee->salary?->total_salary,
            $employee->employee_shift,
            null, // joining_month — not stored anywhere (import discards it too), template-only column
        ];
    }
}
