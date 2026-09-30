<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Purchase\PurchaseOrder;
use App\Models\User;
use App\Enums\Store\SprStatus;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('material_receipts', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->unique();
            // 🔹 Relations
            $table->foreignIdFor(PurchaseOrder::class, 'purchase_order_id')->constrained()->cascadeOnDelete();
            $table->foreignIdFor(User::class, 'created_by')->nullable()->constrained('users')->nullOnDelete();

            // 🔹 Fields
            $table->date('receipt_date')->nullable();
            $table->text('remarks')->nullable();
            $table->string('status')->default(SprStatus::APPROVED->value);

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('material_receipts');
    }
};
