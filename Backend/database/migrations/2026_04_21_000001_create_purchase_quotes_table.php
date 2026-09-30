<?php

use App\Models\Store\PurchaseRequisition;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_quotes', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->unique();

            $table->foreignIdFor(PurchaseRequisition::class, 'purchase_requisition_id')
                ->constrained('purchase_requisitions')
                ->cascadeOnDelete();
            $table->foreignIdFor(Supplier::class, 'supplier_id')
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignIdFor(User::class, 'created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->date('quote_date')->nullable();
            $table->date('valid_until')->nullable();
            $table->string('status')->default('SUBMITTED');
            $table->decimal('total_amount', 15, 2)->nullable();
            $table->text('note')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_quotes');
    }
};
