<?php

namespace App\Http\Controllers;

use App\Models\IdGeneratorSetting;
use Haruncpi\LaravelIdGenerator\IdGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
        $field = $request->input('field') ?: 'custom_id';
        $padLength = $request->input('length', 7);

        // Table/column names reach raw SQL below — only accept ones that really exist.
        abort_unless(Schema::hasTable($table) && Schema::hasColumn($table, $field), 422, 'Unknown model or field.');

        if ($prefix) {
            $fullPrefix = $prefix . '-';
            $digits = $padLength - 1;
            $next = $this->lastNumericSuffix($table, $field, $fullPrefix);
            do {
                $id = $fullPrefix . str_pad((string) ++$next, $digits, '0', STR_PAD_LEFT);
            } while (DB::table($table)->where($field, $id)->exists());
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

    /**
     * Numeric suffix of the most recently created `{prefix}NNN` row (highest primary key), so ids
     * continue from the last record. Parsed as a number, so a mis-padded id (`X-00013`) still reads
     * as 13 — a string MAX would rank it above `X-000014` and hand out a duplicate. Tables without
     * an `id` column fall back to the highest suffix.
     */
    private function lastNumericSuffix(string $table, string $field, string $fullPrefix): int
    {
        $column = DB::getQueryGrammar()->wrap($field);
        $query = DB::table($table)
            ->where($field, 'like', addcslashes($fullPrefix, '%_\\') . '%')
            ->selectRaw("CAST(SUBSTRING($column, ?) AS UNSIGNED) as suffix", [strlen($fullPrefix) + 1]);

        $query = Schema::hasColumn($table, 'id') ? $query->orderByDesc('id') : $query->orderByDesc('suffix');

        return (int) $query->value('suffix');
    }
}


