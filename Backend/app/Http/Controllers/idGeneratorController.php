<?php

namespace App\Http\Controllers;

use App\Models\IdGeneratorSetting;
use Haruncpi\LaravelIdGenerator\IdGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Database\QueryException;

class idGeneratorController extends Controller
{
    public static function generateId(string $entity): string
    {
        $idGeneratorSetting = IdGeneratorSetting::where('entity', $entity)->first();
        if (!$idGeneratorSetting)
            throw new \Exception('No Id generator for the requested Entity available ', 422);

        $config = [
            'table' => $idGeneratorSetting->table,
            'field' => $idGeneratorSetting->field,
            'length' => $idGeneratorSetting->length,
            'prefix' => $idGeneratorSetting->prefix,
            'reset_on_prefix_change' => $idGeneratorSetting->reset_on_prefix_change
        ];

        if ($idGeneratorSetting->is_date_prefix)
            $config['prefix'] = date($idGeneratorSetting->prefix);

        if ($idGeneratorSetting->prefix && strlen($idGeneratorSetting->prefix))
            return IdGenerator::generate($config);
        else
            return self::generateIdWithoutPrefix($config);
    }

    private static function generateIdWithoutPrefix(array $config): string
    {
        $maxKey = (int)DB::select("SELECT max({$config['field']}) as value from {$config['table']}")[0]->value + 1;
        return Str::padLeft((string)$maxKey, $config['length'], '0');
    }

    public function generateIdRequest(Request $request): JsonResponse
    {
        try {
            return response()->json(['entity' => $this->generateId($request->get('entity'))]);
        } catch (\Exception $exception) {
            abort($exception->getCode(), $exception->getMessage());
        }
    }

    public function generateCustomCode(Request $request): JsonResponse
    {
        $request->validate([
            'model' => 'required|string',
            'prefix' => 'nullable|string',
            'field' => 'nullable|string',
            'length' => 'nullable|integer'
        ]);

        $table = $request->input('model');
        $prefix = $request->input('prefix');
        $field = $request->input('field');
        $padLength = $request->input('length', 7);

        if ($prefix) {
            $id = IdGenerator::generate([
                'table' => $table,
                'field' => $field,
                'length' => strlen($prefix) + $padLength,
                'prefix' => $prefix . '-',
                'reset_on_prefix_change' => true,
            ]);
        } else {
            $lastId = DB::table($table)
                ->where($field, 'REGEXP', '^[0-9]+$')
                ->orderByRaw("CAST($field AS UNSIGNED) DESC")
                ->value($field);

            $lastNumber = is_numeric($lastId) ? (int) $lastId : 0;
            $newNumber = $lastNumber + 1;
            $id = str_pad($newNumber, $padLength, '0', STR_PAD_LEFT);
        }

        return response()->json([
            'code' => $id
        ]);
    }
}


