<?php

namespace App\Models;

use App\Models\LeaveType;
use App\Models\User;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use App\Traits\HasCustomId;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class LeaveRequest extends Model implements HasMedia
{
      use HasCustomId;
      use InteractsWithMedia {
        media as protected trait_media;
      }

      #[LodataRelationship]
      public function media(): MorphMany
      {
            return $this->trait_media();
      }

      protected $fillable = [
        'employee_id', 'leave_type_id', 'start_date', 'end_date', 'reason',
        'supervisor_id', 'supervisor_status', 'supervisor_remarks', 'supervisor_action_at',
        'hr_status', 'final_status', 'is_active', 'created_by',
     ];

      #[LodataRelationship]
      public function leavetype()
      {
            return $this->belongsTo(LeaveType::class, 'leave_type_id');
      }

      #[LodataRelationship]
      public function employee()
      {
            return $this->belongsTo(Employee::class, 'employee_id');
      }
      #[LodataRelationship]
      public function supervisor()
      {
            return $this->belongsTo(Employee::class, 'supervisor_id');
      }

      #[LodataRelationship]
      public function createdBy()
      {
            return $this->belongsTo(User::class, 'created_by');
      }

      #[LodataRelationship]
      public function weekeend()
      {
            return $this->hasMany(LeaveDate::class, 'leave_id');
      }

     #[LodataRelationship]
    public function leaveDates()
    {
        return $this->hasMany(LeaveDate::class, 'leave_id');
    }
}
