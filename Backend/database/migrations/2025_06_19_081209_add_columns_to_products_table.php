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
        Schema::table('products', function (Blueprint $table) {
          $table->string('part_number')->nullable()->after('product_name');
          $table->string('model_number')->nullable()->after('part_number');
          $table->string('price_in_bdt')->nullable()->after('model_number');
          $table->string('price_in_usd')->nullable()->after('price_in_bdt');
          $table->string('unit_price')->nullable()->after('price_in_usd');
          $table->string('currency')->nullable()->after('unit_price');
          $table->longText('description')->nullable()->after('currency');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            //
        });
    }
};
