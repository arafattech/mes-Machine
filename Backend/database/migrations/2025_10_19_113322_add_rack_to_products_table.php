<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('rack_no')->nullable()->after('variant_value');
            $table->string('current_stock')->nullable()->after('rack_no');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('rack_no');
            $table->dropColumn('current_stock');
        });
    }
};
