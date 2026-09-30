<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->date('joining_date_snapshot')->nullable()->after('employee_id');
            $table->string('increment_type', 20)->nullable()->after('salary_increment');
            $table->decimal('inc_value', 10, 2)->nullable()->after('increment_type');
            $table->foreignId('old_designation_id')->nullable()->after('inc_value')->constrained('designations')->nullOnDelete();
            $table->foreignId('new_designation_id')->nullable()->after('old_designation_id')->constrained('designations')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->dropForeign(['old_designation_id']);
            $table->dropForeign(['new_designation_id']);
            $table->dropColumn(['joining_date_snapshot', 'increment_type', 'inc_value', 'old_designation_id', 'new_designation_id']);
        });
    }
};