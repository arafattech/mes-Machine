<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * `status` becomes a real enum — was a free-form nullable string with no
     * defined values anywhere in the codebase. Schema::table()->change() can't
     * alter an enum (no doctrine/dbal enum type), hence raw SQL.
     */
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE work_orders MODIFY status ENUM('pending', 'in_progress', 'completed', 'cancelled') NULL DEFAULT 'pending'",
        );
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE work_orders MODIFY status VARCHAR(20) NULL");
    }
};
