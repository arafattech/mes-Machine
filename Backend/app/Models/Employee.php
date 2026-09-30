<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use App\Traits\HasCustomId;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use App\Models\Asset;
use App\Models\AttendanceLog;
use App\Models\Department;
use App\Models\EmployeeSalary;
use App\Models\EmployeeGroup;
use App\Models\EmployeeShift;
use App\Models\EmployeeHasAsset;
use App\Models\EmployeeBonus;
use App\Models\EmployeeWeekend;
use App\Models\EmployeeHolidaySwap;
use App\Models\LeaveRequest;
use App\Models\Notice;
use App\Models\Payroll;
use App\Models\User;
use App\Models\ShiftOverrides;
use App\Models\Roster;
use Illuminate\Support\Facades\Hash;
use Flat3\Lodata\Attributes\LodataRelationship;

class Employee extends Model implements HasMedia
{
    use HasCustomId;
    use InteractsWithMedia {
        media as protected trait_media;
    }

    protected $guarded = [];

    protected $casts = [
        'joining_date' => 'date',
        'last_increment' => 'date',
        'is_active' => 'boolean',
    ];

    #[LodataRelationship]
    public function supervisor()
    {
        return $this->belongsTo(Employee::class, 'supervisor_id');
    }

    public function subordinates()
    {
        return $this->hasMany(Employee::class, 'supervisor_id');
    }

    #[LodataRelationship]
    public function media(): MorphMany
    {
        return $this->trait_media();
    }
    #[LodataRelationship]
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    private static function requireContactChannel($employee): void
    {
        if (!$employee->email && !$employee->contact_number) {
            throw new \Exception('Either email or contact number is required for an employee.');
        }
    }

    /**
     * Auto create, update user when employee is being created
     */
    protected static function booted()
    {
        static::creating(function ($employee) {
            self::requireContactChannel($employee);

            $validationErrorMessages = [];

            if ($employee->contact_number) {
                $existingEmployeeByContactNumber = Employee::where('contact_number', $employee->contact_number)->first();

                if ($existingEmployeeByContactNumber) {
                    $existingEmployeeDisplayName = trim(($existingEmployeeByContactNumber->first_name ?? '') . ' ' . ($existingEmployeeByContactNumber->last_name ?? ''))
                        ?: ($existingEmployeeByContactNumber->custom_id ?? (string) $existingEmployeeByContactNumber->id);

                    $validationErrorMessages[] = "The contact number '{$employee->contact_number}' already exists under employee '{$existingEmployeeDisplayName}'.";
                }
            }

            if ($employee->email) {
                $existingEmployeeByEmail = Employee::where('email', $employee->email)->first();

                if ($existingEmployeeByEmail) {
                    $existingEmployeeDisplayName = trim(($existingEmployeeByEmail->first_name ?? '') . ' ' . ($existingEmployeeByEmail->last_name ?? ''))
                        ?: ($existingEmployeeByEmail->custom_id ?? (string) $existingEmployeeByEmail->id);

                    $validationErrorMessages[] = "The email '{$employee->email}' already exists under employee '{$existingEmployeeDisplayName}'.";
                }
            }

            if (!empty($validationErrorMessages)) {
                throw new \Exception(implode(' Also, ', $validationErrorMessages));
            }

            $user = null;

            if ($employee->email) {
                $user = User::where('email', $employee->email)->first();
            }

            if (!$user && $employee->contact_number) {
                $user = User::where('phone', $employee->contact_number)->first();
            }

            if (!$user && ($employee->email || $employee->contact_number)) {
                $user = User::create([
                    'name' => trim(($employee->first_name ?? '') . ' ' . ($employee->last_name ?? '')) ?: ($employee->email ?? $employee->contact_number),
                    'email' => $employee->email ?? null,
                    'phone' => $employee->contact_number ?? null,
                    'password' => Hash::make('hr1234'),
                    'is_active' => $employee->is_active,
                ]);

                $user->syncRoles(['employee']);
            }

            if ($user) {
                $employee->user_id = $user->id;

                if (!$user->hasRole('employee')) {
                    $user->assignRole('employee');
                }
            }
        });

        static::updating(function ($employee) {
            if ($employee->isDirty('is_active') && !$employee->is_active) {
                $employee->group_id = null;
            }

            if ($employee->isDirty(['email', 'contact_number'])) {
                self::requireContactChannel($employee);
            }

            $user = $employee->user;
            $validationErrorMessages = [];

            if ($employee->isDirty('contact_number') && $employee->contact_number) {
                $existingEmployeeByContactNumber = Employee::where('contact_number', $employee->contact_number)
                    ->where('id', '!=', $employee->id)
                    ->first();

                if ($existingEmployeeByContactNumber) {
                    $existingEmployeeDisplayName = trim(($existingEmployeeByContactNumber->first_name ?? '') . ' ' . ($existingEmployeeByContactNumber->last_name ?? ''))
                        ?: ($existingEmployeeByContactNumber->custom_id ?? (string) $existingEmployeeByContactNumber->id);

                    $validationErrorMessages[] = "The contact number '{$employee->contact_number}' already exists under employee '{$existingEmployeeDisplayName}'.";
                }
            }

            if ($employee->isDirty('email') && $employee->email) {
                $existingEmployeeByEmail = Employee::where('email', $employee->email)
                    ->where('id', '!=', $employee->id)
                    ->first();

                if ($existingEmployeeByEmail) {
                    $existingEmployeeDisplayName = trim(($existingEmployeeByEmail->first_name ?? '') . ' ' . ($existingEmployeeByEmail->last_name ?? ''))
                        ?: ($existingEmployeeByEmail->custom_id ?? (string) $existingEmployeeByEmail->id);

                    $validationErrorMessages[] = "The email '{$employee->email}' already exists under employee '{$existingEmployeeDisplayName}'.";
                }
            }

            if (!empty($validationErrorMessages)) {
                throw new \Exception(implode(' Also, ', $validationErrorMessages));
            }

            if ($employee->isDirty(['first_name', 'last_name', 'email', 'contact_number', 'is_active'])) {
                if ($user) {
                    $userData = [];

                    if ($employee->isDirty('first_name') || $employee->isDirty('last_name')) {
                        $userData['name'] = trim($employee->first_name . ' ' . $employee->last_name);
                    }

                    if ($employee->isDirty('email')) {
                        $userData['email'] = $employee->email;
                    }

                    if ($employee->isDirty('contact_number')) {
                        $userData['phone'] = $employee->contact_number;
                    }

                    if ($employee->isDirty('is_active')) {
                        $userData['is_active'] = $employee->is_active;
                    }

                    if (!empty($userData)) {
                        $user->update($userData);
                    }
                } else {
                    $existingUser = null;

                    if ($employee->email) {
                        $existingUser = User::where('email', $employee->email)->first();
                    }

                    if (!$existingUser && $employee->contact_number) {
                        $existingUser = User::where('phone', $employee->contact_number)->first();
                    }

                    if ($existingUser) {
                        $employee->user_id = $existingUser->id;

                        if (!$existingUser->hasRole('employee')) {
                            $existingUser->assignRole('employee');
                        }
                    } elseif ($employee->email || $employee->contact_number) {
                        $createdUser = User::create([
                            'name' => trim(($employee->first_name ?? '') . ' ' . ($employee->last_name ?? ''))
                                ?: ($employee->email ?? $employee->contact_number),
                            'email' => $employee->email ?? null,
                            'phone' => $employee->contact_number ?? null,
                            'password' => Hash::make('hr1234'),
                            'is_active' => $employee->is_active,
                        ]);

                        $createdUser->syncRoles(['employee']);
                        $employee->user_id = $createdUser->id;
                    }
                }
            }
        });
    }

