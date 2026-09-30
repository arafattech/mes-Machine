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
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->nullable();
            $table->boolean('is_active')->default(true);

            $table->unsignedBigInteger('employee_id');

            // Promotion Info
            $table->string('promotion_title')->nullable();
            $table->string('promotion_type')->default('regular');

            // Position Change
            $table->string('old_designation');
            $table->string('new_designation');

            $table->unsignedBigInteger('old_department_id')->nullable();
            $table->unsignedBigInteger('new_department_id')->nullable();

            // Salary Info
            $table->decimal('old_salary', 10, 2)->nullable();
            $table->decimal('new_salary', 10, 2)->nullable();
            $table->decimal('salary_increment', 10, 2)->nullable();

            // Date Info
            $table->date('promotion_date')->nullable();
            $table->date('effective_date')->nullable();

            // Reason Info
            $table->string('note')->nullable();

            $table->timestamps();

            // Foreign Keys 
            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
            $table->foreign('old_department_id')->references('id')->on('departments')->nullOnDelete();
            $table->foreign('new_department_id')->references('id')->on('departments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotions');
    }
};
