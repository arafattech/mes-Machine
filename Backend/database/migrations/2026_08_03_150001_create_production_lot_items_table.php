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
        Schema::create('production_lot_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_lot_count_id')->constrained('production_lot_counts')->cascadeOnDelete();
            $table->unsignedInteger('bag_no');
            $table->unsignedInteger('cone_count');
            $table->decimal('gross_weight_kg', 10, 2);
            $table->decimal('net_weight_kg', 10, 2);
            $table->text('remark')->nullable();
            $table->timestamps();

            $table->unique(['production_lot_count_id', 'bag_no']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('production_lot_items');
    }
};
