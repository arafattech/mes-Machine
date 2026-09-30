<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Flat3\Lodata\Attributes\LodataRelationship;

class NoticesEmployee extends Model
{
    protected $table = 'notices_employees';
    protected $fillable = [
        'notice_id',
        'employee_id',
        'is_acknowledged',
        'is_read',
        'published_at',
    ];
    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
    #[LodataRelationship]
    public function notice()
    {
        return $this->belongsTo(Notice::class, 'notice_id');
    }
}
