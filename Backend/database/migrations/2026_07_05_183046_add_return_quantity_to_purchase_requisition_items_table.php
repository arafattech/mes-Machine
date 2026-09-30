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
        Schema::table('purchase_requisition_items', function (Blueprint $table) {
            // Cumulative quantity returned against this SR item across all approved returns.
            // Nullable to match required_quantity's convention — Lodata treats non-nullable
            // columns as mandatory on every insert, which broke plain SR-item creation.
            $table->integer('return_quantity')->nullable()->default(0);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_requisition_items', function (Blueprint $table) {
            $table->dropColumn('return_quantity');
        });
    }
};
