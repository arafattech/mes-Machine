<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\User;
use App\Models\Department;
use App\Models\Supplier;
use App\Models\Store\PurchaseRequisition;
use App\Enums\Purchase\PoStatus;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->unique();

            // 🔹 Relations
            $table->foreignIdFor(PurchaseRequisition::class, 'spr_id')->nullable()->constrained('purchase_requisitions')->nullOnDelete();
            $table->foreignIdFor(Supplier::class, 'supplier_id')->constrained()->cascadeOnDelete();
            $table->foreignIdFor(Department::class)->nullable()->constrained()->nullOnDelete();
            $table->foreignIdFor(User::class, 'created_by')->nullable()->constrained('users')->nullOnDelete();

            // 🔹 Fields
            $table->date('po_date')->nullable();
            $table->string('status')->default(PoStatus::PENDING->value);
            $table->decimal('total_amount', 15, 2)->nullable();
            $table->text('note')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};
