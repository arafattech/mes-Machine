<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoginActivity extends Model
{
    protected $fillable = [
        'table_name',
        'table_id',
        'user_name',
        'ip_address',
        'login_time',
        'logout_time',
        'login_date',
        'token',
        'login_response',
        'logout_response',
    ];
}
