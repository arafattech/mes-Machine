<?php

namespace App\Observers;

use App\Models\Store\MaterialReceipt;
use App\Services\NotificationService;

class MaterialReceiptObserver
{
    public function __construct(private NotificationService $notificationService) {}

    public function created(MaterialReceipt $receipt): void
    {
        $this->notificationService->dispatch($receipt, 'created', auth()->id());
    }
}
