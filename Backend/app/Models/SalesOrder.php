<?php

namespace App\Models;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataRelationship;

class SalesOrder extends Model
{
    use HasFactory, SoftDeletes, HasCustomId;

    protected $table = 'sales_orders';

    protected $fillable = [
        'client_id',
        'order_no',
        'order_date',
        'sale_order_id',
        'expected_delivery_date',
        'status',
        'subtotal',
        'paid_amount',
        'due_amount',
        'discount',
        'vat',
        'grand_total',
        'note',
        'reject_note',
        'discount_option',
        'discount_amount',
        'discount_type',
        'created_by',
    ];

    protected $casts = [
        'order_date' => 'date',
        'expected_delivery_date' => 'datetime',
        'subtotal' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'due_amount' => 'decimal:2',
        'discount' => 'decimal:2',
        'vat' => 'decimal:2',
        'grand_total' => 'decimal:2',
    ];

    #[LodataRelationship]
    public function items()
    {
        return $this->hasMany(SaleOrderItem::class, 'sales_order_id');
    }

    #[LodataRelationship]
    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    #[LodataRelationship]
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
