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
        Schema::create('machine_transport_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('masch_id')->references('id')->on('machines')->onDelete('cascade');
            $table->string('transport', 10)->default('modbus')->comment('modbus or api');
            $table->string('api_url', 255)->nullable()->comment('HTTP endpoint for API transport');
            $table->json('api_signal_map')->nullable()->comment('Relay→signal mapping, e.g. {"F":1,"P":2,"A":3,"ZH":4,"HK":5}');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('machine_transport_configs');
    }
};
