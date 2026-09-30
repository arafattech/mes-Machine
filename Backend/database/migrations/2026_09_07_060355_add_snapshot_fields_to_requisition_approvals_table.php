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
        Schema::table('requisition_approvals', function (Blueprint $table) {
            $table->boolean('is_required')->default(true)->after('employee_id');
            $table->unsignedInteger('sequence_index')->default(1)->after('is_required');
            $table->timestamp('approved_at')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('requisition_approvals', function (Blueprint $table) {
            $table->dropColumn(['is_required', 'sequence_index']);
            $table->timestamp('approved_at')->nullable(false)->change();
        });
    }
};
