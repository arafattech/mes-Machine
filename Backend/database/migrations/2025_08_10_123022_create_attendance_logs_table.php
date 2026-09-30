<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('attendance_logs', function (Blueprint $table) {
           $table->id();
           $table->boolean('is_active')->default(true);
           $table->unsignedBigInteger('employee_id')->nullable();
           $table->string('employee_no', 50)->nullable();
           $table->date('attendance_date');
           $table->dateTime('check_in_time');
           $table->dateTime('check_out_time')->nullable();
           $table->timestamps();

           $table->index('employee_id');
           $table->index('employee_no');
           $table->index('attendance_date');

           $table->unique(['employee_no', 'attendance_date', 'check_in_time'], 'unique_attendance');
           $table->foreign('employee_id')->references('id')->on('employees')->onDelete('set null');

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_logs');
    }
};
