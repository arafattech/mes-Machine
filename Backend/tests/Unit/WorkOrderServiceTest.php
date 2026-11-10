<?php

namespace Tests\Unit;

use App\Services\Production\WorkOrderService;
use Carbon\CarbonImmutable;
use Tests\TestCase;

class WorkOrderServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['mes.timezone' => 'Asia/Dhaka']);
        // 05/10/2026 00:30 in Dhaka, still 04/10 in UTC
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-04T18:30:00Z'));
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_starting_without_actual_start_stamps_factory_today(): void
    {
        $attributes = (new WorkOrderService())->stampActualStart(['status' => 'in_progress', 'actual_start' => null]);

        $this->assertSame('2026-10-05', $attributes['actual_start']);
    }

    public function test_submitted_actual_start_is_kept(): void
    {
        $attributes = (new WorkOrderService())->stampActualStart(['status' => 'in_progress', 'actual_start' => '2026-10-01']);

        $this->assertSame('2026-10-01', $attributes['actual_start']);
    }

    public function test_other_statuses_are_not_stamped(): void
    {
        foreach (['pending', 'completed', 'cancelled'] as $status) {
            $attributes = (new WorkOrderService())->stampActualStart(['status' => $status, 'actual_start' => null]);
            $this->assertNull($attributes['actual_start']);
        }
    }

    public function test_completion_is_stamped_once_and_cleared_on_reopen(): void
    {
        $service = new WorkOrderService();

        $this->assertNotNull($service->stampCompletion(['status' => 'completed'])['completed_at']);

        $alreadyCompleted = (new \App\Models\WorkOrder())->forceFill(['completed_at' => '2026-10-01 10:00:00']);
        $this->assertSame('2026-10-01 10:00:00', $service->stampCompletion(['status' => 'completed'], $alreadyCompleted)['completed_at']);

        $this->assertNull($service->stampCompletion(['status' => 'in_progress'], $alreadyCompleted)['completed_at']);
    }
}
