<?php

use App\Models\Store\MaterialReceipt;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(MaterialReceipt::class, 'mrr_id')->nullable()->constrained('material_receipts')->nullOnDelete();
            $table->text('message');
            $table->text('purchase_message')->nullable();
            $table->date('reminder_date');
            $table->boolean('is_read')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->index(['is_read', 'reminder_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reminders');
    }
};
