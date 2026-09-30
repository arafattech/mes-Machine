<?php

use App\Models\Store\MaterialReceipt;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mrr_returns', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->nullable();
            $table->foreignIdFor(MaterialReceipt::class, 'material_receipt_id')
                ->constrained('material_receipts')
                ->cascadeOnDelete();
            $table->foreignIdFor(User::class, 'returned_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->date('return_date')->nullable();
            $table->integer('total_quantity')->default(0);
            $table->text('remarks')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mrr_returns');
    }
};
