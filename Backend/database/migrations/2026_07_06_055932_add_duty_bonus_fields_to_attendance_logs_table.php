<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->boolean('is_ramadan_duty')->default(false)->after('overtime_status');
            $table->boolean('is_eid_duty')->default(false)->after('is_ramadan_duty');
            $table->string('ramadan_status')->nullable()->after('is_eid_duty');
            $table->string('eid_status')->nullable()->after('ramadan_status');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->dropColumn(['is_ramadan_duty', 'is_eid_duty', 'ramadan_status', 'eid_status']);
        });
    }
};
