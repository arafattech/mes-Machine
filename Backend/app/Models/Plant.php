<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use Illuminate\Validation\ValidationException;

class Plant extends Model
{
    use HasCustomId;

    public const NAME_MAX_LENGTH = 255;

    protected static function booted(): void
    {
        static::saving(function (Plant $plant) {
            $name = trim((string) $plant->name);

            if ($name === '' || mb_strlen($name) > self::NAME_MAX_LENGTH) {
                throw ValidationException::withMessages([
                    'name' => 'Plant name is required and must not exceed ' . self::NAME_MAX_LENGTH . ' characters.',
                ]);
            }
        });
    }

    public function halls()
    {
        return $this->belongsToMany(Hall::class, 'hall_plant');
    }
}
