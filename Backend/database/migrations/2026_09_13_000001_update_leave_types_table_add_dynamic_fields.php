<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->renameColumn('days', 'max_days');
        });

        Schema::table('leave_types', function (Blueprint $table) {
            $table->boolean('is_paid')->default(true)->after('max_days');
            $table->boolean('document_required')->default(false)->after('is_paid');
            $table->unsignedBigInteger('approval_type_id')->nullable()->after('document_required');
            $table->unique('name');
            $table->boolean('is_active')->default(true)->after('name');
            $table->foreign('approval_type_id')->references('id')->on('approval_types')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->dropForeign(['approval_type_id']);
            $table->dropUnique(['name']);
            $table->dropColumn(['is_paid', 'document_required', 'approval_type_id', 'is_active']);
        });

        Schema::table('leave_types', function (Blueprint $table) {
            $table->renameColumn('max_days', 'days');
        });
    }
};
