<?php

namespace App\Http\Controllers;

use App\Exports\PromotionHistoryExport;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmployeeType;
use App\Models\Promotion;
use App\Services\hrModule\PromotionEligibilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;

class PromotionController extends Controller
{
    public function __construct(private readonly PromotionEligibilityService $promotionEligibilityService)
    {
    }

    public function syncEligibility()
    {
        $result = DB::transaction(fn () => $this->promotionEligibilityService->sync());

        return response()->json($result);
    }

    public function index(Request $request)
    {
        $top  = $request->filled('$top') ? max((int) $request->input('$top'), 0) : 40;
        $skip = $request->filled('$skip') ? max((int) $request->input('$skip'), 0) : 0;

        $filter       = urldecode((string) $request->input('$filter', ''));
        $statusFilter = null;

        if ($filter && preg_match("/status\s+eq\s+'([^']+)'/i", $filter, $m)) {
            $statusFilter = $m[1];
        }

        $twoYearsAgo = now()->subYears(2)->startOfDay()->toDateString();
        $items       = collect();

        $dbSelect = [
            'id', 'custom_id', 'is_active', 'employee_id',
            'promotion_title', 'promotion_type',
            'old_designation', 'new_designation',
            'old_department_id', 'new_department_id',
            'old_salary', 'new_salary', 'salary_increment',
            'increment_type', 'inc_value',
            'promotion_date', 'effective_date', 'eligibility_date',
            'cycle_base_date', 'expires_at',
            'status', 'note', 'approved_by', 'created_at', 'updated_at',
        ];
        $dbWith = [
            'employee:id,employee_no,first_name,last_name,joining_date,employee_type_id,employee_section_id',
            'employee.employeeType:id,name',
            'employee.employeeSection:id,name',
            'oldDepartment:id,name',
            'newDepartment:id,name',
            'approvedBy:id,name',
        ];

        $needVirtual = !$statusFilter
            || $statusFilter === Promotion::STATUS_PENDING
            || $statusFilter === Promotion::STATUS_EXPIRED;

        $virtualSegments = $needVirtual
            ? $this->promotionEligibilityService->getVirtualSegments()
            : ['pending' => collect(), 'expired' => collect()];

        if (!$statusFilter || $statusFilter === Promotion::STATUS_PENDING) {
            $items = $items->merge($virtualSegments['pending']);

            $items = $items->merge(
                Promotion::query()
                    ->select($dbSelect)->with($dbWith)
                    ->where('status', Promotion::STATUS_PENDING)
                    ->get()->toArray()
            );
        }

        if (!$statusFilter || $statusFilter === Promotion::STATUS_EXPIRED) {
            $items = $items->merge($virtualSegments['expired']);

            $items = $items->merge(
                Promotion::query()
                    ->select($dbSelect)->with($dbWith)
                    ->where('status', Promotion::STATUS_EXPIRED)
                    ->whereDate('promotion_date', '>=', $twoYearsAgo)
                    ->get()->toArray()
            );
        }

        if (!$statusFilter || $statusFilter === Promotion::STATUS_APPROVED) {
            $items = $items->merge(
                Promotion::query()
                    ->select($dbSelect)->with($dbWith)
                    ->where('status', Promotion::STATUS_APPROVED)
                    ->whereDate('promotion_date', '>=', $twoYearsAgo)
                    ->get()->toArray()
            );
        }

        if (!$statusFilter || $statusFilter === Promotion::STATUS_DECLINED) {
            $items = $items->merge(
                Promotion::query()
                    ->select($dbSelect)->with($dbWith)
                    ->where('status', Promotion::STATUS_DECLINED)
                    ->whereDate('promotion_date', '>=', $twoYearsAgo)
                    ->get()->toArray()
            );
        }

        $employeeTypeIds = [];
        if ($filter && preg_match_all('/employee_type_id\s+eq\s+(\d+)/i', $filter, $m)) {
            $employeeTypeIds = array_values(array_unique(array_map('intval', $m[1])));
        }

        if ($employeeTypeIds) {
            $items = $items->filter(
                fn ($row) => in_array($row['employee']['employee_type_id'] ?? null, $employeeTypeIds, true)
            )->values();
        }

        if ($filter && preg_match('/employee_id\s+eq\s+(\d+)/i', $filter, $m)) {
            $employeeId = (int) $m[1];
            $items = $items->filter(fn ($row) => (int) ($row['employee_id'] ?? 0) === $employeeId)->values();
        }

        if ($filter && preg_match('/promotion_date\s+ge\s+([\d-]+)/i', $filter, $m)) {
            $from = $m[1];
            $items = $items->filter(
                fn ($row) => ($row['promotion_date'] ?? null) && substr($row['promotion_date'], 0, 10) >= $from
            )->values();
        }

        if ($filter && preg_match('/promotion_date\s+le\s+([\d-]+)/i', $filter, $m)) {
            $to = $m[1];
            $items = $items->filter(
                fn ($row) => ($row['promotion_date'] ?? null) && substr($row['promotion_date'], 0, 10) <= $to
            )->values();
        }

        $searchTerms = $this->extractSearchTerms($filter, $request);
        if ($searchTerms) {
            $items = $this->filterPromotionItems($items, $searchTerms);
        }

        $count = $items->count();

        $items = $this->sortPromotionItems($items, $request);

        if ($top > 0) {
            $items = $items->slice($skip, $top)->values();
        }

        return response()->json([
            'value'  => $items,
            '@count' => $count,
        ]);
    }

