<?php

namespace App\Console\Commands;

use App\Support\FactoryClock;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Before FactoryClock, batch production logging (`WorkOrderController::logProductionCounts`)
 * stored the shift's naive factory wall-clock times as if they were UTC, so those buckets
 * read 6 h late. They are recognisable because their start/end time-of-day equals their
 * shift's raw `start_time` / `end_time`. This converts exactly those rows to true UTC.
 */
class NormalizeShiftBucketTimes extends Command
{
    protected $signature = 'mes:normalize-shift-bucket-times {--force : Apply the changes (default is a dry run)}';

    protected $description = 'Convert production-count buckets stored as naive factory shift times to UTC (dry run by default)';

    public function handle(): int
    {
        $changes = $this->collectChanges();

        if ($changes === []) {
            $this->info('No naive shift-time buckets found.');

            return self::SUCCESS;
        }

        $this->table(
            ['id', 'shift', 'bucket_started_at (old → new)', 'bucket_ended_at (old → new)'],
            array_map(fn (array $c) => [
                $c['id'],
                $c['shift'],
                "{$c['old_start']} → {$c['new_start']}",
                "{$c['old_end']} → {$c['new_end']}",
            ], $changes),
        );

        if (! $this->option('force')) {
            $this->warn(count($changes) . ' row(s) would be updated. Dry run only — re-run with --force to apply.');

            return self::SUCCESS;
        }

        $updated = DB::transaction(fn () => array_sum(array_map(
            // Guarding on the old values makes a re-run or concurrent edit a no-op instead of a double shift.
            fn (array $c) => DB::table('machine_production_counts')
                ->where('id', $c['id'])
                ->where('bucket_started_at', $c['old_start'])
                ->where('bucket_ended_at', $c['old_end'])
                ->update(['bucket_started_at' => $c['new_start'], 'bucket_ended_at' => $c['new_end']]),
            $changes,
        )));

        $this->info("{$updated} row(s) updated.");

        return self::SUCCESS;
    }

    /** @return list<array{id: int, shift: string, old_start: string, old_end: string, new_start: string, new_end: string}> */
    private function collectChanges(): array
    {
        $changes = [];

        DB::table('machine_production_counts as mpc')
            ->join('employee_shifts as es', 'es.id', '=', 'mpc.shift_id')
            ->whereRaw('TIME(mpc.bucket_started_at) = TIME(es.start_time)')
            ->whereRaw('TIME(mpc.bucket_ended_at) = TIME(es.end_time)')
            ->select('mpc.id', 'mpc.bucket_started_at', 'mpc.bucket_ended_at', 'es.name as shift')
            ->chunkById(500, function ($rows) use (&$changes) {
                foreach ($rows as $row) {
                    $changes[] = [
                        'id' => (int) $row->id,
                        'shift' => (string) $row->shift,
                        'old_start' => $row->bucket_started_at,
                        'old_end' => $row->bucket_ended_at,
                        'new_start' => $this->toUtc($row->bucket_started_at),
                        'new_end' => $this->toUtc($row->bucket_ended_at),
                    ];
                }
            }, 'mpc.id', 'id');

        return $changes;
    }

    private function toUtc(string $naiveFactoryTime): string
    {
        return CarbonImmutable::parse($naiveFactoryTime, FactoryClock::timezone())->utc()->toDateTimeString();
    }
}
