<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Factory (business) time zone
    |--------------------------------------------------------------------------
    |
    | Storage stays UTC (`app.timezone`). Calendar days, shift windows and every
    | user-facing date are computed in this zone — see App\Support\FactoryClock.
    |
    */

    'timezone' => env('MES_TIMEZONE', 'Asia/Dhaka'),

    /*
    |--------------------------------------------------------------------------
    | Production logging
    |--------------------------------------------------------------------------
    |
    | wastage_max_ratio: total wastage / produced kg above which a wastage log
    | needs an explicit confirmation and justification.
    | kg_uom_names: UoM names (case-insensitive) whose counts are kilograms.
    | producible_product_type_names: ProductTypes whose products can be produced.
    |
    */

    'wastage_max_ratio' => (float) env('MES_WASTAGE_MAX_RATIO', 0.10),

    'kg_uom_names' => ['kg', 'kgs', 'kilogram', 'kilograms'],

    'producible_product_type_names' => ['Yarn'],

];
