<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->timestamp('approved_at')->nullable()->after('approved_by');
            $table->foreignIdFor(User::class, 'final_approved_by')->nullable()->after('approved_at');
            $table->timestamp('final_approved_at')->nullable()->after('final_approved_by');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_requisitions', function (Blueprint $table) {
            $table->dropColumn(['approved_at', 'final_approved_by', 'final_approved_at']);
        });
    }
};
