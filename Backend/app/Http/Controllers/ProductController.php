<?php

namespace App\Http\Controllers;

use App\Models\IdGeneratorSetting;
use App\Models\ProductHasvariant;
use Haruncpi\LaravelIdGenerator\IdGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Models\Product;
use Illuminate\Database\QueryException;

class ProductController extends Controller
{
    public function productAssociate(Request $request)
    {
        DB::beginTransaction();
        try {
            $product = Product::findOrFail($request->product_id);

            $categoryId = $request->category_id;

            if (!$request->has('suppliers') || !is_array($request->suppliers)) {
                return response()->json(['error' => 'Invalid suppliers data'], 400);
            }
            if (!$request->has('clients') || !is_array($request->clients)) {
                return response()->json(['error' => 'Invalid clients data'], 400);
            }
            if (!$request->has('productTypes') || !is_array($request->productTypes)) {
                return response()->json(['error' => 'Invalid productTypes data'], 400);
            }
            if (! $request->category_id) {
                return response()->json(['error' => 'Invalid itemCategories data', 'data' => $request->all()], 400);
            }
            if (!$request->has('plants') || !is_array($request->plants)) {
                return response()->json(['error' => 'Invalid plants data'], 400);
            }

            $product->plants()->sync(collect($request->plants)->pluck('id'));
            $product->clients()->sync(collect($request->clients)->pluck('id'));
            $product->suppliers()->sync(collect($request->suppliers)->pluck('id'));
            // *** Disabled as per new requirement

            // $product->productTypes()->sync(collect($request->productTypes)->pluck('id'));

            $product->itemCategories()->sync($categoryId);
            // *** Disabled as per new requirement
            
            // if ($request->category_id) {
            //     $categoryIds = collect($request->itemSubCategories)
            //         ->pluck('category_id')
            //         ->unique()
            //         ->toArray();

            //     DB::table('product_has_subcategory')
            //         ->where('product_id', $product->id)
            //         ->whereIn('category_id', $categoryIds)
            //         ->delete();


            //     foreach ($request->itemSubCategories as $subcategory) {
            //         if (isset($subcategory['id']) && isset($subcategory['category_id'])) {
            //             DB::table('product_has_subcategory')->insert([
            //                 'product_id' => $product->id,
            //                 'category_id' => $subcategory['category_id'],
            //                 'subcategory_id' => $subcategory['id'],
            //                 'created_at' => now(),
            //                 'updated_at' => now(),
            //             ]);
            //         }
            //     }
            // }

            DB::commit();

            return response()->json([
                'message' => 'Associations assigned successfully',
                'product' => $product
            ], 200);
        } catch (QueryException $e) {
            DB::rollBack();
            return response()->json(['error' => 'Database error', 'details' => $e->getMessage()], 500);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    public function deleteByProduct($product_id)
    {
        ProductHasvariant::where('product_id', $product_id)->delete();
        return response()->json(['status' => 'success']);
    }

}
