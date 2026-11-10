<?php

namespace App\Http\Controllers;

use App\Http\Requests\Production\ProducibleProductsRequest;
use App\Services\Production\ProducibleProductService;
use Illuminate\Http\JsonResponse;

/** Server-searched producible products for order and yarn-lot product pickers. */
class ProducibleProductController extends Controller
{
    public function __invoke(ProducibleProductsRequest $request, ProducibleProductService $products): JsonResponse
    {
        $validated = $request->validated();

        $data = ! empty($validated['ids'])
            ? $products->find($validated['ids'])
            : $products->search($validated['search'] ?? null, $validated['top'] ?? null);

        return response()->json(['data' => $data]);
    }
}
