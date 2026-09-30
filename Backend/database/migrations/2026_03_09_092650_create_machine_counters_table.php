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
        Schema::create('machine_counters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('masch_id')->references('id')->on('machines')->onDelete('cascade');

            $table->unsignedInteger('shot_nr')->default(0);
            $table->unsignedInteger('last_cycle_time')->default(0);
            $table->unsignedInteger('cycle_time')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('machine_counters');
    }
};
