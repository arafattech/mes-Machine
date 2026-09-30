<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_receipts', function (Blueprint $table) {
            $table->boolean('is_returned')->default(false)->after('status');
            $table->timestamp('returned_at')->nullable()->after('is_returned');
            $table->foreignIdFor(User::class, 'returned_by')
                ->nullable()
                ->after('returned_at')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('material_receipts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('returned_by');
            $table->dropColumn(['is_returned', 'returned_at']);
        });
    }
};
