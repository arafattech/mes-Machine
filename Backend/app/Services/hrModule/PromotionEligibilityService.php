<?php

namespace App\Services\hrModule;

use App\Models\Designation;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeSalary;
use App\Models\Promotion;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PromotionEligibilityService
{
    private ?bool $hasLastIncrementCache = null;
    public function sync(): array
    {

        $expiredCount = Promotion::query()
            ->where('status', Promotion::STATUS_PENDING)
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '<', today()->toDateString())
            ->update(['status' => Promotion::STATUS_EXPIRED]);

        return [
            'expired' => $expiredCount,
            'approved_count' => Promotion::where('status', Promotion::STATUS_APPROVED)->count(),
            'expired_count' => Promotion::where('status', Promotion::STATUS_EXPIRED)->count(),
        ];
    }

    public function getVirtualSegments(): array
    {
        return $this->buildAllVirtualRows();
    }

    public function getEligibleEmployees(): Collection
    {
        return $this->buildAllVirtualRows()['pending'];
    }

    public function getExpiredEmployees(): Collection
    {
        return $this->buildAllVirtualRows()['expired'];
    }

    private function buildAllVirtualRows(): array
    {
        $today       = today();
        $twoYearsAgo = today()->subYears(2);

        $pendingEmployeeIds = Promotion::query()
            ->where('status', Promotion::STATUS_PENDING)
            ->pluck('employee_id')
            ->all();

        $employees = Employee::query()
            ->with(['salary', 'department', 'designation', 'group', 'employeeType', 'employeeSection'])
            ->where('is_active', true)
            ->whereNotIn('id', $pendingEmployeeIds)
            ->where(function ($query) {
                if ($this->hasLastIncrementColumn()) {
                    $query->whereNotNull('last_increment')
                        ->orWhereNotNull('joining_date');
                    return;
                }
                $query->whereNotNull('joining_date');
            })
            ->get();

        $latestApproved = [];
        if (!$this->hasLastIncrementColumn() && $employees->isNotEmpty()) {
            $latestApproved = Promotion::query()
                ->select(['employee_id', DB::raw('MAX(effective_date) as effective_date')])
                ->where('status', Promotion::STATUS_APPROVED)
                ->whereNotNull('effective_date')
                ->whereIn('employee_id', $employees->pluck('id'))
                ->groupBy('employee_id')
                ->pluck('effective_date', 'employee_id')
                ->all();
        }

        $pending = collect();
        $expired = collect();

        foreach ($employees as $employee) {
            $row = $this->buildVirtualEntry($employee, $today, $twoYearsAgo, $latestApproved);
            if ($row === null) continue;

            if ($row['status'] === Promotion::STATUS_PENDING) {
                $pending->push($row);
            } else {
                $expired->push($row);
            }
        }

        return ['pending' => $pending, 'expired' => $expired];
    }

    private function buildVirtualEntry(Employee $employee, Carbon $today, Carbon $twoYearsAgo, array $latestApproved = []): ?array
    {
        $baseDate = $this->getEligibilityBaseDate($employee, $latestApproved[$employee->id] ?? null);
        if (!$baseDate) {
            return null;
        }

        $isOfficerStaff  = (bool) ($employee->getRelation('employeeType')?->is_officer_staff ?? false);
        $eligibilityDate = $this->computeEligibilityDate($baseDate, $isOfficerStaff);
        $expiresAt       = $eligibilityDate->copy()->addDays(7);

        if ($eligibilityDate->greaterThan($today)) {
            return null; 
        }

        if ($eligibilityDate->lessThan($twoYearsAgo)) {
            return null; 
        }

        $status = $expiresAt->greaterThanOrEqualTo($today)
            ? Promotion::STATUS_PENDING
            : Promotion::STATUS_EXPIRED;

        $designation        = $employee->getRelation('designation');
        $currentDesignation = $designation?->name ?? $employee->getAttribute('designation') ?? '';
        $department         = $employee->getRelation('department');

        return [
            'id' => null,
            'custom_id' => null,
            'is_active' => true,
            'employee_id' => $employee->id,
            'employee' => [
                'id' => $employee->id,
                'employee_no' => $employee->employee_no,
                'first_name' => $employee->first_name,
                'last_name' => $employee->last_name,
                'joining_date' => $employee->joining_date,
                'employee_type_id' => $employee->employee_type_id,
                'employee_type' => $employee->getRelation('employeeType')
                    ? ['id' => $employee->getRelation('employeeType')->id, 'name' => $employee->getRelation('employeeType')->name]
                    : null,
                'employee_section_id' => $employee->employee_section_id,
                'employee_section' => $employee->getRelation('employeeSection')
                    ? ['id' => $employee->getRelation('employeeSection')->id, 'name' => $employee->getRelation('employeeSection')->name]
                    : null,
            ],
            'promotion_configuration_id' => null,
            'promotion_title' => $this->getDefaultTitle($employee),
            'promotion_type' => 'regular',
            'old_designation' => $currentDesignation,
            'new_designation' => $currentDesignation,
            'old_department_id' => $employee->department_id,
            'new_department_id' => $employee->department_id,
            'old_department' => $department ? ['id' => $department->id, 'name' => $department->name] : null,
            'new_department' => $department ? ['id' => $department->id, 'name' => $department->name] : null,
            'old_salary' => $employee->salary?->total_salary,
            'new_salary' => null,
            'salary_increment' => 0,
            'increment_type' => null,
            'inc_value' => null,
            'promotion_date' => $eligibilityDate->toDateString(),
            'cycle_base_date' => $baseDate->toDateString(),
            'eligibility_date' => $eligibilityDate->toDateString(),
            'expires_at' => $expiresAt->toDateString(),
            'status' => $status,
            'note' => $this->getDefaultNote($employee),
            'created_at' => null,
            'updated_at' => null,
        ];
    }

    public function getEligibilityBaseDate(Employee $employee, ?string $preloadedApprovedDate = null): ?Carbon
    {
        if ($this->hasLastIncrementColumn() && $employee->last_increment) {
            return Carbon::parse($employee->last_increment)->startOfDay();
        }

        if (!$this->hasLastIncrementColumn()) {
            $latestApproved = $preloadedApprovedDate ?? Promotion::query()
                ->where('employee_id', $employee->id)
                ->where('status', Promotion::STATUS_APPROVED)
                ->whereNotNull('effective_date')
                ->orderByDesc('effective_date')
                ->value('effective_date');

            if ($latestApproved) {
                return Carbon::parse($latestApproved)->startOfDay();
            }
        }

        return $employee->joining_date
            ? Carbon::parse($employee->joining_date)->startOfDay()
            : null;
    }

    /**
     * Regular employees:
     *   Day 1   → 1st of same month, year+1     (e.g. 01-Apr-2025 → 01-Apr-2026)
     *   Day 2+  → 1st of next month, year+1     (e.g. 05-Apr-2025 → 01-May-2026)
     *
     * Officer/staff (bi-annual Jan 1 / Jul 1 cycle — unchanged):
     *   Jan 1–2              → Jan 1, year+1
     *   Jan 3 – Jun 30       → Jul 1, year+1
     *   Jul 1–2              → Jul 1, year+1
     *   Jul 3 – Dec 31       → Jan 1, year+2
     */
    public function computeEligibilityDate(Carbon $baseDate, bool $isOfficerStaff = false): Carbon
    {
        $year  = (int) $baseDate->year;
        $month = (int) $baseDate->month;
        $day   = (int) $baseDate->day;

        if ($isOfficerStaff) {
            if ($month === 1 && $day <= 2) {
                return Carbon::create($year + 1, 1, 1)->startOfDay();
            }

            if ($month <= 6) {
                return Carbon::create($year + 1, 7, 1)->startOfDay();
            }

            if ($month === 7 && $day <= 2) {
                return Carbon::create($year + 1, 7, 1)->startOfDay();
            }

            return Carbon::create($year + 2, 1, 1)->startOfDay();
        }

   
        if ($day === 1) {
            return Carbon::create($year + 1, $month, 1)->startOfDay();
        }

        return Carbon::create($year + 1, $month+1, 1)->addMonthNoOverflow()->startOfDay();
    }

    public function applyPromotionToEmployee(Promotion $promotion): void
    {
        $employee = Employee::query()
            ->with('salary')
            ->lockForUpdate()
            ->find($promotion->employee_id);

        if (!$employee) {
            return;
        }

        if ($promotion->new_department_id) {
            $employee->department_id = $promotion->new_department_id;
            $employee->department = Department::query()
                ->where('id', $promotion->new_department_id)
                ->value('name');
        }

        if ($promotion->new_designation) {
            $designation = Designation::query()->firstOrCreate(
                ['name' => $promotion->new_designation],
                ['is_active' => true]
            );

            $employee->designation_id = $designation->id;
            $employee->designation = $designation->name;
        }

        if ($employee->isDirty()) {
            $employee->saveQuietly();
        }

        if ($promotion->new_salary !== null) {
            $newTotal   = (float) $promotion->new_salary;
            $salary     = $employee->getRelation('salary');
            $components = ['basic', 'house_rent', 'medical_allowance', 'transport_allowance', 'other_allowance'];

            $updates = ['total_salary' => $newTotal];

            if ($salary) {
                $currentTotal = (float) ($salary->total_salary ?? 0);

                if ($currentTotal > 0) {
                    $remaining = $newTotal;

                    foreach ($components as $i => $field) {
                        $currentValue = (float) ($salary->{$field} ?? 0);
                        if ($currentValue <= 0) {
                            continue;
                        }

                        $isLast = collect($components)->slice($i + 1)->every(
                            fn ($f) => ((float) ($salary->{$f} ?? 0)) <= 0
                        );

                        if ($isLast) {
                            $updates[$field] = round($remaining, 2);
                        } else {
                            $scaled           = round($newTotal * ($currentValue / $currentTotal), 2);
                            $updates[$field]  = $scaled;
                            $remaining       -= $scaled;
                        }
                    }
                }
            }

            EmployeeSalary::updateOrCreate(
                ['employee_id' => $employee->id],
                $updates
            );
        }

        $incrementDate = $promotion->effective_date
            ?? $promotion->promotion_date
            ?? now()->toDateString();

        if ($this->hasLastIncrementColumn()) {
            $employee->last_increment = Carbon::parse($incrementDate)->startOfDay();

            if ($employee->isDirty()) {
                $employee->saveQuietly();
            }
        }
    }

    private function getDefaultTitle(Employee $employee): string
    {
        $employeeType = $employee->getRelation('employeeType');
        if ($employeeType?->is_officer_staff) {
            return 'Officer/Staff Promotion Eligibility';
        }

        return 'Employee Promotion Eligibility';
    }

    private function getDefaultNote(Employee $employee): string
    {
        $employeeType = $employee->getRelation('employeeType');

        if ($employeeType?->is_officer_staff) {
            return 'Auto generated from join date and officer/staff promotion cycle.';
        }

        return '';
    }

    public function updateEmployeeLastIncrement(Promotion $promotion): void
    {
        if (!$this->hasLastIncrementColumn()) {
            return;
        }

        $employee = Employee::query()->lockForUpdate()->find($promotion->employee_id);

        if (!$employee) {
            return;
        }

        $incrementDate = $promotion->effective_date
            ?? $promotion->promotion_date
            ?? now()->toDateString();

        $employee->last_increment = Carbon::parse($incrementDate)->startOfDay();

        if ($employee->isDirty()) {
            $employee->saveQuietly();
        }
    }

    private function hasLastIncrementColumn(): bool
    {
        return $this->hasLastIncrementCache ??= Schema::hasColumn('employees', 'last_increment');
    }
}
