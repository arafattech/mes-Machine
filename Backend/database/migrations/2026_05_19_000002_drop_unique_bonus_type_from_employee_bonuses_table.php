<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasIndex('employee_bonuses', ['bonus_type'], 'unique')) {
            Schema::table('employee_bonuses', function (Blueprint $table) {
                $table->dropUnique(['bonus_type']);
            });
        }
    }

    public function down(): void
    {
        Schema::table('employee_bonuses', function (Blueprint $table) {
            $table->unique('bonus_type');
        });
    }
};
