<?php

namespace App\Exports;

use App\Exports\Concerns\HasCompanyReportLayout;
use App\Models\Store\MaterialReceiptLog;
use App\Models\Store\StockAdjustment;
use App\Services\Store\LotTotalsService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class RawCottonReceivedExport implements FromCollection, WithHeadings, WithMapping, WithStyles, WithColumnWidths, WithEvents
{
    use HasCompanyReportLayout;

    private const LAST_COL = 'X';
    private const OPENING_KG_COL = 'L';
    private const CLOSING_KG_COL = 'X';

    protected array $filters;
    private array $lotTotals = [];
    private int $rowIndex = 0;
    private int $rowCount = 0;

    private float $totalOpeningKg = 0;
    private float $totalClosingKg = 0;

    /** @var array<int, array<int, array{date: string, signed_qty: float}>> stock_adjustments grouped by product_id, sorted ascending by date */
    private array $adjustmentsByProduct = [];

    /** @var array<string, array{bale: float, kg: float}> keyed by origin name, first-seen order */
    private array $originSummary = [];

    private array $productIds = [];
    private float $totalDeliverySalesKg = 0;

    /** @var array<int, float> current (present-day) stock per product_id — the known-good anchor */
    private array $currentStockByProduct = [];

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
    }

    public function collection()
    {
        $query = MaterialReceiptLog::query()
            ->whereHas('product', fn ($product) => $product->where('is_raw_cotton', true))
            ->with([
                'receipt:id,lc_no,supplier_id,receipt_date',
                'receipt.supplier:id,name,origin_id',
                'receipt.supplier.origin:id,name',
                'product:id,product_name,item_code,current_stock,unit_price',
            ]);

        if (!empty($this->filters['from'])) {
            $query->whereDate('created_at', '>=', $this->filters['from']);
        }
        if (!empty($this->filters['to'])) {
            $query->whereDate('created_at', '<=', $this->filters['to']);
        }

        $logs = $query->latest('created_at')->get();
        $this->lotTotals = app(LotTotalsService::class)->totalsByReceiptAndProduct($logs);
        $this->rowCount = $logs->count();
        $this->productIds = $logs->pluck('product_id')->unique()->values()->all();
        $this->buildCurrentStockByProduct($logs);
        $this->buildStockLedger($logs);
        $this->buildSummaries($logs);
        $this->buildDeliverySalesTotal();

        return $logs;
    }

    private function buildCurrentStockByProduct(Collection $logs): void
    {
        foreach ($logs as $log) {
            $productId = $log->product_id;
            if (!isset($this->currentStockByProduct[$productId])) {
                $this->currentStockByProduct[$productId] = (float) ($log->product?->current_stock ?? 0);
            }
        }
    }

    private function buildStockLedger(Collection $logs): void
    {
        if (empty($this->productIds)) {
            return;
        }

        $adjustments = StockAdjustment::query()
            ->whereIn('product_id', $this->productIds)
            ->selectRaw('product_id, adjustment_quantity, `condition`, COALESCE(adjustment_date, DATE(created_at)) as effective_date')
            ->get();

        $grouped = [];
        foreach ($adjustments as $adjustment) {
            $signedQty = $adjustment->condition === 'INCREASED'
                ? (float) $adjustment->adjustment_quantity
                : -(float) $adjustment->adjustment_quantity;

            $grouped[$adjustment->product_id][] = [
                'date' => (string) $adjustment->effective_date,
                'signed_qty' => $signedQty,
            ];
        }

        foreach ($grouped as $productId => $rows) {
            usort($rows, fn (array $a, array $b) => $a['date'] <=> $b['date']);
            $grouped[$productId] = $rows;
        }

        $this->adjustmentsByProduct = $grouped;
    }

    /**
     * Rewinds from the known-good present-day balance (product.current_stock)
     * rather than summing forward from an assumed-zero baseline — the
     * adjustment ledger doesn't reliably capture stock predating its own
     * tracking, so a forward sum drifts negative. Subtracting only the
     * adjustments that happened *after* the cutoff needs no such baseline.
     */
    private function stockAsOf(int $productId, string $date, bool $inclusive): float
    {
        $balance = $this->currentStockByProduct[$productId] ?? 0.0;

        foreach ($this->adjustmentsByProduct[$productId] ?? [] as $row) {
            $isAfterCutoff = $inclusive ? $row['date'] > $date : $row['date'] >= $date;
            if ($isAfterCutoff) {
                $balance -= $row['signed_qty'];
            }
        }

        return $balance;
    }

    private function buildSummaries(Collection $logs): void
    {
        foreach ($logs as $log) {
            $lotKey = $log->material_receipt_id . '_' . $log->product_id;
            $lotTotal = $this->lotTotals[$lotKey] ?? ['bale_quantity' => 0, 'net_weight_kg' => 0];
            $bale = (float) $lotTotal['bale_quantity'];
            $kg = (float) $lotTotal['net_weight_kg'];

            $origin = $log->receipt?->supplier?->origin?->name ?? 'Unknown';

            $this->originSummary[$origin] ??= ['bale' => 0, 'kg' => 0];
            $this->originSummary[$origin]['bale'] += $bale;
            $this->originSummary[$origin]['kg'] += $kg;
        }
    }

    private function buildDeliverySalesTotal(): void
    {
        if (empty($this->productIds)) {
            return;
        }

        $query = StockAdjustment::query()
            ->whereIn('product_id', $this->productIds)
            ->where('reason', 'SALES_DISPATCH');

        if (!empty($this->filters['from'])) {
            $query->whereRaw('COALESCE(adjustment_date, DATE(created_at)) >= ?', [$this->filters['from']]);
        }
        if (!empty($this->filters['to'])) {
            $query->whereRaw('COALESCE(adjustment_date, DATE(created_at)) <= ?', [$this->filters['to']]);
        }

        $this->totalDeliverySalesKg = (float) $query->sum('adjustment_quantity');
    }

    public function map($log): array
    {
        $lotKey = $log->material_receipt_id . '_' . $log->product_id;
        $lotTotal = $this->lotTotals[$lotKey] ?? ['bale_quantity' => 0, 'net_weight_kg' => 0];

        $this->rowIndex++;

        $eventDate = optional($log->created_at)->toDateString();
        $openingStockKg = $eventDate ? $this->stockAsOf($log->product_id, $eventDate, false) : 0.0;
        $closingStockKg = $eventDate ? $this->stockAsOf($log->product_id, $eventDate, true) : 0.0;
        $this->totalOpeningKg += $openingStockKg;
        $this->totalClosingKg += $closingStockKg;

        return [
            'sn'                     => $this->rowIndex,
            'lc_no'                  => $log->receipt?->lc_no,
            'supplier_name'          => $log->receipt?->supplier?->name,
            'origin_name'            => $log->receipt?->supplier?->origin?->name,
            'received_lot_bale'      => $lotTotal['bale_quantity'],
            'received_lot_net_weight_kg' => $lotTotal['net_weight_kg'],
            'rate_per_kg'            => $log->product?->unit_price,
            'avg_rate_per_bale'      => null,
            'last_receiving_date'    => $eventDate,
            'lc_no_short'            => null,
            'opening_stock_bale'     => 0,
            'opening_stock'          => $openingStockKg,
            'received_in_bale'       => 0,
            'received_in_kg'         => 0,
            'issue_to_production_bale' => 0,
            'issue_to_production_kg' => 0,
            'delivery_sales_bale'    => 0,
            'delivery_sales_kg'      => 0,
            'weight_gain_store_kg'   => 0,
            'waste_gain_kg'          => 0,
            'tare_gain_store_kg'     => 0,
            'tare_loss_store_kg'     => 0,
            'stock_in_bale'          => 0,
            'closing_stock_kg'       => $closingStockKg,
        ];
    }

    public function headings(): array
    {
        return [
            'SN',
            'L/C No',
            'Name of Supplier',
            'Name of Origin',
            'Received Lot (Bale)',
            'Received Lot Net Weight (Kg)',
            'Rate in $ (USD)',
            'Avg Wt. per Bale (Kg)',
            'Last Receiving Date',
            'L/C No (Short)',
            'Opening Stock (In Bale)',
            'Opening Stock (In Kg)',
            'Received (In Bale)',
            'Received (In Kg)',
            'Issue to Prod. (In Bale)',
            'Issue to Prod. (In Kg)',
            'Delivery/Sales (Bale)',
            'Delivery/Sales (Kg)',
            'Weight Gain (Kg)',
            'Weight Short (Kg)',
            'Tare Gain (Kg)',
            'Tare Loss (Kg)',
            'Closing Stock (In Bale)',
            'Closing Stock (In Kg)',
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 6,
            'B' => 18,
            'C' => 22,
            'D' => 18,
            'E' => 18,
            'F' => 24,
            'G' => 16,
            'H' => 20,
            'I' => 18,
            'J' => 16,
            'K' => 22,
            'L' => 20,
            'M' => 18,
            'N' => 16,
            'O' => 22,
            'P' => 22,
            'Q' => 20,
            'R' => 20,
            'S' => 16,
            'T' => 16,
            'U' => 16,
            'V' => 16,
            'W' => 20,
            'X' => 22,
        ];
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
        ];
    }

    private function reportTitle(): string
    {
        $title = 'Daily Raw Cotton Received Consumption & Stock Report';

        if (empty($this->filters['from']) || empty($this->filters['to'])) {
            return $title;
        }

        $from = Carbon::parse($this->filters['from'])->format('d-M-y');
        $to = Carbon::parse($this->filters['to'])->format('d-M-y');

        return $from === $to
            ? "{$title} (Date: {$from})"
            : "{$title} (From {$from} To {$to})";
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();

                ['headerRow' => $headerRow] = $this->applyCompanyReportLayout(
                    $sheet,
                    self::LAST_COL,
                    $this->reportTitle(),
                    $this->rowCount + 1,
                    null,
                    true, 
                );

                $sheet->getStyle('A' . $headerRow)->applyFromArray([
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                ]);
                $sheet->freezePane('A' . ($headerRow + 1));

                $totalRow = $headerRow + $this->rowCount + 1;

                $this->writeTotalRow($sheet, $totalRow);

                $summaryEndRow = $this->writeSummaryTables($sheet, $totalRow);

                $this->applySignatureFooter($sheet, self::LAST_COL, $summaryEndRow);
            },
        ];
    }

    private function writeTotalRow(Worksheet $sheet, int $totalRow): void
    {
        $sheet->mergeCells("A{$totalRow}:J{$totalRow}");
        $sheet->setCellValue("A{$totalRow}", 'Total');
        $sheet->setCellValue(self::OPENING_KG_COL . $totalRow, $this->totalOpeningKg);
        $sheet->setCellValue(self::CLOSING_KG_COL . $totalRow, $this->totalClosingKg);

        $sheet->getStyle("A{$totalRow}:" . self::LAST_COL . "{$totalRow}")->applyFromArray([
            'font' => ['bold' => true],
        ]);
        $sheet->getStyle("A{$totalRow}")->applyFromArray([
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_RIGHT],
        ]);
    }

    /**
     * "Summary of Issue" and "Summary of Received" — origin-wise, side by side
     * below the main table, matching the paper report's own table names.
     * Received figures come from buildSummaries() (real, pre-summed in PHP so
     * they render immediately in any viewer); Issue has no source table yet,
     * so it lists the same origins with blank Bale/Kg rather than a fabricated
     * number.
     *
     * @return int the last row used, so the caller can anchor the signature footer.
     */
    private function writeSummaryTables(Worksheet $sheet, int $totalRow): int
    {
        $titleRow = $totalRow + 3;

        $leftLastRow = $this->writeOriginStockSummaryTable($sheet, $titleRow);
        $rightLastRow = $this->writeRightSummaryBox($sheet, $titleRow);

        return max($leftLastRow, $rightLastRow);
    }

    private function writeOriginStockSummaryTable(Worksheet $sheet, int $titleRow): int
    {
        $labelStartCol = 'A';
        $labelEndCol = 'E';
        $baleCol = 'F';
        $kgCol = 'G';
        $headerRow = $titleRow + 1;

        $sheet->mergeCells("{$labelStartCol}{$titleRow}:{$kgCol}{$titleRow}");
        $sheet->setCellValue("{$labelStartCol}{$titleRow}", 'Origin wise Raw Cotton Stock Summary');

        $sheet->mergeCells("{$labelStartCol}{$headerRow}:{$labelEndCol}{$headerRow}");
        $sheet->setCellValue("{$labelStartCol}{$headerRow}", 'Origin');
        $sheet->setCellValue("{$baleCol}{$headerRow}", 'Bale');
        $sheet->setCellValue("{$kgCol}{$headerRow}", 'Kg');

        $row = $headerRow;
        foreach (array_keys($this->originSummary) as $origin) {
            $row++;
            $sheet->mergeCells("{$labelStartCol}{$row}:{$labelEndCol}{$row}");
            $sheet->setCellValue("{$labelStartCol}{$row}", "{$origin} Raw Cotton");
        }

        $totalRow = $row + 1;
        $sheet->mergeCells("{$labelStartCol}{$totalRow}:{$labelEndCol}{$totalRow}");
        $sheet->setCellValue("{$labelStartCol}{$totalRow}", 'Total');
        $sheet->getStyle("{$labelStartCol}{$totalRow}:{$kgCol}{$totalRow}")->applyFromArray([
            'font' => ['bold' => true],
        ]);

        $sheet->getStyle("{$labelStartCol}{$titleRow}:{$kgCol}{$titleRow}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 11],
        ]);
        $sheet->getStyle("{$labelStartCol}{$headerRow}:{$kgCol}{$headerRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFB8CCE4']],
        ]);
        $sheet->getStyle("{$labelStartCol}{$headerRow}:{$kgCol}{$totalRow}")->applyFromArray([
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF000000']]],
        ]);

        return $totalRow;
    }

    private function writeRightSummaryBox(Worksheet $sheet, int $titleRow): int
    {
        $rawCottonHeaderRow = $titleRow + 1;

        $sheet->setCellValue("I{$titleRow}", 'Summary of Issue');
        $sheet->setCellValue("J{$titleRow}", 'Bale');
        $sheet->setCellValue("K{$titleRow}", 'Kg');

        $sheet->setCellValue("M{$titleRow}", 'Summary of Received');
        $sheet->setCellValue("N{$titleRow}", 'Bale');
        $sheet->setCellValue("O{$titleRow}", 'Kg');

        $sheet->mergeCells("Q{$titleRow}:X{$titleRow}");
        $sheet->setCellValue("Q{$titleRow}", $this->rawCottonSummaryTitle());

        $sheet->mergeCells("Q{$rawCottonHeaderRow}:V{$rawCottonHeaderRow}");
        $sheet->setCellValue("Q{$rawCottonHeaderRow}", 'Description');
        $sheet->setCellValue("W{$rawCottonHeaderRow}", 'Bale');
        $sheet->setCellValue("X{$rawCottonHeaderRow}", 'Kg');

        $issueLastRow = $this->writeBlankSummaryGroup($sheet, array_keys($this->originSummary), $titleRow, 'I', 'K');
        $receivedLastRow = $this->writeSummaryGroup($sheet, $this->originSummary, $titleRow, 'M', 'N', 'O');
        $rawCottonLastRow = $this->writeRawCottonSummaryRows($sheet, $rawCottonHeaderRow);

        $lastRow = max($issueLastRow, $receivedLastRow, $rawCottonLastRow);

        $sheet->getStyle("I{$titleRow}:K{$titleRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFB8CCE4']],
        ]);
        $sheet->getStyle("M{$titleRow}:O{$titleRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFB8CCE4']],
        ]);
        $sheet->getStyle("Q{$titleRow}:X{$titleRow}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 11],
        ]);
        $sheet->getStyle("Q{$rawCottonHeaderRow}:X{$rawCottonHeaderRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFB8CCE4']],
        ]);

        // Each group's border ends at its own last row — not the tallest
        // sibling's — so a shorter table doesn't get padded with blank
        // bordered rows to match a taller one.
        $sheet->getStyle("I{$titleRow}:K{$issueLastRow}")->applyFromArray([
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF000000']]],
        ]);
        $sheet->getStyle("M{$titleRow}:O{$receivedLastRow}")->applyFromArray([
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF000000']]],
        ]);
        $sheet->getStyle("Q{$titleRow}:X{$rawCottonLastRow}")->applyFromArray([
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF000000']]],
        ]);

        return $lastRow;
    }

    private function rawCottonSummaryTitle(): string
    {
        $title = 'Summary of Raw Cotton';

        if (empty($this->filters['from']) || empty($this->filters['to'])) {
            return $title;
        }

        $from = Carbon::parse($this->filters['from'])->format('d-M-y');
        $to = Carbon::parse($this->filters['to'])->format('d-M-y');

        return "{$title} From {$from} To {$to}";
    }

    private function writeRawCottonSummaryRows(Worksheet $sheet, int $headerRow): int
    {
        $totalReceivedKg = array_sum(array_column($this->originSummary, 'kg'));

        $rows = [
            'Opening Stock'  => $this->totalOpeningKg,
            'Total Received' => $totalReceivedKg,
            'Total Issued'   => null,
            'Tare Gain'      => null,
            'Weight Loss'    => null,
            'Weight Gain'    => null,
            'Tare Loss'      => null,
            'Delivery/Sales' => $this->totalDeliverySalesKg,
            'Closing Stock'  => $this->totalClosingKg,
        ];

        $row = $headerRow;
        foreach ($rows as $label => $kgValue) {
            $row++;
            $sheet->mergeCells("Q{$row}:V{$row}");
            $sheet->setCellValue("Q{$row}", $label);
            if ($kgValue !== null) {
                $sheet->setCellValue("X{$row}", $kgValue);
            }
        }

        return $row;
    }

    /**
     * @param array<string, array{bale: float, kg: float}> $summary
     */
    private function writeSummaryGroup(
        Worksheet $sheet,
        array $summary,
        int $headerRow,
        string $labelCol,
        string $baleCol,
        string $kgCol
    ): int {
        $row = $headerRow;
        $totalBale = 0;
        $totalKg = 0;

        foreach ($summary as $label => $values) {
            $row++;
            $sheet->setCellValue("{$labelCol}{$row}", $label);
            $sheet->setCellValue("{$baleCol}{$row}", $values['bale']);
            $sheet->setCellValue("{$kgCol}{$row}", $values['kg']);
            $totalBale += $values['bale'];
            $totalKg += $values['kg'];
        }

        $totalRow = $row + 1;
        $sheet->setCellValue("{$labelCol}{$totalRow}", 'Total');
        $sheet->setCellValue("{$baleCol}{$totalRow}", $totalBale);
        $sheet->setCellValue("{$kgCol}{$totalRow}", $totalKg);
        $sheet->getStyle("{$labelCol}{$totalRow}:{$kgCol}{$totalRow}")->applyFromArray([
            'font' => ['bold' => true],
        ]);

        return $totalRow;
    }

    /**
     * Lists $labels with blank Bale/Kg cells — for a summary whose source
     * data doesn't exist yet, so it shows the real row labels without a
     * fabricated number.
     *
     * @param string[] $labels
     */
    private function writeBlankSummaryGroup(
        Worksheet $sheet,
        array $labels,
        int $headerRow,
        string $labelCol,
        string $kgCol
    ): int {
        $row = $headerRow;

        foreach ($labels as $label) {
            $row++;
            $sheet->setCellValue("{$labelCol}{$row}", $label);
        }

        $totalRow = $row + 1;
        $sheet->setCellValue("{$labelCol}{$totalRow}", 'Total');
        $sheet->getStyle("{$labelCol}{$totalRow}:{$kgCol}{$totalRow}")->applyFromArray([
            'font' => ['bold' => true],
        ]);

        return $totalRow;
    }
}
