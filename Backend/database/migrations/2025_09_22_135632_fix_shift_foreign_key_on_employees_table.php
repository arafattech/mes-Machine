<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class FixShiftForeignKeyOnEmployeesTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('employees') && Schema::hasColumn('employees', 'shift_id')) {
            $foreignKeyName = $this->getForeignKeyName('employees', 'shift_id');

            if ($foreignKeyName) {
                Schema::table('employees', function (Blueprint $table) use ($foreignKeyName) {
                    $table->dropForeign($foreignKeyName);
                });
            }

            Schema::table('employees', function (Blueprint $table) {
                $table->unsignedBigInteger('shift_id')->nullable()->change();

                $table->foreign('shift_id')
                      ->references('id')
                      ->on('employee_shifts')
                      ->nullOnDelete();  
            });
        }
    }

    public function down()
    {
        if (Schema::hasTable('employees') && Schema::hasColumn('employees', 'shift_id')) {
            $foreignKeyName = $this->getForeignKeyName('employees', 'shift_id');

            if ($foreignKeyName) {
                Schema::table('employees', function (Blueprint $table) use ($foreignKeyName) {
                    $table->dropForeign($foreignKeyName);
                });
            }

            Schema::table('employees', function (Blueprint $table) {
                $table->foreign('shift_id')
                      ->references('id')
                      ->on('employee_shifts');

            });
        }
    }

    /**
     * Helper to get the foreign key constraint name on a column.
     */
    protected function getForeignKeyName(string $table, string $column): ?string
    {
        $database = env('DB_DATABASE');

        $result = DB::selectOne("
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = ?
              AND COLUMN_NAME = ?
              AND REFERENCED_TABLE_NAME IS NOT NULL
            LIMIT 1
        ", [$database, $table, $column]);

        return $result ? $result->CONSTRAINT_NAME : null;
    }
}
