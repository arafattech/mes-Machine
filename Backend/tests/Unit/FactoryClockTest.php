<?php

namespace Tests\Unit;

use App\Models\EmployeeShift;
use App\Support\FactoryClock;
use Carbon\CarbonImmutable;
use Tests\TestCase;

class FactoryClockTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['mes.timezone' => 'Asia/Dhaka']);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_day_window_is_factory_midnight_to_midnight_in_utc(): void
    {
        [$start, $end] = FactoryClock::dayWindow('2026-10-08');

        $this->assertSame('2026-10-07 18:00:00', $start->toDateTimeString());
        $this->assertSame('2026-10-08 18:00:00', $end->toDateTimeString());
        $this->assertSame('UTC', $start->tzName);
    }

    public function test_shift_window_reads_naive_wall_clock_as_factory_time(): void
    {
        $shift = (new EmployeeShift())->forceFill([
            'start_time' => '2026-10-01 12:50:00',
            'end_time' => '2026-10-01 18:50:00',
        ]);

        [$start, $end] = FactoryClock::shiftWindow($shift, '2026-10-04');

        $this->assertSame('2026-10-04 06:50:00', $start->toDateTimeString());
        $this->assertSame('2026-10-04 12:50:00', $end->toDateTimeString());
    }

    public function test_overnight_shift_ends_on_the_next_day(): void
    {
        $shift = (new EmployeeShift())->forceFill([
            'start_time' => '2026-10-01 22:00:00',
            'end_time' => '2026-10-01 06:00:00',
        ]);

        [$start, $end] = FactoryClock::shiftWindow($shift, '2026-10-04');

        $this->assertSame('2026-10-04 16:00:00', $start->toDateTimeString());
        $this->assertSame('2026-10-05 00:00:00', $end->toDateTimeString());
    }

    public function test_today_rolls_over_at_factory_midnight_not_utc_midnight(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-04T18:30:00Z'));

        $this->assertSame('2026-10-05', FactoryClock::today());
    }

    public function test_local_date_sql_uses_factory_offset(): void
    {
        $this->assertSame(
            "DATE(CONVERT_TZ(`bucket_started_at`, '+00:00', '+06:00'))",
            FactoryClock::localDateSql('bucket_started_at'),
        );
    }
}
