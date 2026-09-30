<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\HasCustomId;
use Laravel\Sanctum\HasApiTokens;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Lodata\Attributes\LodataRelationship;
use App\Models\Employee;

class User extends Authenticatable implements HasMedia
{
    use HasFactory, HasRoles, SoftDeletes, HasCustomId, HasApiTokens, Notifiable;

    use InteractsWithMedia {
        media as protected trait_media;
    }

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'custom_id',
        'is_active'
    ];

    protected $dates = ['deleted_at'];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    #[LodataRelationship]
    public function media(): MorphMany
    {
        return $this->trait_media();
    }

    #[LodataRelationship]
    public function employee()
    {
        return $this->hasOne(Employee::class);
    }

}
