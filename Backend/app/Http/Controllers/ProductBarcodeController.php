<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;
use PDF;
use Milon\Barcode\DNS1D;

class ProductBarcodeController extends Controller
{
    public function generateBarcodePdf(Request $request)
    {
        $product = Product::find($request->product_id);

        if (!$product || !$product->item_code) {
            return response()->json(['error' => 'Product not found or custom_id missing'], 404);
        }

        $barcode = (new DNS1D)->getBarcodeHTML($product->item_code, 'C128', 2, 50);

        $pdf = PDF::loadView('barcode-pdf', [
            'barcode' => $barcode,
            'item_code' => $product->item_code,
        ]);

        return $pdf->download("barcode_{$product->item_code}.pdf");
    }
}
