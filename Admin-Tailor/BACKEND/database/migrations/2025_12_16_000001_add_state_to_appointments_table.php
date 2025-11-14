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
        Schema::table('appointments', function (Blueprint $table) {
            if (!Schema::hasColumn('appointments', 'state')) {
                $table->string('state')->default('active')->after('status'); // active or cancelled
            }
        });
        
        // Update existing appointments to have 'active' state
        DB::table('appointments')->whereNull('state')->update(['state' => 'active']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            if (Schema::hasColumn('appointments', 'state')) {
                $table->dropColumn('state');
            }
        });
    }
};

