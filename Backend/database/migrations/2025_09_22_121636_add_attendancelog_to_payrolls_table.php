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
        Schema::table('payrolls', function (Blueprint $table) {
            $table->integer('total_attendance')->nullable();
            $table->integer('total_nightshift')->nullable();
            $table->decimal('nightshift_bonus', 10, 2)->nullable();
            $table->decimal('attendance_bonus', 10, 2)->nullable();
            $table->integer('total_holidays')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropColumn([
                'total_attendance',
                'total_nightshift',
                'nightshift_bonus',
                'attendance_bonus',
                'total_holidays',
            ]);
        });
    }
};
