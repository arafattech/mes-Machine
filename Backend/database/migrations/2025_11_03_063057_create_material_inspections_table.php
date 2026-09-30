<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Store\MaterialReceipt;
use App\Models\User;
use App\Enums\Purchase\PoStatus;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('material_inspections', function (Blueprint $table) {
            $table->id();

            // 🔹 Relations
            $table->foreignIdFor(MaterialReceipt::class, 'material_receipt_id')->constrained()->cascadeOnDelete();
            $table->foreignIdFor(User::class, 'inspected_by')->nullable()->constrained('users')->nullOnDelete();

            // 🔹 Fields
            $table->date('inspection_date')->nullable();
            $table->text('remarks')->nullable();
            $table->string('status')->default(PoStatus::PENDING->value);

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('material_inspections');
    }
};
