<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Append-only wastage ledger: one row per manually-entered total
     * (work order + wastage type + optional shift + date), the source of
     * truth a `machine_wastage_allocations` row is ever derived from.
     */
    public function up(): void
    {
        Schema::create('machine_wastage_entries', function (Blueprint $table) {
            $table->id();

            $table->foreignId('work_order_id')
                ->constrained('work_orders')
                ->cascadeOnDelete();

            $table->foreignId('wastage_type_id')
                ->constrained('machine_wastage_types')
                ->cascadeOnDelete();

            $table->foreignId('shift_id')
                ->nullable()
                ->constrained('employee_shifts')
                ->nullOnDelete();

            $table->date('entry_date');
            $table->decimal('qty_kg', 10, 2);

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index(['work_order_id', 'entry_date']);
            $table->index('wastage_type_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_wastage_entries');
    }
};
