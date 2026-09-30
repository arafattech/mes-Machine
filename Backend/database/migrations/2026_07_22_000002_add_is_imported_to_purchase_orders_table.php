<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Nullable + default — Lodata requires non-nullable columns present in every
            // insert payload, and not every existing caller sets this field. Inherited from
            // the source PurchaseRequisition when a PO is created from a quote (see
            // PurchaseOrderWorkflowController).
            $table->boolean('is_imported')->nullable()->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('is_imported');
        });
    }
};
