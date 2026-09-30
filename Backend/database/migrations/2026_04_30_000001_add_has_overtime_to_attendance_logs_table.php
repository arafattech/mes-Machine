<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->boolean('has_overtime')->default(false);
            $table->integer('overtime_minutes')->nullable();
        });
    }


    public function down(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->dropColumn('has_overtime');
            $table->dropColumn('overtime_minutes');
        });
    }
};
