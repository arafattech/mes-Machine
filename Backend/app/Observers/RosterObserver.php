<?php

namespace App\Observers;

use App\Models\Roster;
use App\Services\hrModule\EmployeeRosterService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class RosterObserver
{
    public function __construct(private EmployeeRosterService $rosterService)
    {
    }

    // Covers every way a Roster row can be saved — the custom /roster-schedule
    // store endpoint (EmployeeRosterService::createOrUpdateRosters, which already
    // invalidates inline), but also direct OData writes via Lodata (Roster is
    // Lodata::discover'd, including its writable `groups` relationship) that
    // bypass that service entirely. Without this, node-server's biometrics roster
    // cache keeps serving a stale snapshot after an OData-driven roster edit.
    public function saved(Roster $roster): void
    {
        $this->invalidate($roster);
    }

    public function deleted(Roster $roster): void
    {
        $this->invalidate($roster);
    }

    private function invalidate(Roster $roster): void
    {
        if (! $roster->start_date || ! $roster->end_date) {
            return;
        }

        $dates = collect(CarbonPeriod::create($roster->start_date, $roster->end_date))
            ->map(fn ($date) => Carbon::parse($date)->format('Y-m-d'))
            ->all();

        $this->rosterService->invalidateBiometricsRosterCache($dates);
    }
}
