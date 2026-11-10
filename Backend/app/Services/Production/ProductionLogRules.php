<?php

namespace App\Services\Production;

use App\Models\EmployeeShift;
use App\Models\MachineProductionCount;
use App\Models\MachineWastageEntry;
use App\Models\WorkOrder;
use App\Support\FactoryClock;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Business rules every production / wastage log must satisfy beyond field validation.
 * Violations throw ValidationException, so callers answer with a 422 and field errors.
 */
class ProductionLogRules
{
    private const CLOSED_STATUSES = ['completed', 'cancelled'];

    /** The order must be open and the factory date within [actual start, today]. */
    public function assertCanLog(WorkOrder $workOrder, string $date): void
    {
        if (in_array($workOrder->status, self::CLOSED_STATUSES, true)) {
            throw ValidationException::withMessages([
                'work_order_id' => "Production order {$workOrder->custom_id} is {$workOrder->status}; reopen it to log against it.",
            ]);
        }

        if ($date > FactoryClock::today()) {
            throw ValidationException::withMessages(['date' => 'The date cannot be in the future.']);
        }

        // Actual start is entered as a factory date (stored at midnight), so its date part is the day.
        $startedOn = $workOrder->actual_start ? CarbonImmutable::parse($workOrder->actual_start)->toDateString() : null;
        if ($startedOn !== null && $date < $startedOn) {
            throw ValidationException::withMessages([
                'date' => 'The date is before production order ' . $workOrder->custom_id . ' started ('
                    . CarbonImmutable::parse($startedOn)->format('d/m/Y') . ').',
            ]);
        }
    }

    /**
     * Total wastage for the order (already logged + this submission) above the configured share
     * of its produced kg needs an explicit confirmation. Only applies when the product is counted
     * in kg — otherwise the two quantities are not comparable.
     */
    public function assertWastageWithinThreshold(WorkOrder $workOrder, float $newWastageKg, bool $confirmed): void
    {
        if ($confirmed || ! $this->isCountedInKg($workOrder)) {
            return;
        }

        $producedKg = (float) MachineProductionCount::where('work_order_id', $workOrder->id)->sum('total_count');
        $wastageKg = (float) MachineWastageEntry::where('work_order_id', $workOrder->id)->sum('qty_kg') + $newWastageKg;
        $maxRatio = (float) config('mes.wastage_max_ratio');

        if ($producedKg > 0 && $wastageKg / $producedKg <= $maxRatio) {
            return;
        }

        $share = $producedKg > 0 ? round($wastageKg / $producedKg * 100) . '% of the ' . round($producedKg, 2) . ' kg produced' : 'with no production logged';
        throw ValidationException::withMessages([
            // The key tells the client to ask for a confirmation instead of a correction.
            'confirm_over_threshold' => "Total wastage would be {$share} (limit " . round($maxRatio * 100)
                . '%). Confirm and add a justification to log it.',
        ]);
    }

    /**
     * Shift for a wastage entry: the chosen one, else the active shift running now when the entry
     * is for today (first match by id, as the app header resolves it). Past dates carry no time,
     * so they cannot be derived. Entries keep the calendar date they were logged for — between
     * midnight and 06:00 that is the day after an overnight shift started.
     */
    public function resolveWastageShiftId(?int $shiftId, string $date): int
    {
        if ($shiftId !== null) {
            return $shiftId;
        }

        if ($date !== FactoryClock::today()) {
            throw ValidationException::withMessages(['shift_id' => 'Select a shift for a past date.']);
        }

        $shifts = EmployeeShift::where('is_active', true)->orderBy('id')->get();
        $current = FactoryClock::firstShiftContaining($shifts, FactoryClock::now());
        if (! $current) {
            throw ValidationException::withMessages(['shift_id' => 'No shift is running now; select a shift.']);
        }

        return $current->id;
    }

    private function isCountedInKg(WorkOrder $workOrder): bool
    {
        $uomName = strtolower(trim((string) $workOrder->product?->uom?->name));

        return in_array($uomName, config('mes.kg_uom_names'), true);
    }
}
