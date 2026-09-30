<?php

use App\Models\Department;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Store\PurchaseRequisition;
use App\Models\Supplier;
use App\Models\User;
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
        Schema::table('material_receipts', function (Blueprint $table) {
            $table->foreignIdFor(PurchaseOrder::class, 'purchase_order_id')
                ->nullable()
                ->change();

            $table->foreignIdFor(PurchaseRequisition::class, 'purchase_requisition_id')
                ->nullable()
                ->after('purchase_order_id')
                ->constrained('purchase_requisitions')
                ->nullOnDelete();

            $table->foreignIdFor(Supplier::class, 'supplier_id')
                ->nullable()
                ->after('purchase_requisition_id')
                ->constrained()
                ->nullOnDelete();

            $table->foreignIdFor(Department::class, 'department_id')
                ->nullable()
                ->after('supplier_id')
                ->constrained()
                ->nullOnDelete();

            $table->foreignIdFor(User::class, 'requested_by')
                ->nullable()
                ->after('department_id')
                ->constrained('users')
                ->nullOnDelete();

            $table->string('source')->default('LOCAL')->after('requested_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('material_receipts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('purchase_requisition_id');
            $table->dropConstrainedForeignId('supplier_id');
            $table->dropConstrainedForeignId('department_id');
            $table->dropConstrainedForeignId('requested_by');
            $table->dropColumn('source');

            $table->foreignIdFor(PurchaseOrder::class, 'purchase_order_id')
                ->nullable(false)
                ->change();
        });
    }
};
