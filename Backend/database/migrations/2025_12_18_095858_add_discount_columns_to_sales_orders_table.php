<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->string('discount_option')
                ->nullable()
                ->default('ALL');

            $table->decimal('discount_amount', 30, 2)
                ->nullable();

            $table->string('discount_type')
                ->nullable();

        });
    }

    public function down(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropColumn([
                'discount_option',
                'discount_amount',
                'discount_type',

            ]);
        });
    }
};
