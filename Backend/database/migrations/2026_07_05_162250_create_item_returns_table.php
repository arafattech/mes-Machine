<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\User;
use App\Models\Department;
use App\Models\Store\PurchaseRequisition;
use App\Enums\Store\ItemReturnStatus;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Header — one return raised against a department's already-issued (FINAL_APPROVAL) SR.
        Schema::create('item_returns', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->unique();
            $table->foreignIdFor(PurchaseRequisition::class, 'purchase_requisition_id')
                ->constrained('purchase_requisitions')
                ->cascadeOnDelete();
            $table->foreignIdFor(Department::class)->nullable()->constrained()->nullOnDelete();
            $table->foreignIdFor(User::class, 'requested_by')->nullable()->constrained()->nullOnDelete();
            $table->text('reason')->nullable();
            $table->date('return_date')->nullable();
            $table->string('status')->default(ItemReturnStatus::PENDING->value);
            $table->boolean('is_received')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('item_returns');
    }
};
