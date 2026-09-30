<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            // Change expected_delivery_date to datetime
            $table->dateTime('expected_delivery_date')->nullable()->change();

            // Add soft deletes
            $table->softDeletes();

            // Add financial fields
            $table->decimal('discount', 12, 2)->default(0)->after('due_amount');
            $table->decimal('vat', 12, 2)->default(0)->after('discount');
            $table->decimal('grand_total', 12, 2)->default(0)->after('vat');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->date('expected_delivery_date')->nullable()->change();
            $table->dropSoftDeletes();
            $table->dropColumn(['discount', 'vat', 'grand_total']);
        });
    }
};
