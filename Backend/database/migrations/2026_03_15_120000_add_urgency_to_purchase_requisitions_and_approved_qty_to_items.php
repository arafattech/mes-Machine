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
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->string('urgency')->nullable();
        });

        Schema::table('purchase_requisition_items', function (Blueprint $table) {
            $table->integer('approved_qty')->nullable();
            $table->decimal('total_price', 15, 2)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_requisition_items', function (Blueprint $table) {
            $table->dropColumn(['approved_qty', 'total_price']);
        });

        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->dropColumn('urgency');
        });
    }
};
