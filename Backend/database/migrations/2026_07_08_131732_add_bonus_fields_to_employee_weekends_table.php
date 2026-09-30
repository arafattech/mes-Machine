<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_weekends', function (Blueprint $table) {
            $table->string('bonus_mode')->nullable()->after('type_id');
            $table->decimal('bonus_amount', 12, 2)->nullable()->after('bonus_mode');
        });
    }

    public function down(): void
    {
        Schema::table('employee_weekends', function (Blueprint $table) {
            $table->dropColumn(['bonus_mode', 'bonus_amount']);
        });
    }
};
