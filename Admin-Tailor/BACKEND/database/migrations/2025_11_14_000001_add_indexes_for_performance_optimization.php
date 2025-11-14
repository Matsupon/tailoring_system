<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This migration adds indexes to optimize query performance across multiple tables.
     * It does NOT modify, delete, or alter any existing data.
     */
    public function up(): void
    {
        // ============================================
        // ORDERS TABLE INDEXES
        // ============================================
        Schema::table('orders', function (Blueprint $table) {
            // Index on status for filtering orders by status (Pending, Ready to Check, Completed, Finished, Cancelled)
            if (!$this->indexExists('orders', 'orders_status_index')) {
                $table->index('status', 'orders_status_index');
            }
            
            // Index on handled for filtering handled/unhandled orders
            if (!$this->indexExists('orders', 'orders_handled_index')) {
                $table->index('handled', 'orders_handled_index');
            }
            
            // Index on created_at for sorting and date-range queries
            if (!$this->indexExists('orders', 'orders_created_at_index')) {
                $table->index('created_at', 'orders_created_at_index');
            }
            
            // Index on updated_at for sorting by last update
            if (!$this->indexExists('orders', 'orders_updated_at_index')) {
                $table->index('updated_at', 'orders_updated_at_index');
            }
            
            // Index on scheduled_at for date-based queries
            if (!$this->indexExists('orders', 'orders_scheduled_at_index')) {
                $table->index('scheduled_at', 'orders_scheduled_at_index');
            }
            
            // Index on completed_at for filtering completed orders by date
            if (!$this->indexExists('orders', 'orders_completed_at_index')) {
                $table->index('completed_at', 'orders_completed_at_index');
            }
            
            // Index on check_appointment_date for filtering by check date
            if (!$this->indexExists('orders', 'orders_check_appointment_date_index')) {
                $table->index('check_appointment_date', 'orders_check_appointment_date_index');
            }
            
            // Index on pickup_appointment_date for filtering by pickup date
            if (!$this->indexExists('orders', 'orders_pickup_appointment_date_index')) {
                $table->index('pickup_appointment_date', 'orders_pickup_appointment_date_index');
            }
        });

        // ============================================
        // APPOINTMENTS TABLE INDEXES
        // ============================================
        Schema::table('appointments', function (Blueprint $table) {
            // Index on status for filtering appointments (pending, accepted, rejected)
            if (!$this->indexExists('appointments', 'appointments_status_index')) {
                $table->index('status', 'appointments_status_index');
            }
            
            // Index on state for filtering (active, cancelled)
            if (!$this->indexExists('appointments', 'appointments_state_index')) {
                $table->index('state', 'appointments_state_index');
            }
            
            // Index on appointment_date for date-based queries and sorting
            if (!$this->indexExists('appointments', 'appointments_appointment_date_index')) {
                $table->index('appointment_date', 'appointments_appointment_date_index');
            }
            
            // Index on created_at for sorting by creation date
            if (!$this->indexExists('appointments', 'appointments_created_at_index')) {
                $table->index('created_at', 'appointments_created_at_index');
            }
            
            // Index on updated_at for sorting by last update
            if (!$this->indexExists('appointments', 'appointments_updated_at_index')) {
                $table->index('updated_at', 'appointments_updated_at_index');
            }
            
            // Index on preferred_due_date for filtering and sorting
            if (!$this->indexExists('appointments', 'appointments_preferred_due_date_index')) {
                $table->index('preferred_due_date', 'appointments_preferred_due_date_index');
            }
        });

        // ============================================
        // USERS (CUSTOMERS) TABLE INDEXES
        // ============================================
        Schema::table('users', function (Blueprint $table) {
            // Index on name for searching customers by name
            if (!$this->indexExists('users', 'users_name_index')) {
                $table->index('name', 'users_name_index');
            }
            
            // Index on phone for searching by phone number
            if (!$this->indexExists('users', 'users_phone_index')) {
                $table->index('phone', 'users_phone_index');
            }
            
            // Index on created_at for sorting customers by registration date
            if (!$this->indexExists('users', 'users_created_at_index')) {
                $table->index('created_at', 'users_created_at_index');
            }
            
            // Index on updated_at for sorting by last update
            if (!$this->indexExists('users', 'users_updated_at_index')) {
                $table->index('updated_at', 'users_updated_at_index');
            }
        });

        // ============================================
        // FEEDBACK TABLE INDEXES
        // ============================================
        Schema::table('feedback', function (Blueprint $table) {
            // Index on rating for filtering and sorting by rating
            if (!$this->indexExists('feedback', 'feedback_rating_index')) {
                $table->index('rating', 'feedback_rating_index');
            }
            
            // Index on admin_checked for filtering checked/unchecked feedback
            if (!$this->indexExists('feedback', 'feedback_admin_checked_index')) {
                $table->index('admin_checked', 'feedback_admin_checked_index');
            }
            
            // Index on created_at for sorting feedback by date
            if (!$this->indexExists('feedback', 'feedback_created_at_index')) {
                $table->index('created_at', 'feedback_created_at_index');
            }
            
            // Index on responded_at for filtering feedback with/without responses
            if (!$this->indexExists('feedback', 'feedback_responded_at_index')) {
                $table->index('responded_at', 'feedback_responded_at_index');
            }
            
            // Composite index for common query: filtering unchecked feedback by date
            if (!$this->indexExists('feedback', 'feedback_admin_checked_created_at_index')) {
                $table->index(['admin_checked', 'created_at'], 'feedback_admin_checked_created_at_index');
            }
            
            // Composite index for filtering by rating and date
            if (!$this->indexExists('feedback', 'feedback_rating_created_at_index')) {
                $table->index(['rating', 'created_at'], 'feedback_rating_created_at_index');
            }
        });
    }

    /**
     * Reverse the migrations.
     * 
     * Drops all indexes created by this migration.
     */
    public function down(): void
    {
        // ============================================
        // DROP ORDERS TABLE INDEXES
        // ============================================
        Schema::table('orders', function (Blueprint $table) {
            $indexes = [
                'orders_status_index',
                'orders_handled_index',
                'orders_created_at_index',
                'orders_updated_at_index',
                'orders_scheduled_at_index',
                'orders_completed_at_index',
                'orders_check_appointment_date_index',
                'orders_pickup_appointment_date_index',
            ];
            
            foreach ($indexes as $index) {
                if ($this->indexExists('orders', $index)) {
                    $table->dropIndex($index);
                }
            }
        });

        // ============================================
        // DROP APPOINTMENTS TABLE INDEXES
        // ============================================
        Schema::table('appointments', function (Blueprint $table) {
            $indexes = [
                'appointments_status_index',
                'appointments_state_index',
                'appointments_appointment_date_index',
                'appointments_created_at_index',
                'appointments_updated_at_index',
                'appointments_preferred_due_date_index',
            ];
            
            foreach ($indexes as $index) {
                if ($this->indexExists('appointments', $index)) {
                    $table->dropIndex($index);
                }
            }
        });

        // ============================================
        // DROP USERS TABLE INDEXES
        // ============================================
        Schema::table('users', function (Blueprint $table) {
            $indexes = [
                'users_name_index',
                'users_phone_index',
                'users_created_at_index',
                'users_updated_at_index',
            ];
            
            foreach ($indexes as $index) {
                if ($this->indexExists('users', $index)) {
                    $table->dropIndex($index);
                }
            }
        });

        // ============================================
        // DROP FEEDBACK TABLE INDEXES
        // ============================================
        Schema::table('feedback', function (Blueprint $table) {
            $indexes = [
                'feedback_rating_index',
                'feedback_admin_checked_index',
                'feedback_created_at_index',
                'feedback_responded_at_index',
                'feedback_admin_checked_created_at_index',
                'feedback_rating_created_at_index',
            ];
            
            foreach ($indexes as $index) {
                if ($this->indexExists('feedback', $index)) {
                    $table->dropIndex($index);
                }
            }
        });
    }

    /**
     * Check if an index exists on a table.
     *
     * @param string $table
     * @param string $index
     * @return bool
     */
    private function indexExists(string $table, string $index): bool
    {
        $connection = Schema::getConnection();
        $indexes = $connection->select(
            "SHOW INDEX FROM {$table} WHERE Key_name = ?",
            [$index]
        );
        
        return count($indexes) > 0;
    }
};

