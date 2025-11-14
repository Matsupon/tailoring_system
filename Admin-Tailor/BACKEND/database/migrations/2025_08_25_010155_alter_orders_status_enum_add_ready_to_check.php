<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE orders MODIFY status ENUM('Pending','Ongoing','Ready to Check','Completed') DEFAULT 'Pending'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE orders MODIFY status ENUM('Pending','Ongoing','Completed') DEFAULT 'Pending'");
    }
};
