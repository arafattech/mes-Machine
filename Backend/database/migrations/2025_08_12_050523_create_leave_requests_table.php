<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_requests', function (Blueprint $table) {
            $table->id();
            $table->boolean('is_active')->default(true);
            $table->string('custom_id')->unique();
            $table->foreignId('supervisor_id')->nullable()->constrained('employees')->onDelete('cascade');
            $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
            $table->date('start_date');
            $table->date('end_date');

            $table->unsignedBigInteger('leave_type_id')->nullable();
            $table->string('leave_type_name')->nullable();
            $table->text('reason')->nullable();

            $table->enum('supervisor_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('supervisor_remarks')->nullable();
            $table->timestamp('supervisor_action_at')->nullable();

            $table->foreignId('hr_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->enum('hr_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('hr_remarks')->nullable();
            $table->timestamp('hr_action_at')->nullable();

            $table->enum('final_status', ['pending', 'approved', 'rejected'])->default('pending');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_requests');
    }
};
