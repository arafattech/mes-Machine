<?php

namespace App\Exports;

use App\Exports\Concerns\HasCompanyReportLayout;
use App\Models\SideBill;
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

class SideBillsExport implements FromArray, WithHeadings, WithStyles, WithColumnWidths, WithEvents
{
    use HasCompanyReportLayout;

    protected array $filters;
    protected array $dates = [];
    protected array $rows  = [];

    // Fixed left columns count: SL, Emp No, Name, Section, Shift, Department, Designation, Machine Group, Current Machine, Side Machine, Side, Status
    private int $fixedCols = 12;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
        $this->build();
    }

    protected function build(): void
    {
        $bills = SideBill::with([
                'employee.employeeSection',
                'shift',
                'machineGroup',
                'currentWorkingMachine',
                'sideWorkingMachine',
            ])
            ->when(!empty($this->filters['employee_id']), fn($q) => $q->where('employee_id', $this->filters['employee_id']))
            ->when(!empty($this->filters['from']),        fn($q) => $q->whereDate('side_bill_date', '>=', $this->filters['from']))
            ->when(!empty($this->filters['to']),          fn($q) => $q->whereDate('side_bill_date', '<=', $this->filters['to']))
            ->orderBy('employee_id')
            ->orderBy('side_bill_date')
            ->get();

        // All dates in the filter range (every day from→to)
        if (!empty($this->filters['from']) && !empty($this->filters['to'])) {
            $start = Carbon::parse($this->filters['from'])->startOfDay();
            $end   = Carbon::parse($this->filters['to'])->startOfDay();
            $dates = [];
            for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
                $dates[] = $d->format('Y-m-d');
            }
            $this->dates = $dates;
        } else {
            $this->dates = $bills
                ->map(fn($b) => Carbon::parse($b->side_bill_date)->format('Y-m-d'))
                ->unique()->sort()->values()->toArray();
        }

        $byEmployee = $bills->groupBy('employee_id');

        $sl = 0;
        foreach ($byEmployee as $empBills) {
            $sl++;
            $first = $empBills->first();
            $emp   = $first->employee;

            $countByDate = $empBills
                ->groupBy(fn($b) => Carbon::parse($b->side_bill_date)->format('Y-m-d'))
                ->map->count();

            $totalAmount = $empBills->sum('amount');

            $allPaid = $empBills->every(fn($b) => $b->status === 'PAID');
            $status  = $allPaid ? 'PAID' : '';

            // Left fixed columns
            $row = [
                $sl,
                $emp->employee_no ?? '',
                trim(($emp->first_name ?? '') . ' ' . ($emp->last_name ?? '')),
                $emp->employeeSection->name ?? '',
                $first->shift->name ?? '',
                $emp->department ?? '',
                $emp->designation ?? '',
                $first->machineGroup->name ?? '',
                $first->currentWorkingMachine->machine_name ?? '',
                $first->sideWorkingMachine->machine_name ?? '',
                $first->side ?? '',
                $status,
            ];

            // Date frequency columns
            foreach ($this->dates as $date) {
                $row[] = $countByDate[$date] ?? 0;
            }

            // Trailing columns: Amount | Remarks | Signature
            $row[] = $totalAmount;
            $row[] = ''; // Remarks
            $row[] = ''; // Signature

            $this->rows[] = $row;
        }
    }

    public function array(): array
    {
        return $this->rows;
    }

    public function headings(): array
    {
        $fixed = ['SL', 'Emp No', 'Name', 'Section', 'Shift', 'Department', 'Designation', 'Machine Group', 'Current Machine', 'Side Machine', 'Side', 'Status'];

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
            'H' => 18,  // Machine Group
            'I' => 20,  // Current Machine
            'J' => 20,  // Side Machine
            'K' => 10,  // Side
            'L' => 10,  // Status
        ];

        foreach (array_keys($this->dates) as $i) {
            $col           = Coordinate::stringFromColumnIndex($this->fixedCols + 1 + $i);
            $widths[$col]  = 7;
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
            'K' => ['alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]],
            'L' => ['alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]],
        ];
    }

    private function reportDateRangeLabel(): string
    {
        if (!empty($this->filters['from']) && !empty($this->filters['to'])) {
            $from = Carbon::parse($this->filters['from'])->format('d/m/Y');
            $to   = Carbon::parse($this->filters['to'])->format('d/m/Y');
            return "Side Bill Report ({$from} to {$to})";
        }

        return 'Side Bill Report (' . Carbon::now()->format('F Y') . ')';
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet      = $event->sheet->getDelegate();
                $dateCount  = count($this->dates);
                $totalCols  = $this->fixedCols + $dateCount + 3; // +Amount+Remarks+Signature
                $lastCol    = Coordinate::stringFromColumnIndex($totalCols);

                ['headerRow' => $headerRow, 'lastDataRow' => $totalRows] = $this->applyCompanyReportLayout(
                    $sheet,
                    $lastCol,
                    $this->reportDateRangeLabel(),
                    count($this->rows),
                );

                // Date columns: yellow bg + centered
                for ($i = 0; $i < $dateCount; $i++) {
                    $col = Coordinate::stringFromColumnIndex($this->fixedCols + 1 + $i);
                    $sheet->getStyle("{$col}{$headerRow}:{$col}{$totalRows}")->applyFromArray([
                        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                        'fill'      => [
                            'fillType'   => Fill::FILL_SOLID,
                            'startColor' => ['argb' => 'FFFFF2CC'],
                        ],
                    ]);
                }

                // Amount column header: light green bg
                $amountCol = Coordinate::stringFromColumnIndex($this->fixedCols + $dateCount + 1);
                $sheet->getStyle("{$amountCol}{$headerRow}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE2EFDA']],
                ]);

                // Signature column header: blue bg
                $sigCol = Coordinate::stringFromColumnIndex($totalCols);
                $sheet->getStyle("{$sigCol}{$headerRow}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD9E1F2']],
                ]);

                $sheet->freezePane('A' . ($headerRow + 1));
                $sheet->getRowDimension($headerRow)->setRowHeight(20);
            },
        ];
    }
}
