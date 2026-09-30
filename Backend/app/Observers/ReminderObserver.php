<?php

namespace App\Observers;

use App\Models\Reminder;
use App\Services\NotificationService;

class ReminderObserver
{
    public function __construct(private NotificationService $notificationService) {}

    public function created(Reminder $reminder): void
    {
        $this->notificationService->dispatch($reminder, 'created', auth()->id());
    }

    public function updated(Reminder $reminder): void
    {
        if ($reminder->wasChanged('is_read') && $reminder->is_read) {
            $this->notificationService->dispatch($reminder, 'updated', auth()->id());
        }
    }
}
