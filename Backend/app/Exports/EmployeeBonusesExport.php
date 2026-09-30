<?php

namespace App\Exports;

use App\Models\EmployeeBonus;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

class EmployeeBonusesExport implements FromArray, WithHeadings, WithStyles, WithColumnWidths, WithEvents
{
    protected array $filters;
    protected array $dates = [];
    protected array $rows  = [];

    private int $fixedCols = 8;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
        $this->build();
    }

    protected function build(): void
    {
        $bonuses = EmployeeBonus::with([
                'employee.employeeSection',
                'shift',
            ])
            ->when(!empty($this->filters['emp_id']),     fn($q) => $q->where('emp_id', $this->filters['emp_id']))
            ->when(!empty($this->filters['bonus_type']), fn($q) => $q->where('bonus_type', $this->filters['bonus_type']))
            ->when(!empty($this->filters['from']),       fn($q) => $q->whereDate('attendance_date', '>=', $this->filters['from']))
            ->when(!empty($this->filters['to']),         fn($q) => $q->whereDate('attendance_date', '<=', $this->filters['to']))
            ->orderBy('emp_id')
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
            $this->dates = $bonuses
                ->map(fn($b) => Carbon::parse($b->attendance_date)->format('Y-m-d'))
                ->unique()->sort()->values()->toArray();
        }

        $byEmployee = $bonuses->groupBy('emp_id');

        $sl = 0;
        foreach ($byEmployee as $empBonuses) {
            $sl++;
            $first = $empBonuses->first();
            $emp   = $first->employee;

            $countByDate = $empBonuses
                ->groupBy(fn($b) => Carbon::parse($b->attendance_date)->format('Y-m-d'))
                ->map(fn($group) => $group->sum('amount'));

            $totalAmount = $empBonuses->sum('amount');

            $allPaid = $empBonuses->every(fn($b) => $b->status === 'PAID');
            $status  = $allPaid ? 'PAID' : '';

            $row = [
                $sl,
                $emp->employee_no ?? '',
                trim(($emp->first_name ?? '') . ' ' . ($emp->last_name ?? '')),
                $emp->employeeSection->name ?? '',
                $first->shift->name ?? '',
                $emp->department ?? '',
                $emp->designation ?? '',
                $status,
            ];

            foreach ($this->dates as $date) {
                $row[] = $countByDate[$date] ?? 0;
            }

            $row[] = $totalAmount;
            $row[] = '';
            $row[] = '';

            $this->rows[] = $row;
        }
    }

    public function array(): array
    {
        return $this->rows;
    }

    public function headings(): array
    {
        $fixed = ['SL', 'Emp No', 'Name', 'Section', 'Shift', 'Department', 'Designation', 'Status'];

        $dateHeaders = array_map(fn($d) => Carbon::parse($d)->format('d/m'), $this->dates);

        return array_merge($fixed, $dateHeaders, ['Amount', 'Remarks', 'Signature']);
    }

    public function columnWidths(): array
    {
        $widths = [
            'A' => 5,   // SL
            'B' => 12,  // Emp No
            'C' => 22,  // Name
            'D' => 18,  // Section
            'E' => 16,  // Shift
            'F' => 18,  // Department
            'G' => 18,  // Designation
            'H' => 10,  // Status
        ];

        foreach (array_keys($this->dates) as $i) {
            $col          = Coordinate::stringFromColumnIndex($this->fixedCols + 1 + $i);
            $widths[$col] = 7;
        }

        $afterDates = $this->fixedCols + count($this->dates);
        $widths[Coordinate::stringFromColumnIndex($afterDates + 1)] = 12; // Amount
        $widths[Coordinate::stringFromColumnIndex($afterDates + 2)] = 22; // Remarks
        $widths[Coordinate::stringFromColumnIndex($afterDates + 3)] = 22; // Signature

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
            'H' => ['alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet     = $event->sheet->getDelegate();
                $totalRows = count($this->rows) + 1;
                $dateCount = count($this->dates);
                $totalCols = $this->fixedCols + $dateCount + 3;

                $lastCol = Coordinate::stringFromColumnIndex($totalCols);
                $range   = "A1:{$lastCol}{$totalRows}";

                $sheet->getStyle($range)->applyFromArray([
                    'borders' => [
                        'allBorders' => [
                            'borderStyle' => Border::BORDER_THIN,
                            'color'       => ['argb' => 'FF000000'],
                        ],
                    ],
                ]);

                for ($i = 0; $i < $dateCount; $i++) {
                    $col = Coordinate::stringFromColumnIndex($this->fixedCols + 1 + $i);
                    if ($totalRows > 1) {
                        $sheet->getStyle("{$col}2:{$col}{$totalRows}")->applyFromArray([
                            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                            'fill'      => [
                                'fillType'   => Fill::FILL_SOLID,
                                'startColor' => ['argb' => 'FFFFF2CC'],
                            ],
                        ]);
                    }
                }

                $amountCol = Coordinate::stringFromColumnIndex($this->fixedCols + $dateCount + 1);
                $sheet->getStyle("{$amountCol}1")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE2EFDA']],
                ]);

                $sigCol = Coordinate::stringFromColumnIndex($totalCols);
                $sheet->getStyle("{$sigCol}1")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD9E1F2']],
                ]);

                $sheet->freezePane('A2');
                $sheet->getRowDimension(1)->setRowHeight(20);
            },
        ];
    }
}
