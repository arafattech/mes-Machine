<?php

namespace App\Enums\Production;

enum LotStatus: string
{
    case DOFFED = 'DOFFED';
    case QC_FAILED = 'QC_FAILED';
    case PACKED = 'PACKED';
    case PENDING_TRANSFER = 'PENDING_TRANSFER';
    case REJECTED = 'REJECTED';
    case RECEIVED = 'RECEIVED';
    case RECONCILED = 'RECONCILED';
    case CANCELLED = 'CANCELLED';
}
