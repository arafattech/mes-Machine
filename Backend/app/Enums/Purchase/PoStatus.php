<?php

namespace App\Enums\Purchase;

enum PoStatus: string
{
    case PENDING = 'PENDING';
    case APPROVED = 'APPROVED';
    case CANCELED = 'CANCELED';
    case RECEIVED = 'RECEIVED';
}
