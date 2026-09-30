<?php

namespace App\Http\Controllers;

use App\Models\Client;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function clientAssociate(Request $request)
    {
        try {
            $Client = Client::findOrFail($request->client_id);

            if (!$request->has('clientarea') || !is_array($request->clientarea)) {
                return response()->json(['error' => 'Invalid area data'], 400);
            }

            if (!$request->has('clientnote') || !is_array($request->clientnote)) {
                return response()->json(['error' => 'Invalid note data', 'data' => $request->all()], 400);
            }

            $ClientAreaId = collect($request->clientarea)->pluck('id')->toArray();

            if (!empty($ClientAreaId && !$ClientAreaId[0] == null)) {
                $Client->areas()->sync($ClientAreaId);
            }

            $ClientNotesId = collect($request->clientnote)->pluck('id')->toArray();
            if (!empty($ClientNotesId) && !$ClientNotesId[0] == null) {
                $Client->notes()->sync($ClientNotesId);
            }


            return response()->json([
                'message' => 'Associate assigned successfully',
                'client' => $Client
            ], 200);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Client not found'], 404);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Something went wrong',
                'details' => $e->getMessage()
            ], 500);
        }
    }
}
