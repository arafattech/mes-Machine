<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_holiday_swaps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();

            $table->date('original_holiday_date');  
            $table->date('swapped_holiday_date');  

            $table->string('type')->nullable()->default('HOLIDAY');   
            $table->string('status')->nullable()->default('APPROVED');
            $table->string('reason')->nullable();   

            $table->timestamps();

            $table->unique(['employee_id', 'original_holiday_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_holiday_swaps');
    }
};
