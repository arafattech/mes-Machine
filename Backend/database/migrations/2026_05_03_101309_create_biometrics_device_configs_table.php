<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('biometrics_device_configs', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('name');
            $table->string('ip')->unique();
            $table->integer('port')->default(4370);
            $table->integer('timeout')->default(10000);
            $table->integer('inport')->default(4000);
            $table->timestamps();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('biometrics_device_configs');
    }
};
