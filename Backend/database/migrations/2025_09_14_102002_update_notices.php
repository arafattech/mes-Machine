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
        Schema::table('notices', function (Blueprint $table) {

            if (Schema::hasColumn('notices', 'employee_id')) {
                $table->dropForeign(['employee_id']);
                $table->dropColumn('employee_id');
            }
            if (Schema::hasColumn('notices', 'department')) {
                $table->dropColumn('department');
            }

            $table->string('target_audience')->default('all')->after('title');
        });
    }
    public function down(): void
    {
        Schema::table('notices', function (Blueprint $table) {

            $table->dropColumn('target_audience');
        });
    }
};
