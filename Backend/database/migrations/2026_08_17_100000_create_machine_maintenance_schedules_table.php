<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Manual machine-maintenance scheduling. A row is SCHEDULED (future) while
     * `activated_at` is null, ACTIVE once `activated_at` is set (override
     * signalled to node-server), and closed when `ended_at` is set — either
     * manually (End Maintenance) or automatically by node-server when the
     * machine's real Active channel confirms running again (`ended_by='auto'`).
     *
     * Deliberately a separate table from `machine_state_events`: a future-dated
     * schedule must never look like current live state, and node-server remains
     * the only writer of `machine_state_events`. Laravel only writes this table
     * plus a Redis override set (see MachineMaintenanceOverrideSignal).
     */
    public function up(): void
    {
        Schema::create('machine_maintenance_schedules', function (Blueprint $table) {
            $table->id();

            $table->foreignId('machine_id')
                ->constrained('machines')
                ->cascadeOnDelete();

            $table->dateTime('scheduled_start_at');       // requested, future or now
            $table->dateTime('activated_at')->nullable(); // set when override actually goes live; null = still SCHEDULED
            $table->dateTime('ended_at')->nullable();     // null = still open (pending or active)
            $table->enum('ended_by', ['manual', 'auto'])->nullable();
            $table->foreignId('ended_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->foreignId('created_by_user_id')
                ->constrained('users');

            $table->timestamps();

            $table->index(['machine_id', 'ended_at']);
            $table->index('scheduled_start_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_maintenance_schedules');
    }
};
