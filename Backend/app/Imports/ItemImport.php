<?php

namespace App\Imports;

use App\Models\Product;
use App\Models\ItemCategory;
use App\Models\Uom;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class ItemImport  implements ToModel, WithHeadingRow, WithChunkReading
{
    public function model(array $row)
    {
        $categoryName = $row['name_ledger'] ?? null;
        $product_name = $row['name'] ?? null;

        if (!empty($categoryName)) {
            $category = ItemCategory::where('name', $categoryName)->first();
            if ($category) {
                $category_id = $category->id;
            }else{
                if (!empty($row['material_code'])) {
                    // Get everything before the first dash
                    $parts = explode('-', $row['material_code']);
                    $prefix = $parts[0] ?? null;
                }
                $newCategory = new ItemCategory();
                $newCategory->name = $categoryName;
                $newCategory->prefix = $prefix;
                $newCategory->is_active = true;
                $newCategory->save();
                $category_id = $newCategory->id;              
            }

            $uom = $row['unit'] ?? null;
            if ($uom) {
                $uomRecord = UOM::where('name', $uom)->first();
                if ($uomRecord) {
                    $uom_id = $uomRecord->id;
                } else {
                    $newUom = new UOM();
                    $newUom->name = $uom;
                    $newUom->save();
                    $uom_id = $newUom->id;
                }
            } else {
                $uom_id = null;
            }

            if(!empty($product_name)){
                $existingProduct = Product::where('product_name', $product_name)
                    ->where('model_number', $row['model_number'])
                    ->first();
                if ($existingProduct) {
                    $existingProduct->uom_id = $uom_id;
                    $existingProduct->item_category_id = $category_id;
                    $existingProduct->unit_price = $row['rate'] ?? null;
                    $existingProduct->save();
                    return null;
                }else{
                    return new Product([
                        'parent_id' => null,
                        'is_active' => true,
                        'item_code' => $row['material_code'] ?? null,
                        'rack_no' => $row['rack_no'] ?? null,
                        'current_stock' => $row['current_stock'] ?? null,
                        'is_variant' => false,
                        'is_parent' => true,
                        'variant_value' => null,
                        'is_sellable' => false,    
                        'product_name' => $product_name,
                        'item_category_id' => $category_id,
                        'part_number' =>  null,
                        'model_number' => $row['model_number'] ?? null,
                        'price_in_bdt' =>  null,
                        'price_in_usd' => null,
                        'unit_price' => $row['rate'] ?? null,
                        'uom_id' => $uom_id,
                        'currency' => 'BDT',
                        'description' => null,
                        'revision' => null,
                        'target_cycle_time' => null,
                    ]);

                }
            }
        }       
    }

    public function chunkSize(): int
    {
        return 2000;
    }

}
