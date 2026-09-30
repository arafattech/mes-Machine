<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->foreignId('promotion_configuration_id')
                ->nullable()
                ->after('employee_id')
                ->constrained('promotion_configurations')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->dropForeign(['promotion_configuration_id']);
            $table->dropColumn('promotion_configuration_id');
        });
    }
};
