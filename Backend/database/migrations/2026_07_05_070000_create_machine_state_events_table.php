<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * State-change history for machines. One row per channel-derived state the
     * machine enters; the row stays open (`ended_at` null) until the next
     * change closes it with a duration. Feeds runtime / idle / maintenance /
     * OEE / KPI calculations. `state` is kept best-effort alongside the
     * authoritative `machine_state_id` FK — nullable since an admin-defined
     * state (e.g. "Changeover") has no slot in the fixed enum.
     */
    public function up(): void
    {
        Schema::create('machine_state_events', function (Blueprint $table) {
            $table->id();

            $table->foreignId('machine_id')
                ->constrained('machines')
                ->cascadeOnDelete();

            $table->enum('state', ['active', 'inactive', 'maintenance', 'idle', 'fault'])->nullable();

            $table->foreignId('machine_state_id')
                ->nullable()
                ->constrained('machine_states')
                ->nullOnDelete();

            $table->dateTime('started_at');                        // change timestamp
            $table->dateTime('ended_at')->nullable();              // null = current
            $table->unsignedInteger('duration_seconds')->nullable(); // set on close

            $table->timestamps();

            $table->index(['machine_id', 'started_at']);
            $table->index(['machine_id', 'ended_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_state_events');
    }
};
