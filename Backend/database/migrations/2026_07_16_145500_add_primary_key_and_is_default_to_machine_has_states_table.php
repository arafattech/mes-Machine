<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `machine_has_states` was created with no primary key and no unique
     * constraint — adds a surrogate `id` (needed for node-server/Prisma to
     * expose this model) plus `is_default`, marking which tagged state
     * applies when no configured channel reads HIGH. Requires the table to be
     * free of duplicate (machine_id, machine_state_id) rows before running.
     */
    public function up(): void
    {
        Schema::table('machine_has_states', function (Blueprint $table) {
            $table->id()->first();
            $table->boolean('is_default')->default(false)->after('machine_state_id');
            $table->unique(['machine_id', 'machine_state_id']);
        });
    }

    public function down(): void
    {
        Schema::table('machine_has_states', function (Blueprint $table) {
            $table->dropUnique(['machine_id', 'machine_state_id']);
            $table->dropColumn(['id', 'is_default']);
        });
    }
};