    public function store(Request $request)
    {
        $payload = $this->validatedPromotionPayload($request);

        $promotion = DB::transaction(function () use ($payload) {
    
            if (!empty($payload['employee_id'])) {
                $employee = Employee::query()
                    ->with(['salary', 'designation', 'department'])
                    ->find($payload['employee_id']);

                if ($employee) {
                    $currentDesignation = $employee->getRelation('designation')?->name
                        ?? $employee->getAttribute('designation')
                        ?? '';

                    $payload['promotion_type']    ??= 'regular';
                    $payload['old_designation']   ??= $currentDesignation;
                    $payload['new_designation']   ??= $currentDesignation;
                    $payload['old_department_id'] ??= $employee->department_id;
                    $payload['new_department_id'] ??= $employee->department_id;
                    $payload['old_salary']        ??= $employee->salary?->total_salary;
                }
            }

            $promotion = Promotion::create($this->normalizePromotionPayload($payload));

            return $promotion->fresh(['employee', 'oldDepartment', 'newDepartment', 'approvedBy']);
        });

        return response()->json($promotion, 201);
    }

    public function update(Request $request, Promotion $promotion)
    {
        $payload = $this->validatedPromotionPayload($request, true);

        $promotion = DB::transaction(function () use ($payload, $promotion) {
            $promotion->update($this->normalizePromotionPayload($payload, true));

            return $promotion->fresh(['employee', 'oldDepartment', 'newDepartment', 'approvedBy']);
        });

        return response()->json($promotion);
    }

