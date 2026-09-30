<?php

namespace App\Enums\Machine;

/**
 * How an open maintenance schedule was closed.
 * `AUTO` — node-server cleared the override because the machine's real
 * Active channel confirmed running again. `MANUAL` — operator pressed End.
 */
enum MaintenanceEndedBy: string
{
    case MANUAL = 'manual';
    case AUTO = 'auto';
}
