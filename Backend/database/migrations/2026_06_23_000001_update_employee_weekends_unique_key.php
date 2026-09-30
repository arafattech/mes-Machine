<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_weekends', function (Blueprint $table) {
            // Add new unique first so MySQL has a valid backing index for the FK on employee_id
            $table->unique(['employee_id', 'weekend_date', 'type'], 'employee_weekends_employee_id_weekend_date_type_unique');
        });

        Schema::table('employee_weekends', function (Blueprint $table) {
            $table->dropUnique('employee_weekends_employee_id_weekend_date_unique');
        });
    }

    public function down(): void
    {
        Schema::table('employee_weekends', function (Blueprint $table) {
            $table->unique(['employee_id', 'weekend_date'], 'employee_weekends_employee_id_weekend_date_unique');
        });

        Schema::table('employee_weekends', function (Blueprint $table) {
            $table->dropUnique('employee_weekends_employee_id_weekend_date_type_unique');
        });
    }
};
