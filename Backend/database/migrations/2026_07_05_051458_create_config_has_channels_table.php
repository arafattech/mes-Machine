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
        Schema::create('config_has_channels', function (Blueprint $table) {
            $table->id();

            $table->foreignId('config_id')
                ->constrained('machine_has_configs')
                ->cascadeOnDelete();

            $table->unsignedTinyInteger('channel_id');

            $table->enum('status', ['active', 'inactive', 'maintenance', 'idle'])
                ->default('inactive');

            $table->foreignId('machine_state_id')
                ->nullable()
                ->constrained('machine_states')
                ->nullOnDelete();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('config_has_channels');
    }
};
