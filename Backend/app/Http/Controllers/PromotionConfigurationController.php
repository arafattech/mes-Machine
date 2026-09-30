<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeGroup;
use App\Models\PromotionConfiguration;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PromotionConfigurationController extends Controller
{
    public function index(Request $request)
    {
        $top = $request->filled('$top') ? max((int) $request->input('$top'), 0) : 40;
        $skip = $request->filled('$skip') ? max((int) $request->input('$skip'), 0) : 0;

        $query = PromotionConfiguration::query()
            ->with(['department', 'employeeGroup', 'employee']);

        $this->applyFilters($query, $request);

        $count = (clone $query)->count();
        $this->applySorting($query, $request);

        if ($top > 0) {
            $query->offset($skip)->limit($top);
        }

        return response()->json([
            'value' => $query->get(),
            '@count' => $count,
        ]);
    }

    public function store(Request $request)
    {
        $payload = $this->validatedPayload($request);
        $configuration = PromotionConfiguration::create($this->normalizePayload($payload));

        return response()->json(
            $configuration->fresh(['department', 'employeeGroup', 'employee']),
            201
        );
    }

    public function update(Request $request, PromotionConfiguration $promotionConfiguration)
    {
        $payload = $this->validatedPayload($request, true);
        $promotionConfiguration->update($this->normalizePayload($payload, true));

        return response()->json($promotionConfiguration->fresh(['department', 'employeeGroup', 'employee']));
    }

    public function options()
    {
        return response()->json([
            'departments' => Department::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(),
            'employee_groups' => EmployeeGroup::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(),
            'employees' => Employee::query()
                ->with(['department', 'group'])
                ->where('is_active', true)
                ->orderBy('employee_no')
                ->orderBy('first_name')
                ->get(),
        ]);
    }

    private function validatedPayload(Request $request, bool $isUpdate = false): array
    {
        $required = $isUpdate ? 'sometimes' : 'required';

        return $request->validate([
            'is_active' => ['sometimes', 'boolean'],
            'name' => ['nullable', 'string', 'max:255'],
            'scope_type' => [$required, Rule::in([
                PromotionConfiguration::SCOPE_DEPARTMENT,
                PromotionConfiguration::SCOPE_EMPLOYEE_GROUP,
                PromotionConfiguration::SCOPE_EMPLOYEE,
            ])],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'employee_group_id' => ['nullable', 'integer', 'exists:employee_groups,id'],
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'schedule_type' => ['nullable', Rule::in([
                PromotionConfiguration::SCHEDULE_SERVICE_MONTHS,
                PromotionConfiguration::SCHEDULE_FIXED_DATE,
                PromotionConfiguration::SCHEDULE_DATE_RANGE,
            ])],
            'months_of_service' => ['nullable', 'integer', 'min:1'],
            'eligibility_date' => ['nullable', 'date'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'expiry_days' => ['nullable', 'integer', 'min:0'],
            'promotion_title' => ['nullable', 'string', 'max:255'],
            'promotion_type' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
        ]);
    }

    private function normalizePayload(array $payload, bool $isUpdate = false): array
    {
        $scopeType = $payload['scope_type'] ?? null;

        if ($scopeType === PromotionConfiguration::SCOPE_DEPARTMENT) {
            $payload['employee_group_id'] = null;
            $payload['employee_id'] = null;
        }

        if ($scopeType === PromotionConfiguration::SCOPE_EMPLOYEE_GROUP) {
            $payload['department_id'] = null;
            $payload['employee_id'] = null;
        }

        if ($scopeType === PromotionConfiguration::SCOPE_EMPLOYEE) {
            $payload['department_id'] = null;
            $payload['employee_group_id'] = null;
        }

        if (!$isUpdate) {
            $payload['is_active'] = $payload['is_active'] ?? true;
            $payload['schedule_type'] = $payload['schedule_type'] ?? PromotionConfiguration::SCHEDULE_SERVICE_MONTHS;
            $payload['expiry_days'] = $payload['expiry_days'] ?? 7;
        }

        return $payload;
    }

    private function applyFilters(Builder $query, Request $request): void
    {
        $filter = urldecode((string) $request->input('$filter', ''));

        if ($filter && preg_match("/scope_type\s+eq\s+'([^']+)'/i", $filter, $matches)) {
            $query->where('scope_type', $matches[1]);
        }

        if ($filter && preg_match('/is_active\s+eq\s+(true|false)/i', $filter, $matches)) {
            $query->where('is_active', strtolower($matches[1]) === 'true');
        }

        foreach (['department_id', 'employee_group_id', 'employee_id'] as $field) {
            if ($filter && preg_match("/{$field}\s+eq\s+(\d+)/i", $filter, $matches)) {
                $query->where($field, (int) $matches[1]);
            }
        }

        $searchTerms = [];

        if ($filter) {
            preg_match_all("/contains\((?:tolower\()?[^,]+,\s*'([^']*)'\)/i", $filter, $matches);
            $searchTerms = $matches[1] ?? [];
        }

        if ($request->filled('filter')) {
            $searchTerms[] = (string) $request->input('filter');
        }

        $searchTerms = collect($searchTerms)
            ->map(fn ($term) => trim(strtolower((string) $term)))
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (!$searchTerms) {
            return;
        }

        $query->where(function (Builder $searchQuery) use ($searchTerms) {
            foreach ($searchTerms as $term) {
                $likeTerm = "%{$term}%";

                $searchQuery
                    ->orWhereRaw('LOWER(custom_id) LIKE ?', [$likeTerm])
                    ->orWhereRaw('LOWER(name) LIKE ?', [$likeTerm])
                    ->orWhereRaw('LOWER(scope_type) LIKE ?', [$likeTerm])
                    ->orWhereRaw('LOWER(schedule_type) LIKE ?', [$likeTerm])
                    ->orWhereRaw('LOWER(promotion_title) LIKE ?', [$likeTerm])
                    ->orWhereRaw('LOWER(promotion_type) LIKE ?', [$likeTerm])
                    ->orWhereRaw('LOWER(note) LIKE ?', [$likeTerm])
                    ->orWhereHas('department', fn (Builder $departmentQuery) => $departmentQuery->whereRaw('LOWER(name) LIKE ?', [$likeTerm]))
                    ->orWhereHas('employeeGroup', fn (Builder $groupQuery) => $groupQuery->whereRaw('LOWER(name) LIKE ?', [$likeTerm]))
                    ->orWhereHas('employee', function (Builder $employeeQuery) use ($likeTerm) {
                        $employeeQuery
                            ->whereRaw('LOWER(employee_no) LIKE ?', [$likeTerm])
                            ->orWhereRaw('LOWER(first_name) LIKE ?', [$likeTerm])
                            ->orWhereRaw('LOWER(last_name) LIKE ?', [$likeTerm]);
                    });
            }
        });
    }

    private function applySorting(Builder $query, Request $request): void
    {
        $orderby = trim((string) $request->input('$orderby', ''));
        $column = 'id';
        $direction = 'desc';

        if ($orderby && preg_match('/^([A-Za-z0-9_\.\/]+)\s+(asc|desc)$/i', $orderby, $matches)) {
            $requestedColumn = str_replace('/', '.', $matches[1]);
            $direction = strtolower($matches[2]) === 'asc' ? 'asc' : 'desc';

            $allowedColumns = [
                'id',
                'custom_id',
                'is_active',
                'name',
                'scope_type',
                'department_id',
                'employee_group_id',
                'employee_id',
                'schedule_type',
                'months_of_service',
                'expiry_days',
                'promotion_title',
                'promotion_type',
                'created_at',
                'updated_at',
            ];

            if (in_array($requestedColumn, $allowedColumns, true)) {
                $column = $requestedColumn;
            }
        }

        $query->orderBy($column, $direction)->orderByDesc('id');
    }
}