    #[LodataRelationship]
    public function attendancelogs()
    {
        return $this->hasMany(AttendanceLog::class);
    }

    #[LodataRelationship]
    public function payrolls()
    {
        return $this->hasMany(Payroll::class);
    }

    #[LodataRelationship]
    public function employeeBonuses()
    {
        return $this->hasMany(EmployeeBonus::class, 'emp_id');
    }

    #[LodataRelationship]
    public function salary()
    {
        return $this->hasOne(EmployeeSalary::class)->latestOfMany();
    }
    #[LodataRelationship]
    public function assets()
    {
        return $this->belongsToMany(Asset::class, 'employee_has_assets');
    }

    #[LodataRelationship]
    public function leaves()
    {
        return $this->hasMany(LeaveRequest::class);
    }

    #[LodataRelationship]
    public function notices()
    {
        return $this->belongsToMany(Notice::class, 'notices_employees');
    }

    #[LodataRelationship]
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    #[LodataRelationship]
    public function designation()
    {
        return $this->belongsTo(Designation::class, 'designation_id');
    }

    #[LodataRelationship]
    public function employeeType()
    {
        return $this->belongsTo(EmployeeType::class);
    }

    #[LodataRelationship]
    public function employeeSection()
    {
        return $this->belongsTo(EmployeeSection::class);
    }

    #[LodataRelationship]
    public function employeeHasAssets()
    {
        return $this->hasMany(EmployeeHasAsset::class);
    }

    #[LodataRelationship]
    public function shift()
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id', 'id');
    }

    #[LodataRelationship]
    public function group()
    {
        return $this->belongsTo(EmployeeGroup::class, 'group_id');
    }

    #[LodataRelationship]
    public function employeeWeekend()
    {
        return $this->hasMany(EmployeeWeekend::class);
    }
    #[LodataRelationship]
    public function shiftOverrides()
    {
        return $this->hasMany(ShiftOverrides::class, 'replacement_employee_id');
    }

    public function holidaySwaps()
    {
        return $this->hasMany(EmployeeHolidaySwap::class, 'employee_id');
    }

    public function roster()
    {
        return $this->hasMany(Roster::class, 'employee_id');
    }

    public function absences()
    {
        return $this->hasMany(ShiftOverrides::class, 'absent_employee_id');
    }

    public function replacements()
    {
        return $this->hasMany(ShiftOverrides::class, 'replacement_employee_id');
    }

    #[LodataRelationship]
    public function leaveRequests()
    {
        return $this->hasMany(LeaveRequest::class, 'employee_id');
    }

    #[LodataRelationship]
    public function leaveDates()
    {
        return $this->hasMany(LeaveDate::class, 'employee_id');
    }
}
