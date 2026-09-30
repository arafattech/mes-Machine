<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_receipts', function (Blueprint $table) {
            $table->string('vehicle_no')->nullable()->after('lc_no');
        });
    }

    public function down(): void
    {
        Schema::table('material_receipts', function (Blueprint $table) {
            $table->dropColumn('vehicle_no');
        });
    }
};
