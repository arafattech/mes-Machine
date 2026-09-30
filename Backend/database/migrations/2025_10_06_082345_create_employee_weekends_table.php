<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_weekends', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('weekend_date');                  
            $table->string('type')->nullable()->default('WEEKEND');   
            $table->string('status')->nullable()->default('APPROVED'); 
            $table->string('reason')->nullable();          
            $table->timestamps();

            $table->unique(['employee_id', 'weekend_date']); 
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_weekends');
    }
};
