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
        Schema::create('maintenance_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->constrained('machines')->cascadeOnDelete();
            $table->date('start_date');
            $table->string('scheduled_time', 20); // e.g. "10:30 AM"
            $table->enum('frequency', ['weekly', '10-days', '15-days', 'monthly', 'yearly']);
            $table->boolean('is_active')->default(true);
            $table->dateTime('next_maintenance_date'); // Date + Time stored together or Date only? Let's use dateTime
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('maintenance_schedules');
    }
};
