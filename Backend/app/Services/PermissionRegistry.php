<?php
namespace App\Services;

use App\Models\Hall;
use App\Models\Product;
use App\Models\WorkOrder;
use App\Models\Employee;
use App\Models\Client;
use App\Enums\Permission\Permission;

class PermissionRegistry
{
    /**
     * Map OData Entity Set Name => Permission Prefix
     */
    public static function getMap(): array
    {
        return [
            'MarketPrices' => [
                'GET'    => Permission::MARKET_PRICES->value,
                'POST'   => Permission::MARKET_PRICE_ENTRY->value,
                'PUT'    => Permission::MARKET_PRICES->value,
                'PATCH'  => Permission::MARKET_PRICES->value,
                'DELETE' => Permission::MARKET_PRICES->value,
            ],
            'MachineMaintenanceSchedules' => [
                'GET'    => 'PRODUCTION_ADMIN',
                'POST'   => 'PRODUCTION_ADMIN',
                'PUT'    => 'PRODUCTION_ADMIN',
                'PATCH'  => 'PRODUCTION_ADMIN',
                'DELETE' => 'PRODUCTION_ADMIN',
            ],
        ];
    }
}
