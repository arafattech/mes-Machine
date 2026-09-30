<?php

namespace App\Exports;

use App\Models\Product;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ItemExport implements FromCollection, WithHeadings, WithMapping
{
    protected array $filters;
    private int $rowCount = 0;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
    }

    public function collection()
    {
         $query = Product::query()
            ->with(['category:id,name', 'uom:id,name']);

        return $query->get();
    }

    public function headings(): array
    {
        return [
            'Category',
            'Item Code',
            'Item Name',
            'Model',
            'Part Number',
            'Unit (UOM)',
            'Rate',
        ];
    }

    public function map($item): array
    {
        $this->rowCount++;

        return [
            optional($item->category)->name ?? '',
            $item->item_code,
            $item->product_name,
            $item->model_number,
            $item->part_number,
            optional($item->uom)->name ?? '',
            $item->unit_price,
        ];
    }
}