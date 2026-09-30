<?php

namespace App\Exports\Concerns;

use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;

/**
 * Shared report chrome for xlsx exports: centered company header + title,
 * a bordered data table, and Admin/GM/Director signature boxes at the foot.
 * Used by every export that needs the "BANDHAB TEX LTD" letterhead look.
 */
trait HasCompanyReportLayout
{
    /**
     * @param ?array $extraSignatureLabels When given, an extra row of evenly-spread
     *        signature blocks is drawn above the default Admin/GM/Director footer
     *        (e.g. Payroll's Prepared By/AGM/DGM/GM/Director/Managing Director row).
     *        Callers that omit it get the exact same output as before.
     * @param bool $skipDefaultSignatureFooter Set true to omit the default
     *        Admin/GM/Director row entirely (e.g. Payroll, whose own
     *        $extraSignatureLabels row already covers it — having both is
     *        redundant). Other callers leave this false and are unaffected.
     * @param ?array $leftHeaderLines When given, a small left-aligned block (columns
     *        A..D) is drawn alongside the usual centered company name/address, instead
     *        of one full-width centered cell (e.g. Payroll's "BTL Factory" / "Total Days
     *        of The Month : N" / etc). 2 lines keeps the original 3-row header (company
     *        name + address + title); more lines reserve extra rows so every line gets
     *        its own row, with the title always on the last one. Omitted by every other
     *        caller, which keeps the original single-merge, exactly-3-rows look.
     * @return array{headerRow: int, lastDataRow: int} row numbers the caller's
     *         own per-column styling (date highlights, freeze panes, etc.) should
     *         use, since inserting the header rows shifts everything down by the
     *         same row count returned as headerRow - 1.
     */
    private function applyCompanyReportLayout($sheet, string $lastCol, string $title, int $dataRowCount, ?array $extraSignatureLabels = null, bool $skipDefaultSignatureFooter = false, ?array $leftHeaderLines = null): array
    {
        // Default worksheet gridlines render everywhere, including the header rows,
        // making the letterhead look boxed even though no real border is applied
        // there. Turn them off so only the explicit thin borders below show.
        $sheet->setShowGridlines(false);

        if ($leftHeaderLines) {
            $sheet->getPageSetup()
                ->setOrientation(PageSetup::ORIENTATION_LANDSCAPE)
                ->setPaperSize(PageSetup::PAPERSIZE_A4)
                ->setFitToWidth(1)
                ->setFitToHeight(0);
        }

        $insertedRowCount = $leftHeaderLines ? max(3, count($leftHeaderLines) + 1) : 3;
        $titleRow = $insertedRowCount;

        $sheet->insertNewRowBefore(1, $insertedRowCount);

        $titleStartCol = 'A';
        $titleEndCol = $lastCol;

        if ($leftHeaderLines) {
            $lastColIndex = ord($lastCol) - ord('A') + 1;
            $leftEndColIndex = min(4, max(1, $lastColIndex - 1));
            $leftEndCol = chr(ord('A') + $leftEndColIndex - 1);
            $centerStartCol = chr(ord('A') + $leftEndColIndex);

            $rightStartColIndex = $lastColIndex - $leftEndColIndex + 1;
            $centerEndColIndex = $rightStartColIndex - 1;
            $centerEndCol = $centerEndColIndex > $leftEndColIndex
                ? chr(ord('A') + $centerEndColIndex - 1)
                : $lastCol;

            // Title uses the SAME range as the company name/address below it (not the
            // full A..lastCol width) — otherwise each line centers within a different-
            // width range and their text starts at a different column even though both
            // are "centered", which reads as misaligned rather than as one letterhead.
            $titleStartCol = $centerStartCol;
            $titleEndCol = $centerEndCol;

            foreach ($leftHeaderLines as $i => $line) {
                $row = $i + 1;
                $sheet->mergeCells("A{$row}:{$leftEndCol}{$row}");
                $sheet->setCellValue("A{$row}", $line);
                $sheet->getStyle("A{$row}:{$leftEndCol}{$row}")->applyFromArray([
                    'font' => ['size' => 9],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
                ]);
            }

            $sheet->mergeCells("{$centerStartCol}1:{$centerEndCol}1");
            $sheet->setCellValue("{$centerStartCol}1", 'BANDHAB TEX LTD');
            $sheet->getStyle("{$centerStartCol}1:{$centerEndCol}1")->applyFromArray([
                'font' => ['bold' => true, 'size' => 18],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
            $sheet->getRowDimension(1)->setRowHeight(26);

            $sheet->mergeCells("{$centerStartCol}2:{$centerEndCol}2");
            $sheet->setCellValue("{$centerStartCol}2", 'HeadOffice: Madhabdi bazar, Madhabdi, Narsingdi | Factory: Goalnagar, Meherpara, Panchdona, Narsingdi.');
            $sheet->getStyle("{$centerStartCol}2:{$centerEndCol}2")->applyFromArray([
                'font' => ['size' => 10],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
        } else {
            $sheet->mergeCells("A1:{$lastCol}1");
            $sheet->setCellValue('A1', 'BANDHAB TEX LTD');
            $sheet->getStyle('A1')->applyFromArray([
                'font' => ['bold' => true, 'size' => 18],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
            $sheet->getRowDimension(1)->setRowHeight(26);

            $sheet->mergeCells("A2:{$lastCol}2");
            $sheet->setCellValue('A2', 'HeadOffice: Madhabdi bazar, Madhabdi, Narsingdi | Factory: Goalnagar, Meherpara, Panchdona, Narsingdi.');
            $sheet->getStyle('A2')->applyFromArray([
                'font' => ['size' => 10],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            ]);
        }

        $sheet->mergeCells("{$titleStartCol}{$titleRow}:{$titleEndCol}{$titleRow}");
        $sheet->setCellValue("{$titleStartCol}{$titleRow}", $title);
        $sheet->getStyle("{$titleStartCol}{$titleRow}:{$titleEndCol}{$titleRow}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 13],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getRowDimension($titleRow)->setRowHeight(22);

        $headerRow = $insertedRowCount + 1;
        $lastDataRow = $headerRow + $dataRowCount;

        $sheet->getStyle("A1:{$lastCol}{$titleRow}")->applyFromArray([
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_NONE],
            ],
        ]);

        $sheet->getStyle("A{$headerRow}:{$lastCol}{$lastDataRow}")->applyFromArray([
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['argb' => 'FF000000'],
                ],
            ],
        ]);
        $sheet->getRowDimension($headerRow)->setRowHeight(20);

        $footerAnchorRow = $extraSignatureLabels
            ? $this->applyExtraSignatureRow($sheet, $lastCol, $lastDataRow, $extraSignatureLabels)
            : $lastDataRow;

        if (!$skipDefaultSignatureFooter) {
            $this->applySignatureFooter($sheet, $lastCol, $footerAnchorRow);
        }

        return ['headerRow' => $headerRow, 'lastDataRow' => $lastDataRow];
    }

    /**
     * Evenly spreads $labels (e.g. Prepared By/AGM/DGM/GM/Director/Managing Director)
     * across columns B..$lastCol as their own signature-line row, independent of the
     * fixed 3-block Admin/GM/Director layout in applySignatureFooter().
     *
     * @return int the label row, so the caller can anchor the next footer block below it.
     */
    private function applyExtraSignatureRow($sheet, string $lastCol, int $lastDataRow, array $labels): int
    {
        $lineRow = $lastDataRow + 3;
        $labelRow = $lineRow + 1;

        $lastColIndex = ord($lastCol) - ord('A') + 1;
        $usableCols = $lastColIndex - 1; // columns B..lastCol
        $blockWidth = max(1, intdiv($usableCols, count($labels)));

        $colIndex = 2; // column B
        foreach ($labels as $label) {
            $startCol = chr(ord('A') + $colIndex - 1);
            $endColIndex = min($colIndex + $blockWidth - 1, $lastColIndex);
            $endCol = chr(ord('A') + $endColIndex - 1);

            $sheet->getStyle("{$startCol}{$lineRow}:{$endCol}{$lineRow}")->applyFromArray([
                'borders' => [
                    'bottom' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF000000']],
                ],
            ]);
            $sheet->getRowDimension($lineRow)->setRowHeight(24);

            $sheet->mergeCells("{$startCol}{$labelRow}:{$endCol}{$labelRow}");
            $sheet->setCellValue("{$startCol}{$labelRow}", $label);
            $sheet->getStyle("{$startCol}{$labelRow}:{$endCol}{$labelRow}")->applyFromArray([
                'font' => ['bold' => true],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);

            $colIndex += $blockWidth;
        }

        return $labelRow;
    }

    private function applySignatureFooter($sheet, string $lastCol, int $lastDataRow): void
    {
        $lineRow = $lastDataRow + 3;
        $labelRow = $lineRow + 1;

        $sheet->getStyle("A" . ($lastDataRow + 1) . ":{$lastCol}" . ($lineRow - 1))->applyFromArray([
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_NONE],
            ],
        ]);

        foreach ([['B', 'C', 'Admin'], ['G', 'H', 'GM'], ['L', 'M', 'Director']] as [$startCol, $endCol, $label]) {
            $sheet->getStyle("{$startCol}{$lineRow}:{$endCol}{$lineRow}")->applyFromArray([
                'borders' => [
                    'bottom' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF000000']],
                ],
            ]);
            $sheet->getRowDimension($lineRow)->setRowHeight(24);

            $sheet->mergeCells("{$startCol}{$labelRow}:{$endCol}{$labelRow}");
            $sheet->setCellValue("{$startCol}{$labelRow}", $label);
            $sheet->getStyle("{$startCol}{$labelRow}:{$endCol}{$labelRow}")->applyFromArray([
                'font' => ['bold' => true],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
        }
    }
}
