<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\idGeneratorController;
use App\Http\Controllers\ActivityLogController;

trait HasCustomId
{
    protected static function bootHasCustomId()
    {
        // This event handles custom ID generation if the model doesn't have one.
        static::creating(function ($model) {
            Log::info('Creating model', ['model' => get_class($model), 'model_id' => $model->id]);
            if (empty($model->custom_id)) {
                $entity = class_basename($model);
                $model->custom_id = idGeneratorController::generateId($entity);
            }
        });

        // This event logs the activity of the model being newly create or update .
        static::saved(function ($model) {
            Log::info('Saved model', ['model' => get_class($model), 'model_id' => $model->id]);
            if ($model->wasRecentlyCreated) {
                ActivityLogController::createLog($model, 'insert');
            } else {
                ActivityLogController::createLog($model, 'update');
            }
        });

        // This event logs the activity of the model being deleted.
        static::deleting(function ($model) {
            Log::info('Deleting model', ['model' => get_class($model), 'model_id' => $model->id]);
            ActivityLogController::createLog($model, 'delete');
        });
    }
}
