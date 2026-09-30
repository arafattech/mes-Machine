<?php

namespace App\Enums\Store;

enum YarnAdviceStatus: string
{
    case DRAFT = 'draft';
    case HOD_APPROVED = 'hod_approved';
    case STORE_RECEIVED = 'store_received';
    case GM_APPROVED = 'gm_approved';
    case REJECTED = 'rejected';
    case CANCELLED = 'cancelled';
}
