<?php

namespace Tests\Unit;

use App\Models\EmployeeShift;
use App\Models\WorkOrder;
use App\Services\Production\ProductionLogRules;
use App\Support\FactoryClock;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ProductionLogRulesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['mes.timezone' => 'Asia/Dhaka']);
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-08T05:46:00Z')); // 08/10 11:46 Dhaka
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function order(array $attributes): WorkOrder
    {
        return (new WorkOrder())->forceFill(['custom_id' => 'WO-0000009'] + $attributes);
    }

    private function assertRejected(callable $call, string $field): void
    {
        try {
            $call();
            $this->fail("Expected a validation error on {$field}.");
        } catch (ValidationException $e) {
            $this->assertArrayHasKey($field, $e->errors());
        }
    }

    public function test_closed_orders_cannot_be_logged_against(): void
    {
        foreach (['completed', 'cancelled'] as $status) {
            $this->assertRejected(
                fn () => (new ProductionLogRules())->assertCanLog($this->order(['status' => $status]), '2026-10-08'),
                'work_order_id',
            );
        }
    }

    public function test_date_must_be_between_actual_start_and_today(): void
    {
        $rules = new ProductionLogRules();
        $order = $this->order(['status' => 'in_progress', 'actual_start' => '2026-10-04 00:00:00']);

        $rules->assertCanLog($order, '2026-10-04');
        $rules->assertCanLog($order, '2026-10-08');
        $this->assertRejected(fn () => $rules->assertCanLog($order, '2026-10-03'), 'date');
        $this->assertRejected(fn () => $rules->assertCanLog($order, '2026-10-09'), 'date');
    }

    public function test_wastage_shift_is_kept_or_required_for_past_dates(): void
    {
        $rules = new ProductionLogRules();

        $this->assertSame(3, $rules->resolveWastageShiftId(3, '2026-10-01'));
        $this->assertRejected(fn () => $rules->resolveWastageShiftId(null, '2026-10-07'), 'shift_id');
    }

    public function test_first_shift_containing_handles_order_overnight_and_undefined_windows(): void
    {
        $shift = fn (int $id, string $start, string $end) => (new EmployeeShift())->forceFill(['id' => $id, 'start_time' => "2026-10-01 {$start}", 'end_time' => "2026-10-01 {$end}"]);
        $undefined = $shift(1, '15:19:00', '15:19:00');
        $day = $shift(3, '06:00:00', '14:00:00');
        $night = $shift(5, '22:00:00', '06:00:00');

        $this->assertSame(3, FactoryClock::firstShiftContaining([$undefined, $night, $day], CarbonImmutable::now())->id);
        // 09/10 02:00 Dhaka belongs to the night shift that started on 08/10
        $this->assertSame(5, FactoryClock::firstShiftContaining([$undefined, $day, $night], CarbonImmutable::parse('2026-10-08T20:00:00Z'))->id);
        $this->assertNull(FactoryClock::firstShiftContaining([$undefined, $day], CarbonImmutable::parse('2026-10-08T12:00:00Z')));
    }
}