    public function options()
    {
        return response()->json([
            'employees' => Employee::query()
                ->with(['salary', 'department', 'designation', 'group', 'employeeType'])
                ->where('is_active', true)
                ->orderBy('employee_no')
                ->orderBy('first_name')
                ->get(),
            'departments' => Department::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(),
            'designations' => Designation::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(),
            'employeeTypes' => EmployeeType::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function employee(Employee $employee)
    {
        return response()->json($employee->load(['salary', 'department', 'designation', 'group', 'employeeType']));
    }

    public function approve(Request $request, Promotion $promotion)
    {
        $payload = $request->validate([
            'status'            => ['nullable', 'string', 'in:approved,declined'],
            'effective_date'    => ['nullable', 'date'],
            'promotion_date'    => ['nullable', 'date'],
            'new_designation'   => ['nullable', 'string', 'max:255'],
            'new_department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'new_salary'        => ['nullable', 'numeric', 'min:0'],
            'note'              => ['nullable', 'string'],
        ]);

        $newStatus = $payload['status'] ?? Promotion::STATUS_APPROVED;

        $promotion = DB::transaction(function () use ($payload, $promotion, $newStatus) {
            $promotion->loadMissing('employee.salary');

            $approvalData = [
                'status'         => $newStatus,
                'approved_by'    => Auth::id(),
                'approved_at'    => now(),
                'effective_date' => $payload['effective_date']
                    ?? $promotion->effective_date
                    ?? now()->toDateString(),
                'promotion_date' => $payload['promotion_date']
                    ?? $promotion->promotion_date
                    ?? now()->toDateString(),
            ];

            foreach (['new_designation', 'new_department_id', 'new_salary', 'note'] as $field) {
                if (array_key_exists($field, $payload)) {
                    $approvalData[$field] = $payload[$field];
                }
            }

            if (isset($approvalData['new_salary']) && $approvalData['new_salary'] !== null) {
                $approvalData['salary_increment'] = round(
                    (float) $approvalData['new_salary'] - (float) ($promotion->old_salary ?? 0),
                    2
                );
            }

            $promotion->update($approvalData);

            if ($newStatus === Promotion::STATUS_APPROVED) {
                $this->promotionEligibilityService->applyPromotionToEmployee($promotion->fresh('employee.salary'));
            } elseif ($newStatus === Promotion::STATUS_DECLINED) {
                $this->promotionEligibilityService->updateEmployeeLastIncrement($promotion->fresh());
            }

            return $promotion->fresh(['employee', 'oldDepartment', 'newDepartment', 'approvedBy']);
        });

        return response()->json($promotion);
    }

    public function approveEligible(Request $request)
    {
        $payload = $request->validate([
            'employee_id'       => ['required', 'integer', 'exists:employees,id'],
            'effective_date'    => ['nullable', 'date'],
            'promotion_date'    => ['nullable', 'date'],
            'new_designation'   => ['nullable', 'string', 'max:255'],
            'new_department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'new_salary'        => ['nullable', 'numeric', 'min:0'],
            'note'              => ['nullable', 'string'],
        ]);

        $promotion = DB::transaction(function () use ($payload) {
            $employee = Employee::query()
                ->with(['salary', 'department', 'designation', 'group', 'employeeType'])
                ->findOrFail($payload['employee_id']);

            $isOfficerStaff  = (bool) ($employee->getRelation('employeeType')?->is_officer_staff ?? false);
            $baseDate        = $this->promotionEligibilityService->getEligibilityBaseDate($employee);
            $eligibilityDate = $baseDate
                ? $this->promotionEligibilityService->computeEligibilityDate($baseDate, $isOfficerStaff)
                : null;

            $designation        = $employee->getRelation('designation');
            $currentDesignation = $designation?->name ?? $employee->getAttribute('designation') ?? '';

            $effectiveDate  = $payload['effective_date']  ?? now()->toDateString();
            $promotionDate  = $payload['promotion_date']  ?? $eligibilityDate?->toDateString() ?? now()->toDateString();
            $newSalary      = $payload['new_salary']      ?? $employee->salary?->total_salary;
            $newDeptId      = $payload['new_department_id'] ?? $employee->department_id;
            $newDesignation = $payload['new_designation'] ?? $currentDesignation;

            $promotion = Promotion::create([
                'is_active'         => true,
                'employee_id'       => $employee->id,
                'promotion_type'    => 'regular',
                'old_designation'   => $currentDesignation,
                'new_designation'   => $newDesignation,
                'old_department_id' => $employee->department_id,
                'new_department_id' => $newDeptId,
                'old_salary'        => $employee->salary?->total_salary,
                'new_salary'        => $newSalary,
                'salary_increment'  => round(
                    (float) ($newSalary ?? 0) - (float) ($employee->salary?->total_salary ?? 0),
                    2
                ),
                'promotion_date'    => $promotionDate,
                'cycle_base_date'   => $baseDate?->toDateString(),
                'eligibility_date'  => $eligibilityDate?->toDateString(),
                'effective_date'    => $effectiveDate,
                'status'            => Promotion::STATUS_APPROVED,
                'approved_by'       => Auth::id(),
                'approved_at'       => now(),
                'note'              => $payload['note'] ?? null,
            ]);

            $this->promotionEligibilityService->applyPromotionToEmployee($promotion->fresh('employee.salary'));

            return $promotion->fresh(['employee', 'oldDepartment', 'newDepartment', 'approvedBy']);
        });

        return response()->json($promotion);
    }

    public function exportHistory(Request $request)
    {
        $from = $request->input('from');
        $to = $request->input('to');
        $employeeId = $request->input('employee_id');
        $status = $request->input('status');
        $employeeTypeIds = array_filter(array_map('intval', (array) $request->input('employee_type_ids', [])));

        $filenameSuffix = $from && $to ? "_{$from}_to_{$to}" : '';

        // Pending/expired can include "virtual" rows (eligibility-computed, no saved
        // Promotion record yet) — the same ones the list view merges in via
        // getVirtualSegments(). Without this, exporting those segments would show
        // fewer rows than the table.
        $virtualRows = collect();
        if (!$from && !$to && (!$status || in_array($status, ['all', Promotion::STATUS_PENDING, Promotion::STATUS_EXPIRED], true))) {
            $segments = $this->promotionEligibilityService->getVirtualSegments();

            if (!$status || $status === 'all' || $status === Promotion::STATUS_PENDING) {
                $virtualRows = $virtualRows->merge($segments['pending']);
            }
            if (!$status || $status === 'all' || $status === Promotion::STATUS_EXPIRED) {
                $virtualRows = $virtualRows->merge($segments['expired']);
            }

            if ($employeeTypeIds) {
                $virtualRows = $virtualRows->filter(
                    fn ($row) => in_array($row['employee']['employee_type_id'] ?? null, $employeeTypeIds, true)
                )->values();
            }

            if ($employeeId) {
                $virtualRows = $virtualRows->filter(
                    fn ($row) => (int) ($row['employee_id'] ?? 0) === (int) $employeeId
                )->values();
            }
        }

        $employeeTypeName = $employeeTypeIds
            ? EmployeeType::whereIn('id', $employeeTypeIds)->pluck('name')->join(' / ')
            : null;

        return Excel::download(
            new PromotionHistoryExport(
                $from,
                $to,
                $employeeId ? (int) $employeeId : null,
                $status ?: null,
                $employeeTypeIds,
                $virtualRows,
                $employeeTypeName,
            ),
            "promotion-history{$filenameSuffix}.xlsx"
        );
    }

    private function filterPromotionItems(Collection $items, array $searchTerms): Collection
    {
        return $items->filter(function (array $row) use ($searchTerms) {
            $haystack = strtolower(implode(' ', array_filter([
                $row['custom_id'] ?? '',
                $row['status'] ?? '',
                $row['promotion_title'] ?? '',
                $row['promotion_type'] ?? '',
                $row['old_designation'] ?? '',
                $row['new_designation'] ?? '',
                $row['note'] ?? '',
                $row['employee']['employee_no'] ?? '',
                $row['employee']['first_name'] ?? '',
                $row['employee']['last_name'] ?? '',
                $row['employee']['employee_type']['name'] ?? '',
                $row['old_department']['name'] ?? '',
                $row['new_department']['name'] ?? '',
            ], fn ($v) => $v !== '' && $v !== null)));

            foreach ($searchTerms as $term) {

                $words = array_filter(preg_split('/\s+/', trim($term)));
                foreach ($words as $word) {
                    if (!str_contains($haystack, $word)) {
                        return false;
                    }
                }
            }
            return true;
        })->values();
    }

    private function sortPromotionItems(Collection $items, Request $request): Collection
    {
        $orderby    = trim((string) $request->input('$orderby', ''));
        $column     = 'promotion_date';
        $descending = true;

        if ($orderby && preg_match('/^([A-Za-z0-9_\.\/]+)\s+(asc|desc)$/i', $orderby, $matches)) {
            $requested  = str_replace('/', '.', $matches[1]);
            $descending = strtolower($matches[2]) === 'desc';

            $allowed = [
                'promotion_date', 'eligibility_date', 'cycle_base_date',
                'old_designation', 'status', 'promotion_title', 'promotion_type',
                'old_salary', 'new_salary', 'salary_increment',
                'effective_date', 'created_at',
            ];

            if (in_array($requested, $allowed, true)) {
                $column = $requested;
            }
        }

        return $items->sortBy(fn ($row) => $row[$column] ?? '', SORT_REGULAR, $descending)->values();
    }

    private function extractSearchTerms(string $filter, Request $request): array
    {
        $terms = [];

        if ($filter) {
            preg_match_all("/contains\((?:tolower\()?[^,]+,\s*'([^']*)'\)/i", $filter, $m);
            $terms = array_map('urldecode', $m[1] ?? []);
        }

        if ($request->filled('filter')) {
            $terms[] = (string) $request->input('filter');
        }

        if ($request->filled('search')) {
            $terms[] = (string) $request->input('search');
        }

        return collect($terms)
            ->map(fn ($t) => trim(strtolower((string) $t)))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function validatedPromotionPayload(Request $request, bool $isUpdate = false): array
    {
        $required = $isUpdate ? 'sometimes' : 'required';

        return $request->validate([
            'is_active'          => ['sometimes', 'boolean'],
            'employee_id'        => [$required, 'integer', 'exists:employees,id'],
            'promotion_title'    => ['nullable', 'string', 'max:255'],
            'promotion_type'     => ['nullable', 'string', 'max:255'],
            'old_designation'    => ['nullable', 'string', 'max:255'],
            'new_designation'    => ['nullable', 'string', 'max:255'],
            'old_department_id'  => ['nullable', 'integer', 'exists:departments,id'],
            'new_department_id'  => ['nullable', 'integer', 'exists:departments,id'],
            'old_salary'         => ['nullable', 'numeric', 'min:0'],
            'new_salary'         => ['nullable', 'numeric', 'min:0'],
            'salary_increment'   => ['nullable', 'numeric'],
            'increment_type' => ['nullable', 'string', Rule::in(['fixed', 'percentage'])],
            'inc_value'      => ['nullable', 'numeric', 'min:0'],
            'promotion_date'     => ['nullable', 'date'],
            'effective_date'     => ['nullable', 'date'],
            'status'             => ['nullable', Rule::in([
                Promotion::STATUS_PENDING,
                Promotion::STATUS_APPROVED,
                Promotion::STATUS_EXPIRED,
            ])],
            'cycle_base_date'    => ['nullable', 'date'],
            'eligibility_date'   => ['nullable', 'date'],
            'expires_at'         => ['nullable', 'date'],
            'note'               => ['nullable', 'string'],
        ]);
    }

    private function normalizePromotionPayload(array $payload, bool $isUpdate = false): array
    {
        if (!$isUpdate) {
            $payload['is_active'] = $payload['is_active'] ?? true;
            $payload['status']    = $payload['status']    ?? Promotion::STATUS_PENDING;
        }

        if (
            !array_key_exists('salary_increment', $payload)
            && array_key_exists('old_salary', $payload)
            && array_key_exists('new_salary', $payload)
            && $payload['old_salary'] !== null
            && $payload['new_salary'] !== null
        ) {
            $payload['salary_increment'] = round(
                (float) $payload['new_salary'] - (float) $payload['old_salary'],
                2
            );
        }

        return $payload;
    }
}
