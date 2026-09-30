<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_receipt_items', function (Blueprint $table) {
            // Quantity rejected on QA inspection at goods receipt.
            $table->integer('rejected_quantity')->nullable()->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('material_receipt_items', function (Blueprint $table) {
            $table->dropColumn('rejected_quantity');
        });
    }
};
