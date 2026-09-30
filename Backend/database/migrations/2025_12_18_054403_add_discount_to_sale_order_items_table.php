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
        Schema::table('sale_order_items', function (Blueprint $table) {
              $table->decimal('discount', 30, 2)->nullable()->after('total_price');
              $table->string('discount_amount')->nullable()->after('discount');
              $table->string('discount_type')->nullable()->after('discount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sale_order_items', function (Blueprint $table) {
            $table->dropColumn('discount');
            $table->dropColumn('discount_amount');
            $table->dropColumn('discount_type');
        });
    }
};
