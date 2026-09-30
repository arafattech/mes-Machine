<?php

namespace App\Exports;

use App\Exports\Concerns\HasCompanyReportLayout;
use App\Models\AttendanceLog;
use App\Models\EmployeeWeekend;
use App\Models\LeaveDate;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

class AttendanceExport implements FromArray, WithHeadings, WithStyles, WithColumnWidths, WithEvents
{
    use HasCompanyReportLayout;

    protected array $filters;
    protected array $dates = [];
    protected array $rows  = [];

    private int $fixedCols = 11;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
        $this->build();
    }

    protected function build(): void
    {
        $logs = AttendanceLog::with(['employee', 'shift'])
            ->when(!empty($this->filters['from']), fn($q) => $q->whereDate('attendance_date', '>=', $this->filters['from']))
            ->when(!empty($this->filters['to']),   fn($q) => $q->whereDate('attendance_date', '<=', $this->filters['to']))
            ->when(!empty($this->filters['employee_type_id']), fn($q) => $q->where('employee_type_id', $this->filters['employee_type_id']))
            ->orderBy('employee_id')
            ->orderBy('attendance_date')
            ->get();

        if (!empty($this->filters['from']) && !empty($this->filters['to'])) {
            $start = Carbon::parse($this->filters['from'])->startOfDay();
            $end   = Carbon::parse($this->filters['to'])->startOfDay();
            $dates = [];
            for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
                $dates[] = $d->format('Y-m-d');
            }
            $this->dates = $dates;
        } else {
            $this->dates = $logs
                ->map(fn($l) => Carbon::parse($l->attendance_date)->format('Y-m-d'))
                ->unique()->sort()->values()->toArray();
        }

        $byEmployee  = $logs->groupBy('employee_id');
        $employeeIds = $byEmployee->keys()->all();

        $medicalCounts   = $this->leaveCountsByType($employeeIds, 'medical');
        $casualCounts    = $this->leaveCountsByType($employeeIds, 'casual');
        $flCounts        = $this->weekendCounts($employeeIds, festivalLeave: true);
        $offCounts       = $this->weekendCounts($employeeIds, festivalLeave: false);
        $leaveByDate     = $this->leaveCodesByEmployeeAndDate($employeeIds);
        $weekendByDate   = $this->weekendCodesByEmployeeAndDate($employeeIds);

        $sl = 0;
        foreach ($byEmployee as $employeeId => $empLogs) {
            $sl++;
            $first = $empLogs->first();
            $emp   = $first->employee;

            // is_ot rows are overtime sessions, not regular attendance — they don't count
            // toward "present" or the Total Attendances column, only toward the "+OT" suffix.
            $regularLogs = $empLogs->reject(fn($l) => $l->is_ot);

            $countByDate = $regularLogs
                ->groupBy(fn($l) => Carbon::parse($l->attendance_date)->format('Y-m-d'))
                ->map->count();

            $otCountByDate = $empLogs
                ->filter(fn($l) => $l->is_ot)
                ->groupBy(fn($l) => Carbon::parse($l->attendance_date)->format('Y-m-d'))
                ->map->count();

            $row = [
                $sl,
                $emp->employee_no ?? '',
                trim(($emp->first_name ?? '') . ' ' . ($emp->last_name ?? '')),
                $emp->designation ?? '',
                $first->shift?->name ?? '',
                $medicalCounts[$employeeId] ?? 0,
                $casualCounts[$employeeId] ?? 0,
                $flCounts[$employeeId] ?? 0,
                $offCounts[$employeeId] ?? 0,
                $regularLogs->count(),
                $empLogs->filter(fn($l) => $l->is_ot)->count(),
            ];

            foreach ($this->dates as $date) {
                $row[] = $this->resolveDateCell(
                    $countByDate[$date] ?? 0,
                    $otCountByDate[$date] ?? 0,
                    $leaveByDate[$employeeId][$date] ?? null,
                    $weekendByDate[$employeeId][$date] ?? null,
                );
            }

            $this->rows[] = $row;
        }
    }

    private function leaveCountsByType(array $employeeIds, string $typeNameContains): array
    {
        if (!$employeeIds) {
            return [];
        }

        return LeaveDate::whereIn('employee_id', $employeeIds)
            ->when(!empty($this->filters['from']), fn($q) => $q->whereDate('leave_date', '>=', $this->filters['from']))
            ->when(!empty($this->filters['to']),   fn($q) => $q->whereDate('leave_date', '<=', $this->filters['to']))
            ->whereHas('leaveRequest', function ($query) use ($typeNameContains) {
                $query->where('final_status', 'approved')
                    ->whereHas('leavetype', fn($q) => $q->where('name', 'like', "%{$typeNameContains}%"));
            })
            ->get()
            ->groupBy('employee_id')
            ->map->count()
            ->all();
    }

    private function weekendCounts(array $employeeIds, bool $festivalLeave): array
    {
        if (!$employeeIds) {
            return [];
        }

        return EmployeeWeekend::whereIn('employee_id', $employeeIds)
            ->when(!empty($this->filters['from']), fn($q) => $q->whereDate('weekend_date', '>=', $this->filters['from']))
            ->when(!empty($this->filters['to']),   fn($q) => $q->whereDate('weekend_date', '<=', $this->filters['to']))
            ->where('status', 'APPROVED')
            ->where('type', '!=', 'LEAVE')
            ->when($festivalLeave, fn($q) => $q->whereNotNull('type_id'), fn($q) => $q->whereNull('type_id'))
            ->get()
            ->groupBy('employee_id')
            ->map->count()
            ->all();
    }

    private function leaveCodesByEmployeeAndDate(array $employeeIds): array
    {
        if (!$employeeIds || !$this->dates) {
            return [];
        }

        return LeaveDate::whereIn('employee_id', $employeeIds)
            ->whereIn('leave_date', $this->dates)
            ->whereHas('leaveRequest', fn($q) => $q->where('final_status', 'approved'))
            ->with('leaveRequest.leavetype')
            ->get()
            ->groupBy('employee_id')
            ->map(fn($rows) => $rows
                ->groupBy(fn($r) => Carbon::parse($r->leave_date)->format('Y-m-d'))
                ->map(function ($dateRows) {
                    $typeName = strtolower($dateRows->first()->leaveRequest?->leavetype?->name ?? '');

                    return match (true) {
                        str_contains($typeName, 'medical') => 'ML',
                        str_contains($typeName, 'casual')  => 'CL',
                        default                             => 'L',
                    };
                }))
            ->all();
    }

    private function weekendCodesByEmployeeAndDate(array $employeeIds): array
    {
        if (!$employeeIds || !$this->dates) {
            return [];
        }

        return EmployeeWeekend::whereIn('employee_id', $employeeIds)
            ->whereIn('weekend_date', $this->dates)
            ->where('status', 'APPROVED')
            ->where('type', '!=', 'LEAVE')
            ->get()
            ->groupBy('employee_id')
            ->map(fn($rows) => $rows
                ->groupBy(fn($r) => Carbon::parse($r->weekend_date)->format('Y-m-d'))
                ->map(function ($dateRows) {
                    $hasFL  = $dateRows->contains(fn($r) => $r->type_id !== null);
                    $hasOff = $dateRows->contains(fn($r) => $r->type_id === null);

                    return match (true) {
                        $hasFL && $hasOff => 'FL + OFF',
                        $hasFL            => 'FL',
                        default           => 'OFF',
                    };
                }))
            ->all();
    }

    private function resolveDateCell(int $presentCount, int $otCount, ?string $leaveCode, ?string $weekendCode): string
    {
        if ($presentCount > 0) {
            return 'P' . str_repeat('+OT', $otCount);
        }

        return $leaveCode ?? $weekendCode ?? '0';
    }

    public function array(): array
    {
        return $this->rows;
    }

    public function headings(): array
    {
        $fixed = ['SL', 'Emp No', 'Employee Name', 'Designation', 'Shift', 'Total ML', 'Total CL', 'Total FL', 'Total OFF', 'Total Attendances', 'Total OT'];
        $dateHeaders = array_map(fn($d) => Carbon::parse($d)->format('d/m'), $this->dates);
        return array_merge($fixed, $dateHeaders);
    }

    public function columnWidths(): array
    {
        $widths = [
            'A' => 5,   // SL
            'B' => 12,  // Emp No
            'C' => 22,  // Name
            'D' => 18,  // Designation
            'E' => 16,  // Shift
            'F' => 10,  // Total ML
            'G' => 10,  // Total CL
            'H' => 10,  // Total FL
            'I' => 10,  // Total OFF
            'J' => 18,  // Total Attendances
            'K' => 10,  // Total OT
        ];

        foreach (array_keys($this->dates) as $i) {
            $col          = Coordinate::stringFromColumnIndex($this->fixedCols + 1 + $i);
            $widths[$col] = 10; // fits the widest code, "FL + OFF"
        }

        return $widths;
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => [
                'font'      => ['bold' => true, 'size' => 11],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                'fill'      => [
                    'fillType'   => Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FFB8CCE4'],
                ],
            ],
            'A' => ['alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]],
            'B' => ['alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]],
            'F' => ['alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]],
            'G' => ['alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]],
            'H' => ['alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]],
            'I' => ['alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]],
            'J' => ['alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]],
            'K' => ['alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]],
        ];
    }

    private function reportDateRangeLabel(): string
    {
        if (!empty($this->filters['from']) && !empty($this->filters['to'])) {
            $from = Carbon::parse($this->filters['from'])->format('d/m/Y');
            $to   = Carbon::parse($this->filters['to'])->format('d/m/Y');
            return "{$from} to {$to}";
        }

        return Carbon::now()->format('d/m/Y');
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet     = $event->sheet->getDelegate();
                $dateCount = count($this->dates);
                $totalCols = $this->fixedCols + $dateCount;
                $lastCol   = Coordinate::stringFromColumnIndex($totalCols);

                ['headerRow' => $headerRow, 'lastDataRow' => $totalRows] = $this->applyCompanyReportLayout(
                    $sheet,
                    $lastCol,
                    $this->reportDateRangeLabel(),
                    count($this->rows),
                );

                for ($i = 0; $i < $dateCount; $i++) {
                    $col = Coordinate::stringFromColumnIndex($this->fixedCols + 1 + $i);
                    for ($r = $headerRow + 1; $r <= $totalRows; $r++) {
                        $cell = "{$col}{$r}";
                        $value = (string) $sheet->getCell($cell)->getValue();
                        $sheet->getStyle($cell)->applyFromArray([
                            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                            'fill'      => [
                                'fillType'   => Fill::FILL_SOLID,
                                'startColor' => ['argb' => $this->cellFillColor($value)],
                            ],
                        ]);
                    }
                }

                $sheet->freezePane('A' . ($headerRow + 1));
                $sheet->getRowDimension($headerRow)->setRowHeight(20);
            },
        ];
    }

    private function cellFillColor(string $value): string
    {
        return match (true) {
            str_starts_with($value, 'P') => 'FFC6EFCE', // present — green
            $value === '0'                => 'FFFFC7CE', // absent — red
            $value === 'FL + OFF'         => 'FFE6B8B7', // festival leave + weekend — rose
            $value === 'OFF'              => 'FFDCE6F1', // weekend — blue
            $value === 'FL'               => 'FFFCD5B4', // festival leave — orange
            $value === 'CL'               => 'FFFFEB9C', // casual leave — yellow
            $value === 'ML'               => 'FFB7DEE8', // medical leave — cyan
            default                       => 'FFF2F2F2', // generic leave / unmatched — grey
        };
    }
}
