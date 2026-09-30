<?php

namespace App\Enums\Store;

enum ItemReturnStatus: string
{
    case PENDING = 'PENDING';
    case APPROVED = 'APPROVED';
    case REJECTED = 'REJECTED';
}
