<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Computed per-machine split of a `machine_wastage_entries` row, stored
     * (not recomputed on read) so per-machine wastage reporting never redoes
     * the distribution math. `production_share` is null when no production
     * counts existed for the entry's scope yet and an equal split was used
     * instead of a proportional one.
     */
    public function up(): void
    {
        Schema::create('machine_wastage_allocations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('wastage_entry_id')
                ->constrained('machine_wastage_entries')
                ->cascadeOnDelete();

            $table->foreignId('machine_id')
                ->constrained('machines')
                ->cascadeOnDelete();

            $table->decimal('allocated_qty_kg', 10, 2);
            $table->decimal('production_share', 6, 5)->nullable();

            $table->timestamps();

            $table->unique(['wastage_entry_id', 'machine_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_wastage_allocations');
    }
};
