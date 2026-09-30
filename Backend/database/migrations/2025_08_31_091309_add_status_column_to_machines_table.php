<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('machines', function (Blueprint $table) {
            $table->boolean('has_temperature')->default(false)->after('is_active');
            $table->boolean('has_rpm')->default(false)->after('has_temperature');
            $table->boolean('has_config')->default(false)->after('has_rpm');
        });
    }

    public function down(): void
    {
        Schema::table('machines', function (Blueprint $table) {
            $table->dropColumn('has_temperature');
            $table->dropColumn('has_rpm');
            $table->dropColumn('has_config');
        });
    }
};
