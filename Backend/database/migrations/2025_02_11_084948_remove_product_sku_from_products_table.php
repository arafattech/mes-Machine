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
        // Check if the column exists before attempting to drop it
        if (Schema::hasColumn('products', 'product_sku')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('product_sku');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // If you need to restore the column in the down method (optional)
        if (!Schema::hasColumn('products', 'product_sku')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('product_sku', 50)->unique();  // You can modify this as needed
            });
        }
    }
};
