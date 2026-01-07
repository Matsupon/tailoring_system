<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Add handled boolean column
            if (!Schema::hasColumn('orders', 'handled')) {
                $table->boolean('handled')->default(false)->after('status');
            }
        });

        // Remove 'Ongoing' from status enum
        DB::statement("ALTER TABLE orders MODIFY status ENUM('Pending','Ready to Check','Completed','Finished') DEFAULT 'Pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'handled')) {
                $table->dropColumn('handled');
            }
        });

        // Restore 'Ongoing' to status enum
        DB::statement("ALTER TABLE orders MODIFY status ENUM('Pending','Ongoing','Ready to Check','Completed','Finished') DEFAULT 'Pending'");
    }
};
