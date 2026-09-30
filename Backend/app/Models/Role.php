<?php

namespace App\Models;
use Flat3\Lodata\Attributes\LodataCollection;
use Flat3\Lodata\Attributes\LodataDate;
use Flat3\Lodata\Attributes\LodataDuration;
use Flat3\Lodata\Attributes\LodataEnum;
use Flat3\Lodata\Attributes\LodataIdentifier;
use Flat3\Lodata\Attributes\LodataTypeIdentifier;
use Flat3\Lodata\Type\SByte;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Permission\Models\Permission;
use App\Traits\HasCustomId;

class Role extends Model
{
    use HasFactory,HasCustomId;
    protected $fillable = [
        'name',
        'guard_name',
        'created_at',
        'updated_at',
    ];


    #[
        LodataIdentifier('Roles'),
        LodataTypeIdentifier('syncPermissions'),

    ]
    public function syncPermissions()
    {
        return $this->belongsToMany(Permission::class,'role_has_permissions');
    }
}
