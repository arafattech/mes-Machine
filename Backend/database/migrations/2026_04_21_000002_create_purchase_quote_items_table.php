<?php

use App\Enums\Purchase\PoStatus;
use App\Models\Product;
use App\Models\Purchase\PurchaseQuote;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_quote_items', function (Blueprint $table) {
            $table->id();

            $table->foreignIdFor(PurchaseQuote::class, 'purchase_quote_id')
                ->constrained('purchase_quotes')
                ->cascadeOnDelete();
            $table->foreignIdFor(Product::class, 'product_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->integer('quantity');
            $table->decimal('unit_price', 15, 2);
            $table->decimal('total_price', 15, 2);
            $table->date('delivery_date')->nullable();
            $table->string('status')->default(PoStatus::PENDING->value);
            $table->text('note')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_quote_items');
    }
};
