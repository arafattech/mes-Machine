<?php

namespace App\Observers;

use App\Models\Store\PurchaseRequisition;
use App\Services\NotificationService;

class PurchaseRequisitionObserver
{
    public function __construct(private NotificationService $notificationService) {}

    public function created(PurchaseRequisition $requisition): void
    {
        $this->notificationService->dispatch($requisition, 'created', auth()->id());
    }

    public function updated(PurchaseRequisition $requisition): void
    {
        if (!$requisition->wasChanged('status')) {
            return;
        }

        $actionType = match($requisition->status) {
            'APPROVED', 'FINAL_APPROVAL' => 'approved',
            'REJECTED'                   => 'rejected',
            default                      => null,
        };

        if (!$actionType) {
            return;
        }

        $this->notificationService->dispatch($requisition, $actionType, auth()->id());
    }

    public function deleted(PurchaseRequisition $requisition): void
    {
        $this->notificationService->dispatch($requisition, 'deleted', auth()->id());
    }
}
