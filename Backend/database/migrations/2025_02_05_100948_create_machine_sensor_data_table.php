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
        Schema::create('machine_sensor_data', function (Blueprint $table) {
            $table->id();
            $table->boolean('is_active')->default(true);
            $table->string('custom_id')->nullable();
            $table->foreignId('machine_id')->constrained('machines')->onDelete('cascade');
            $table->dateTime('timestamp', 6);
            $table->decimal('temperature', 10, 2);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('machine_sensor_data');
    }
};
