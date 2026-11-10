<?php

namespace Tests\Unit;

use App\Http\Requests\Production\WorkOrderRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class WorkOrderRequestTest extends TestCase
{
    /** Request rules without `exists:` lookups, so the contract is testable without a database. */
    private function validate(array $data): \Illuminate\Validation\Validator
    {
        $rules = array_map(
            fn (array $fieldRules) => array_values(array_filter($fieldRules, fn ($rule) => ! str_starts_with($rule, 'exists:'))),
            (new WorkOrderRequest())->rules(),
        );

        return Validator::make($data, $rules, (new WorkOrderRequest())->messages());
    }

    private function valid(array $overrides = []): array
    {
        return array_merge(['product_id' => 1, 'quantity' => 10, 'scheduled_start' => '2026-10-08'], $overrides);
    }

    public function test_accepts_a_minimal_valid_order(): void
    {
        $this->assertTrue($this->validate($this->valid())->passes());
    }

    public function test_rejects_zero_and_negative_quantity_with_a_clear_message(): void
    {
        foreach ([0, -100] as $quantity) {
            $validator = $this->validate($this->valid(['quantity' => $quantity]));
            $this->assertTrue($validator->fails());
            $this->assertSame('Quantity must be at least 1.', $validator->errors()->first('quantity'));
        }
    }

    public function test_requires_scheduled_start(): void
    {
        $validator = $this->validate($this->valid(['scheduled_start' => null]));

        $this->assertSame('Scheduled start is required.', $validator->errors()->first('scheduled_start'));
    }

    public function test_actual_start_is_optional_and_may_precede_scheduled_start(): void
    {
        $this->assertTrue($this->validate($this->valid(['actual_start' => '2026-10-07']))->passes());
        $this->assertTrue($this->validate($this->valid(['actual_start' => null]))->passes());
        $this->assertTrue($this->validate($this->valid(['actual_start' => 'not a date']))->fails());
    }
}
