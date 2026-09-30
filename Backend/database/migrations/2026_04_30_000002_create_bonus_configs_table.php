<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::create('bonus_configs', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->unique()->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('calculation_type')->nullable();
            $table->string('applicable_to')->nullable();
            $table->string('name')->nullable();
            $table->decimal('amount', 12, 2)->nullable();
            $table->unsignedBigInteger('group_id')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->timestamps();

            $table->foreign('group_id')->references('id')->on('employee_groups')->nullOnDelete();
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bonus_configs');
    }
};
