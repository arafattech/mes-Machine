<?php

namespace App\Http\Controllers;

use App\Models\Hall;
use Illuminate\Http\Request;

class HallController extends Controller
{
    //

    public function hallAssociate(Request $request)
    {
        try {
            $hall = Hall::findOrFail($request->hall_id);

            if (!$request->has('plants') || !is_array($request->plants)) {
                return response()->json(['error' => 'Invalid plants data'], 400);
            }
            $plantsIds = collect($request->plants)->pluck('id')->toArray();
            $hall->plants()->sync($plantsIds);

            return response()->json([
                'message' => 'Associate successfully',
                'hallInfo' => $hall
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => 'hall not found'], 404);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Something went wrong', 'details' => $e->getMessage()], 500);
        }
    }
}
