<?php

namespace App\Support;

use App\Models\EmployeeShift;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Single source of truth for factory-local time. Storage is UTC; calendar days and
 * shift windows are factory-local (`config('mes.timezone')`). Every method returns
 * UTC instants ready for querying DATETIME columns.
 *
 * `employee_shifts.start_time` / `end_time` hold naive factory wall-clock time-of-day
 * (the same convention biometrics punch matching relies on); only the time part is used.
 */
final class FactoryClock
{
    public static function timezone(): string
    {
        return config('mes.timezone');
    }

    public static function now(): CarbonImmutable
    {
        return CarbonImmutable::now(self::timezone());
    }

    /** Factory-local calendar date (`Y-m-d`) for today. */
    public static function today(): string
    {
        return self::now()->toDateString();
    }

    /**
     * UTC bounds `[start, end)` of one factory calendar day.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public static function dayWindow(string $date): array
    {
        $start = CarbonImmutable::parse($date, self::timezone())->startOfDay();

        return [$start->utc(), $start->addDay()->utc()];
    }

    /**
     * UTC bounds of a shift on a factory calendar date. A shift ending at or before
     * its start time runs overnight into the next day.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public static function shiftWindow(EmployeeShift $shift, string $date): array
    {
        $start = self::atTimeOfDay($date, $shift->start_time);
        $end = self::atTimeOfDay($date, $shift->end_time);
        if ($end->lessThanOrEqualTo($start)) {
            $end = $end->addDay();
        }

        return [$start->utc(), $end->utc()];
    }

    /**
     * First shift (in the given order) whose window on the instant's factory day — or the
     * previous day, for overnight shifts — contains the instant. A shift whose start equals
     * its end has no defined window and never matches.
     *
     * @param  iterable<EmployeeShift>  $shifts
     */
    public static function firstShiftContaining(iterable $shifts, CarbonInterface $instant): ?EmployeeShift
    {
        $day = CarbonImmutable::instance($instant)->setTimezone(self::timezone());
        $candidateDates = [$day->toDateString(), $day->subDay()->toDateString()];

        foreach ($shifts as $shift) {
            if (self::timeOfDay($shift->start_time) === self::timeOfDay($shift->end_time)) {
                continue;
            }
            foreach ($candidateDates as $date) {
                [$start, $end] = self::shiftWindow($shift, $date);
                if ($instant >= $start && $instant < $end) {
                    return $shift;
                }
            }
        }

        return null;
    }

    /**
     * Factory UTC offset (e.g. `+06:00`) for MySQL `CONVERT_TZ`, which needs no tz tables in this
     * form. Today's offset is applied to every row, so only fixed-offset zones (no DST, as
     * Asia/Dhaka) are supported.
     */
    public static function sqlOffset(): string
    {
        return self::now()->format('P');
    }

    /** SQL expression for the factory calendar date of a UTC DATETIME column. */
    public static function localDateSql(string $column): string
    {
        return sprintf("DATE(CONVERT_TZ(%s, '+00:00', '%s'))", DB::getQueryGrammar()->wrap($column), self::sqlOffset());
    }

    private static function atTimeOfDay(string $date, CarbonInterface|string $wallClock): CarbonImmutable
    {
        return CarbonImmutable::parse("{$date} " . self::timeOfDay($wallClock), self::timezone());
    }

    private static function timeOfDay(CarbonInterface|string $wallClock): string
    {
        return CarbonImmutable::parse($wallClock)->format('H:i:s');
    }
}
