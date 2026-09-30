<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotion_configurations', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->nullable()->index();
            $table->boolean('is_active')->default(true)->index();
            $table->string('name')->nullable();

            $table->string('scope_type', 30)->index();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignId('employee_group_id')->nullable()->constrained('employee_groups')->nullOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->cascadeOnDelete();

            $table->string('schedule_type', 30)->index();
            $table->unsignedSmallInteger('months_of_service')->nullable();
            $table->date('eligibility_date')->nullable()->index();
            $table->date('start_date')->nullable()->index();
            $table->date('end_date')->nullable()->index();
            $table->unsignedSmallInteger('expiry_days')->default(7);

            $table->string('promotion_title')->nullable();
            $table->string('promotion_type')->default('regular');
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['scope_type', 'department_id']);
            $table->index(['scope_type', 'employee_group_id']);
            $table->index(['scope_type', 'employee_id']);
        });
    }
};
