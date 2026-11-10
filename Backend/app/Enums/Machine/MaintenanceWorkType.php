<?php

namespace App\Enums\Machine;

/** "Type of Works" of a recurring maintenance schedule. */
enum MaintenanceWorkType: string
{
    case MAINT = 'Maintenance';
    case CLEANING_MAINT = 'Cleaning Maintenance';
    case COT_GRINDING_MAINT = 'Cot Grinding & Maintenance';
}
