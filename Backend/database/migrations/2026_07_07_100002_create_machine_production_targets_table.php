<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Explicit per-machine production target, optionally scoped to a work order
     * and/or shift. Open question (flagged in the enhancement plan): whether this
     * should instead be derived from `work_orders.quantity` prorated to the shift
     * — kept as an explicit entry for now since no target-entry UI exists yet
     * either way, and an explicit value is simplest to compute against.
     */
    public function up(): void
    {
        Schema::create('machine_production_targets', function (Blueprint $table) {
            $table->id();

            $table->foreignId('machine_id')
                ->constrained('machines')
                ->cascadeOnDelete();

            $table->foreignId('work_order_id')
                ->nullable()
                ->constrained('work_orders')
                ->nullOnDelete();

            $table->foreignId('shift_id')
                ->nullable()
                ->constrained('employee_shifts')
                ->nullOnDelete();

            $table->unsignedInteger('target_qty');
            $table->dateTime('effective_from');
            $table->dateTime('effective_to')->nullable();
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index(['machine_id', 'effective_from']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_production_targets');
    }
};
