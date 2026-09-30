<?php

namespace App\Exports;

use App\Exports\Concerns\HasCompanyReportLayout;
use App\Models\Promotion;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class PromotionHistoryExport implements FromCollection, WithHeadings, WithStyles, WithColumnWidths, WithEvents
{
    use HasCompanyReportLayout;

    private int $rowCount = 0;
    private string $lastCol = 'N';

    public function __construct(
        private ?string $from = null,
        private ?string $to = null,
        private ?int $employeeId = null,
        private ?string $status = null,
        private array $employeeTypeIds = [],
        private Collection $virtualRows = new Collection(),
        private ?string $employeeTypeName = null,
    ) {
    }

    public function collection()
    {
        $query = Promotion::query()->with(['employee.employeeSection', 'approvedBy']);

        if ($this->status && $this->status !== 'all') {
            $query->where('status', $this->status);
        } elseif (!$this->status) {
            $query->where('status', Promotion::STATUS_APPROVED);
        }

        if ($this->from) {
            $query->whereDate('promotion_date', '>=', $this->from);
        }

        if ($this->to) {
            $query->whereDate('promotion_date', '<=', $this->to);
        }

        if ($this->employeeId) {
            $query->where('employee_id', $this->employeeId);
        }

        if ($this->employeeTypeIds) {
            $query->whereHas(
                'employee',
                fn ($q) => $q->whereIn('employee_type_id', $this->employeeTypeIds)
            );
        }

        $rows = collect();

        foreach ($query->orderByDesc('promotion_date')->get() as $promotion) {
            $rows->push([
                'sort' => $promotion->promotion_date,
                'Employee ID' => $promotion->employee->employee_no ?? '',
                'Employee Name' => trim(($promotion->employee->first_name ?? '') . ' ' . ($promotion->employee->last_name ?? '')),
                'Employee Section' => $promotion->employee->employeeSection->name ?? '',
                'Promotion Type' => $promotion->promotion_type,
                'Old Designation' => $promotion->old_designation,
                'New Designation' => $promotion->new_designation,
                'Old Salary' => $promotion->old_salary,
                'New Salary' => $promotion->new_salary,
                'Increment' => $promotion->salary_increment,
                'Promotion Date' => optional($promotion->promotion_date)->format('Y-m-d'),
                'Effective Date' => optional($promotion->effective_date)->format('Y-m-d'),
                'Executed By' => $promotion->approvedBy->name ?? '',
                'Note' => $promotion->note,
            ]);
        }

        foreach ($this->virtualRows as $row) {
            $rows->push([
                'sort' => $row['promotion_date'] ?? null,
                'Employee ID' => $row['employee']['employee_no'] ?? '',
                'Employee Name' => trim(($row['employee']['first_name'] ?? '') . ' ' . ($row['employee']['last_name'] ?? '')),
                'Employee Section' => $row['employee']['employee_section']['name'] ?? '',
                'Promotion Type' => $row['promotion_type'] ?? '',
                'Old Designation' => $row['old_designation'] ?? '',
                'New Designation' => $row['new_designation'] ?? '',
                'Old Salary' => $row['old_salary'] ?? null,
                'New Salary' => $row['new_salary'] ?? null,
                'Increment' => $row['salary_increment'] ?? null,
                'Promotion Date' => $row['promotion_date'] ?? '',
                'Effective Date' => '',
                'Executed By' => '',
                'Note' => $row['note'] ?? '',
            ]);
        }

        $result = $rows
            ->sortByDesc('sort')
            ->values()
            ->map(function (array $row, int $index) {
                unset($row['sort']);
                return ['SL' => $index + 1] + $row;
            });

        $this->rowCount = $result->count();

        return $result;
    }

    public function headings(): array
    {
        return [
            'SL',
            'Employee ID',
            'Employee Name',
            'Employee Section',
            'Promotion Type',
            'Old Designation',
            'New Designation',
            'Old Salary',
            'New Salary',
            'Increment',
            'Promotion Date',
            'Effective Date',
            'Executed By',
            'Note',
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 6,
            'B' => 14,
            'C' => 22,
            'D' => 18,
            'E' => 16,
            'F' => 18,
            'G' => 18,
            'H' => 14,
            'I' => 14,
            'J' => 12,
            'K' => 14,
            'L' => 14,
            'M' => 16,
            'N' => 22,
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'size' => 11],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FFB8CCE4'],
                ],
            ],
        ];
    }

    private function reportTitle(): string
    {
        $monthYear = $this->from
            ? Carbon::parse($this->from)->format('F Y')
            : Carbon::now()->format('F Y');

        $prefix = $this->employeeTypeName ? "{$this->employeeTypeName}'s " : '';

        return "{$prefix}Annual Increment ({$monthYear})";
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $this->applyCompanyReportLayout($sheet, $this->lastCol, $this->reportTitle(), $this->rowCount);
            },
        ];
    }
}
