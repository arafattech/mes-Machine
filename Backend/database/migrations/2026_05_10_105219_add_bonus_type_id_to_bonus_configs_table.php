<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('bonus_configs', function (Blueprint $table) {
            $table->unsignedBigInteger('bonus_type_id')->nullable();
            $table->foreign('bonus_type_id')->references('id')->on('bonus_types')->nullOnDelete();
            $table->unsignedBigInteger('employee_id')->nullable();
            $table->foreign('employee_id')->references('id')->on('employees')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('bonus_configs', function (Blueprint $table) {
            $table->dropForeign(['bonus_type_id']);
            $table->dropColumn('bonus_type_id');
            $table->dropForeign(['employee_id']);
            $table->dropColumn('employee_id');
        });
    }
};
