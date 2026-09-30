<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    private const PERMISSION_MAP = [
        'PurchaseRequisition:SR:created'   => 'STORE_STORE_REQUISITION_CREATE',
        'PurchaseRequisition:SR:approved'  => 'STORE_STORE_REQUISITION_APPROVE',
        'PurchaseRequisition:SR:rejected'  => 'STORE_STORE_REQUISITION_REJECT',
        'PurchaseRequisition:SPR:created'  => 'STORE_PURCHASE_REQUISITION_CREATE',
        'PurchaseRequisition:SPR:approved' => 'STORE_PURCHASE_REQUISITION_APPROVE',
        'PurchaseRequisition:SPR:rejected' => 'STORE_PURCHASE_REQUISITION_REJECT',
        'MaterialReceipt:LOCAL:created'   => 'STORE_LOCAL_MRR_CREATE',
        'MaterialReceipt:IMPORTED:created' => 'STORE_LOCAL_MRR_CREATE',
        'Reminder::created'               => 'STORE_REMINDERS_CREATE',
        'Reminder::updated'               => 'STORE_REMINDERS_UPDATE',
        'Department::created'             => 'BASE_DATA_DEPARTMENT_CREATE',
        'Department::updated'             => 'BASE_DATA_DEPARTMENT_EDIT',
        'Department::deleted'             => 'BASE_DATA_DEPARTMENT_DELETE',
        'SalesOrder::created'             => 'SALES_SALES_ORDER_CREATE',
        'SalesOrder::sent'                => 'SALES_SALES_REQUEST_APPROVE',
        'SalesOrder::approved'            => 'SALES_SALES_REQUEST_APPROVE',
        'SalesOrder::rejected'            => 'SALES_SALES_REQUEST_REJECT',
    ];

    public function dispatch(Model $model, string $actionType, ?int $senderId = null): void
    {
        $modelName = class_basename($model);
        $type      = $model->type ?? '';
        $key       = "{$modelName}:{$type}:{$actionType}";
        $permission = self::PERMISSION_MAP[$key] ?? null;

        if (!$permission) {
            return;
        }

        $users = User::permission($permission)
            ->when($senderId, fn($query) => $query->where('id', '!=', $senderId))
            ->get(['id']);

        if ($users->isEmpty()) {
            return;
        }

        $customId   = $model->custom_id ?? $model->id;
        $senderName = $senderId ? (User::find($senderId)?->name ?? 'System') : 'System';
        $title      = $this->buildTitle($modelName, $type, $actionType, $customId);
        $message    = $this->buildMessage($modelName, $actionType, $customId, $senderName);
        $now        = now();

        $records = $users->map(fn($u) => [
            'recipient_id'    => $u->id,
            'sender_id'       => $senderId,
            'model_type'      => $modelName,
            'model_id'        => $model->id,
            'model_custom_id' => $customId,
            'action_type'     => $actionType,
            'title'           => $title,
            'message'         => $message,
            'is_read'         => false,
            'created_at'      => $now,
            'updated_at'      => $now,
        ])->toArray();

        try {
            Notification::insert($records);
        } catch (\Throwable $e) {
            Log::error('NotificationService::dispatch failed', [
                'model'  => $modelName,
                'action' => $actionType,
                'error'  => $e->getMessage(),
            ]);
        }
    }

    public function dispatchToSpecific(
        array $userIds,
        string $title,
        string $message,
        ?int $senderId,
        string $modelType,
        int $modelId,
        mixed $modelCustomId,
        string $actionType
    ): void {
        if ($senderId) {
            $userIds = array_diff($userIds, [$senderId]);
        }

        if (empty($userIds)) {
            return;
        }

        $now     = now();
        $records = array_map(fn($userId) => [
            'recipient_id'    => $userId,
            'sender_id'       => $senderId,
            'model_type'      => $modelType,
            'model_id'        => $modelId,
            'model_custom_id' => $modelCustomId,
            'action_type'     => $actionType,
            'title'           => $title,
            'message'         => $message,
            'is_read'         => false,
            'created_at'      => $now,
            'updated_at'      => $now,
        ], $userIds);

        try {
            Notification::insert($records);
        } catch (\Throwable $e) {
            Log::error('NotificationService::dispatchToSpecific failed', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function buildTitle(string $model, string $type, string $action, mixed $id): string
    {
        return match ($action) {
            'created' => "New {$type} Created (#{$id})",
            'updated' => "{$type} Updated (#{$id})",
            'deleted' => "{$type} Deleted (#{$id})",
            'sent'    => "Sales Order Forwarded (#{$id})",
            default   => "{$model} {$action} (#{$id})",
        };
    }

    private function buildMessage(string $model, string $action, mixed $id, string $actor): string
    {
        return match ($action) {
            'created' => "{$actor} created a new {$model} record (#{$id}).",
            'updated' => "{$actor} updated {$model} record (#{$id}).",
            'deleted' => "{$actor} deleted {$model} record (#{$id}).",
            'sent'    => "{$actor} forwarded Sales Order (#{$id}) for approval.",
            default   => "{$actor} performed {$action} on {$model} (#{$id}).",
        };
    }
}
