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
        Schema::table('employee_groups', function (Blueprint $table) {
            if (!Schema::hasColumn('employee_groups', 'is_permanent')) {
                $table->boolean('is_permanent')->default(false)->after('is_active');
            }

            if (!Schema::hasColumn('employee_groups', 'shift_id')) {
                $table->unsignedBigInteger('shift_id')->nullable()->after('is_permanent');
            }
        });

        if (Schema::hasColumn('employee_groups', 'shift_id')) {
            try {
                Schema::table('employee_groups', function (Blueprint $table) {
                    $table->foreign('shift_id')
                        ->references('id')
                        ->on('employee_shifts')
                        ->nullOnDelete();
                });
            } catch (\Throwable $e) {
                // Foreign key may already exist or the table may be partially migrated.
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('employee_groups') && Schema::hasColumn('employee_groups', 'shift_id')) {
            try {
                Schema::table('employee_groups', function (Blueprint $table) {
                    $table->dropForeign(['shift_id']);
                });
            } catch (\Throwable $e) {
                // Foreign key may not exist.
            }

            Schema::table('employee_groups', function (Blueprint $table) {
                $table->dropColumn('shift_id');
            });
        }

        if (Schema::hasTable('employee_groups') && Schema::hasColumn('employee_groups', 'is_permanent')) {
            Schema::table('employee_groups', function (Blueprint $table) {
                $table->dropColumn('is_permanent');
            });
        }
    }
};
