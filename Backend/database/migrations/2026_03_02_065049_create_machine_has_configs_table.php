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
        Schema::create('machine_has_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->references('id')->on('machines')->onDelete('cascade');
            $table->string('machine_name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->Integer('config_id')->nullable();
            $table->string('ip_plc')->default('');
            $table->string('id_iot')->nullable();
            $table->string('protocol')->default('HTTP');
            $table->string('type')->default('Cast/cast_sig');
            $table->string('read_from')->default('GPIO');
            $table->string('ip_hmi')->nullable();
            $table->integer('port')->nullable();
            $table->integer('websocket_port')->nullable();
            $table->integer('max_rpm')->nullable();
            $table->integer('min_rpm')->nullable();
            $table->integer('max_temp')->nullable();
            $table->integer('min_temp')->nullable();
            $table->integer('shot_buffer')->nullable();
            $table->integer('timeout_sec')->nullable();
            $table->integer('server_call_sec')->nullable();
            $table->string('auto_signal')->nullable();
            $table->string('shot_signal')->nullable();
            $table->boolean('inverse_auto')->default(false);
            $table->boolean('inverse_shot')->default(false);
            $table->boolean('auto_independent')->default(false);
            $table->string('live_status_api')->nullable();
            $table->string('live_shot_api')->nullable();
            $table->string('test_status_api')->nullable();
            $table->string('test_shot_api')->nullable();
            $table->boolean('active')->default(false);
            $table->boolean('scrap')->default(false);
            $table->boolean('robot_active')->default(false);
            $table->string('robot')->nullable();
            $table->boolean('press_active')->default(false);
            $table->string('press')->nullable();
            $table->boolean('handling_active')->default(false);
            $table->string('handling')->nullable();
            $table->string('selection_type')->nullable();
            $table->dateTime('heating_start')->nullable();
            $table->integer('order_of_machine')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('machine_has_configs');
    }
};
