<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;

class WorkOrder extends Model
{
    use HasCustomId;

    protected $fillable = [
        'custom_id',
        'is_active',
        'product_id',
        'quantity',
        'status',
        'scheduled_start',
        'actual_start',
        'completed_at',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function machines()
    {
        return $this->belongsToMany(Machine::class, 'work_order_machines');
    }
}
