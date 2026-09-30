<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\User;
use App\Models\Department;
use App\Enums\Store\SprStatus;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('purchase_requisitions', function (Blueprint $table) {
            $table->id();
            $table->string('custom_id')->unique();
            // Relations
            $table->foreignIdFor(User::class, 'requested_by')->nullable()->constrained()->nullOnDelete();
            $table->foreignIdFor(Department::class)->nullable()->constrained()->nullOnDelete();
            // Fields
            $table->text('description')->nullable();
            $table->text('rejected_reason')->nullable();
            $table->date('request_date')->nullable();
            $table->date('required_by')->nullable();
            $table->string('status')->default(SprStatus::SUBMITTED->value);
            $table->decimal('estimated_cost', 15, 2)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_requisitions');
    }
};
