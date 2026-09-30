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
        Schema::create('yarn_transfer_advice_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('advice_id')->constrained('yarn_transfer_advices')->cascadeOnDelete();
            $table->foreignId('production_lot_count_id')->constrained('production_lot_counts')->cascadeOnDelete();

            $table->string('lot_no')->nullable();
            $table->unsignedInteger('first_bag_serial')->nullable();
            $table->unsignedInteger('last_bag_serial')->nullable();

            $table->unsignedInteger('qty_out_cones');
            $table->decimal('gross_weight_kg_out', 10, 2)->nullable();
            $table->decimal('net_weight_kg_out', 10, 2)->nullable();

            $table->unsignedInteger('qty_in_cones')->nullable();
            $table->decimal('net_weight_kg_in', 10, 2)->nullable();
            $table->integer('variance_cones')->nullable();

            $table->string('status')->default('PENDING');
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('received_at')->nullable();
            $table->text('remark')->nullable();

            $table->timestamps();

            $table->unique(['advice_id', 'production_lot_count_id'], 'yarn_advice_lines_advice_count_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('yarn_transfer_advice_lines');
    }
};
