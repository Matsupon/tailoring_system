<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add 'Cancelled' to the status enum
        DB::statement("ALTER TABLE orders MODIFY status ENUM('Pending','Ready to Check','Completed','Finished','Cancelled') DEFAULT 'Pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove 'Cancelled' from the status enum
        DB::statement("ALTER TABLE orders MODIFY status ENUM('Pending','Ready to Check','Completed','Finished') DEFAULT 'Pending'");
    }
};

