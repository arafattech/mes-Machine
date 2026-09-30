<?php

namespace App\Exports;

use App\Models\Product;
use App\Models\Store\MaterialReceiptItem;
use App\Models\Store\MrrReturnItem;
use App\Models\Store\PurchaseRequisitionItem;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class StockLedgerExport implements FromCollection, WithHeadings, WithMapping
{
    public function collection()
    {
        return Product::query()
            ->with(['uom:id,name', 'category:id,name'])
            ->select('products.*')
            ->selectSub(
                MaterialReceiptItem::query()
                    ->selectRaw('COALESCE(SUM(received_quantity), 0)')
                    ->whereColumn('product_id', 'products.id'),
                'mrr'
            )
            ->selectSub(
                MaterialReceiptItem::query()
                    ->selectRaw('COALESCE(SUM(rejected_quantity), 0)')
                    ->whereColumn('product_id', 'products.id'),
                'rejected'
            )
            ->selectSub(
                PurchaseRequisitionItem::query()
                    ->join('purchase_requisitions', 'purchase_requisitions.id', '=', 'purchase_requisition_items.spr_id')
                    ->where('purchase_requisitions.type', 'SR')
                    ->whereColumn('purchase_requisition_items.product_id', 'products.id')
                    ->selectRaw('COALESCE(SUM(purchase_requisition_items.received_quantity), 0)'),
                'sr'
            )
            ->selectSub(
                MrrReturnItem::query()
                    ->selectRaw('COALESCE(SUM(returned_quantity), 0)')
                    ->whereColumn('product_id', 'products.id'),
                'returned'
            )
            ->orderBy('product_name')
            ->get();
    }

    public function headings(): array
    {
        return [
            'Name of Ladger',
            'Material Code',
            'Name of the Material with size',
            'Unit',
            'Opening Stock',
            'MRR',
            'SR',
            'SRM',
            'Rejected',
            'Returned',
            'Current Stock',
            'Rate Per Unit',
            'Amount',
            'Rack No',
        ];
    }

    public function map($product): array
    {
        $rate = (float) ($product->unit_price ?? 0);

        return [
            optional($product->category)->name ?? '',
            $product->item_code,
            $product->model_number
                ? "{$product->product_name} ({$product->model_number})"
                : $product->product_name,
            optional($product->uom)->name ?? '',
            $product->opening_stock,
            $product->mrr,
            $product->sr,
            0, // SRM — no source of truth yet, see StockLedgerController
            $product->rejected,
            $product->returned,
            $product->current_stock,
            $rate,
            round(((float) $product->current_stock) * $rate, 2),
            $product->rack_no,
        ];
    }
}
