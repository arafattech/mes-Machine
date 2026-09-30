<?php

namespace App\Exports;

use App\Exports\Concerns\HasCompanyReportLayout;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class RostersExport implements FromCollection, WithHeadings, WithColumnFormatting, WithStyles, WithEvents
{
    use HasCompanyReportLayout;

    protected array $schedule;
    protected array $filters;
    private int $rowCount = 0;
    private string $lastCol = 'Q';

    public function __construct(array $schedule = [], array $filters = [])
    {
        $this->schedule = $schedule;
        $this->filters = $filters;
    }

    public function collection()
    {
        $rows = collect();
        $rowCount = 1;

        foreach ($this->schedule as $day) {
            $dayLabel = $day['day'] ?? '';
            $dayName = $dayLabel ? Carbon::parse($dayLabel)->format('l') : '';
            $dayValue = $dayLabel ? ExcelDate::dateTimeToExcel(Carbon::parse($dayLabel)->startOfDay()) : '';
            $shifts = $day['shifts'] ?? [];

            foreach ($shifts as $shift) {
                $employees = $shift['employees'] ?? [];

                if (empty($employees)) {
                    $rows->push([
                        $rowCount++,
                        $dayValue,
                        $dayName,
                        $shift['shift_name'] ?? '',
                        $shift['group'] ?? '',
                        $shift['start_time'] ?? '',
                        $shift['end_time'] ?? '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        'No Assignment',
                        '',
                        '',
                        '',
                        '',
                    ]);
                    continue;
                }

                foreach ($employees as $employee) {
                    $details = $employee['employee_details'] ?? [];
                    $override = $employee['override_info'] ?? [];

                    $rows->push([
                        $rowCount++,
                        $dayValue,
                        $dayName,
                        $shift['shift_name'] ?? '',
                        $shift['group'] ?? '',
                        $shift['start_time'] ?? '',
                        $shift['end_time'] ?? '',
                        $details['employee_no'] ?? '',
                        $details['custom_id'] ?? '',
                        $details['name'] ?? '',
                        $details['department'] ?? '',
                        $details['designation'] ?? '',
                        $employee['status'] ?? 'Regular',
                        $details['holiday_status'] ?? '',
                        $override['type'] ?? '',
                        $override['absent_employee']['name'] ?? '',
                        $override['replacement_employee']['name'] ?? '',
                    ]);
                }
            }
        }

        $this->rowCount = $rows->count();

        return $rows;
    }

    public function headings(): array
    {
        return [
            'SL',
            'Date',
            'Day Name',
            'Shift Name',
            'Group',
            'Start Time',
            'End Time',
            'Employee No',
            'Custom ID',
            'Employee Name',
            'Department',
            'Designation',
            'Assignment Status',
            'Holiday Status',
            'Override Type',
            'Absent Employee',
            'Replacement Employee',
        ];
    }

    public function columnFormats(): array
    {
        return [
            'B' => 'dd/mm/yyyy',
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
        if (!empty($this->filters['start_date']) && !empty($this->filters['end_date'])) {
            $from = Carbon::parse($this->filters['start_date'])->format('d/m/Y');
            $to = Carbon::parse($this->filters['end_date'])->format('d/m/Y');
            return "Roster Report ({$from} to {$to})";
        }

        return 'Roster Report (' . Carbon::now()->format('F Y') . ')';
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
