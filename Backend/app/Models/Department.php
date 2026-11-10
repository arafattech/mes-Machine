<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Validation\ValidationException;

class Department extends Model
{
    use HasCustomId;
    //
    protected $guarded = [];

    public const NAME_MAX_LENGTH = 255;

    protected static function booted(): void
    {
        static::saving(function (Department $department) {
            $name = trim((string) $department->name);

            if ($name === '' || mb_strlen($name) > self::NAME_MAX_LENGTH) {
                throw ValidationException::withMessages([
                    'name' => 'Department name is required and must not exceed ' . self::NAME_MAX_LENGTH . ' characters.',
                ]);
            }

            $department->name = $name;

            $duplicateExists = static::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->when($department->exists, fn ($query) => $query->whereKeyNot($department->getKey()))
                ->exists();

            if ($duplicateExists) {
                throw ValidationException::withMessages([
                    'name' => 'A department with this name already exists.',
                ]);
            }
        });
    }

    #[LodataRelationship]
    public function notices()
    {
        return $this->belongsToMany(Notice::class, 'notices_departments');
    }
    
}
