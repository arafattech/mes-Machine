<?php

namespace App\Enums\Store;

enum StoreTransferItemStatus: string
{
    case PENDING = 'PENDING';
    case RECEIVED = 'RECEIVED';
    case REJECTED = 'REJECTED';
}
