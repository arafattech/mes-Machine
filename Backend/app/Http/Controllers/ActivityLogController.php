<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\idGeneratorController;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public static function createLog($model, $actionType)
    {
        if (!Auth::check()) {
            return;
        }
        // Prepare data
        $ipAddress = request()->ip();
        $sessionId = session()->getId();
        $entity = "ActivityLog";
        $changes = $model->getChanges();

        $logData = [
            'user_id' => Auth::user()->id,
            'user_name' => Auth::user()->name,
            'user_email' => Auth::user()->email,
            'custom_id' => idGeneratorController::generateId($entity),
            'action_type' => $actionType,
            'model_type' => get_class($model),
            'model_id' => $model->id,
            'model_custom_id' => $model->custom_id,
            'ip_address' => $ipAddress,
            'session_id' => $sessionId,
        ];
        // Handle different action types
        switch ($actionType) {
            case 'insert':
                $logData['old_value'] = null;
                $logData['new_value'] = json_encode($model->getAttributes());
                break;

            case 'update':
                $logData['old_value'] = json_encode($model->getOriginal());
                $logData['new_value'] = json_encode($changes);
                break;

            case 'delete':
                $logData['old_value'] = json_encode($model->getAttributes());
                $logData['new_value'] = null;
                break;
        }
        // Create the activity log entry
        ActivityLog::create($logData);
    }


    public static function createCustomLog($model, $modelId, $modelCustomId, $ipAddress, $actionType, $oldValue, $newValue)
    {
        $sessionId = session()->getId();
        $entity = "ActivityLog";
        $logData = [
            'user_id' => Auth::user()->id,
            'user_name' => Auth::user()->name,
            'user_email' => Auth::user()->email,
            'custom_id' => idGeneratorController::generateId($entity),
            'action_type' => $actionType,
            'model_type' => 'App\\Model\\' . $model,
            'model_id' => $modelId,
            'model_custom_id' => $modelCustomId,
            'ip_address' => $ipAddress,
            'session_id' => $sessionId,
            'old_value' => $oldValue,
            'new_value' => $newValue
        ];
        ActivityLog::create($logData);
    }
}
