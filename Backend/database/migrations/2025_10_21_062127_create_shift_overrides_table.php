<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shift_overrides', function (Blueprint $table) {
            $table->id();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('shift_id')->nullable();
            $table->unsignedBigInteger('second_shift_id')->nullable();
            $table->date('date');
            $table->string('custom_id')->nullable();
            $table->unsignedBigInteger('absent_employee_id')->nullable();
            $table->unsignedBigInteger('replacement_employee_id')->nullable();
            $table->enum('type', ['REPLACEMENT', 'SWAP', 'EXTRA'])->default('REPLACEMENT');
            $table->timestamps();
            $table->foreign('shift_id')->references('id')->on('employee_shifts')->onDelete('cascade');
            $table->foreign('second_shift_id')->references('id')->on('employee_shifts')->onDelete('cascade');
            $table->foreign('absent_employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('replacement_employee_id')->references('id')->on('employees')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_overrides');
    }
};
