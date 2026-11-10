<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * Server-side guard against blank records. OData (Lodata) writes bypass Form Requests, so a
 * bare `POST {}` would otherwise insert an empty row. Models list the attributes that must be
 * filled on create in `$requiredAttributes`; a missing one fails with a 422 ValidationException.
 *
 * Enforced on `creating` only, so updates to legacy rows that predate the rule keep working.
 * List this trait before HasCustomId so a rejected record never consumes a custom ID.
 */
trait RequiresAttributes
{
    protected static function bootRequiresAttributes(): void
    {
        static::creating(function (Model $model) {
            $errors = [];
            foreach ($model->requiredAttributes as $attribute) {
                if (blank($model->getAttribute($attribute))) {
                    $errors[$attribute] = ucfirst(str_replace('_', ' ', $attribute)) . ' is required.';
                }
            }

            if ($errors) {
                throw ValidationException::withMessages($errors);
            }
        });
    }
}
