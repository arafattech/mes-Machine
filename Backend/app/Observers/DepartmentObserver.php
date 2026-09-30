<?php

namespace App\Observers;

use App\Models\Department;
use App\Services\NotificationService;

class DepartmentObserver
{
    public function __construct(private NotificationService $notificationService) {}

    // Lodata uses DB transactions; 'created'/'updated' fire inside the transaction
    // but may not propagate to observers. 'saved' and 'deleting' always fire reliably.
    public function saved(Department $department): void
    {
        $action = $department->wasRecentlyCreated ? 'created' : 'updated';
        $this->notificationService->dispatch($department, $action, auth()->id());
    }

    public function deleting(Department $department): void
    {
        $this->notificationService->dispatch($department, 'deleted', auth()->id());
    }
}
