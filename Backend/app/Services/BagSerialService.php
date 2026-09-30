<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use RuntimeException;

class BagSerialService
{
    /**
     * Mill-wide continuous bag serial for a count type, computed from the highest bag_no
     * already recorded for that count type — no stored counter that can drift out of sync
     * with the actual data. The MySQL named lock is held for the caller's whole critical
     * section (read-max + insert), not just the read — releasing it right after the read
     * would let two concurrent bag inserts compute the same next number.
     */
    public function withNextSerial(int $countTypeId, callable $callback): mixed
    {
        $lockName = "bag_serial:count_type:{$countTypeId}";
        $acquired = DB::selectOne('SELECT GET_LOCK(?, 10) AS acquired', [$lockName])->acquired;

        if (! $acquired) {
            throw new RuntimeException("Could not acquire bag serial lock for count type {$countTypeId}.");
        }

        try {
            $max = DB::table('production_lot_items')
                ->join('production_lot_counts', 'production_lot_counts.id', '=', 'production_lot_items.production_lot_count_id')
                ->where('production_lot_counts.count_type_id', $countTypeId)
                ->max('production_lot_items.bag_no');

            return $callback(((int) $max) + 1);
        } finally {
            DB::statement('SELECT RELEASE_LOCK(?)', [$lockName]);
        }
    }
}
