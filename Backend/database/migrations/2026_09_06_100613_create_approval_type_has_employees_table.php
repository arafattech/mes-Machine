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
        Schema::create('approval_type_has_employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('approval_type_id')->references('id')->on('approval_types')->onDelete('cascade');
            $table->foreignId('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->boolean('is_required')->default(true);
            $table->unsignedInteger('sequence_index')->default(1);
            $table->timestamps();
            $table->unique(['approval_type_id', 'employee_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('approval_type_has_employees');
    }
};
