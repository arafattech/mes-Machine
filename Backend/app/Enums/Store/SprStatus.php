<?php

namespace App\Enums\Store;

enum SprStatus: string
{
    case SUBMITTED = 'SUBMITTED';
    case APPROVED = 'APPROVED';
    case FINAL_APPROVAL = 'FINAL_APPROVAL';
    case REJECTED = 'REJECTED';
}
