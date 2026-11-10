<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-machine dashboard layout for `/production/mco`. Values mirror the frontend
     * `MachineDashboardViewType` enum (OEE_PRODUCTION | RUNTIME_STATUS | SAP_FIORI); the
     * default keeps every existing machine on the original OEE dashboard.
     */
    public function up(): void
    {
        Schema::table('machines', function (Blueprint $table) {
            $table->string('dashboard_view', 20)->default('OEE_PRODUCTION')->after('has_wastage');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('machines', function (Blueprint $table) {
            $table->dropColumn('dashboard_view');
        });
    }
};
