<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Feedback;
use App\Models\Order;
use App\Models\User;
use Faker\Factory as Faker;

class FeedbackSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faker = Faker::create();
        
        // Get all orders (prefer completed/finished orders for feedback)
        $orders = Order::whereIn('status', ['Completed', 'Finished'])->get();
        
        // If not enough completed orders, get all orders
        if ($orders->count() < 50) {
            $orders = Order::all();
        }
        
        if ($orders->isEmpty()) {
            $this->command->warn('No orders found. Please run OrderSeeder first.');
            return;
        }

        // Get orders that don't have feedback yet
        $ordersWithoutFeedback = $orders->filter(function ($order) {
            return !$order->feedback;
        });

        $count = 0;
        foreach ($ordersWithoutFeedback as $order) {
            if ($count >= 50) break;
            
            // Get the user from the appointment
            $user = $order->appointment->user;
            
            if (!$user) continue;

            Feedback::create([
                'order_id' => $order->id,
                'user_id' => $user->id,
                'rating' => $faker->numberBetween(1, 5),
                'comment' => $faker->optional(0.7)->paragraph(),
                'admin_response' => $faker->optional(0.3)->sentence(),
                'admin_checked' => $faker->boolean(40),
                'responded_at' => $faker->optional(0.3)->dateTimeBetween($order->created_at, 'now'),
            ]);
            
            $count++;
        }

        // If we need more feedback, try to create for orders that don't have feedback yet
        $remaining = 50 - Feedback::count();
        if ($remaining > 0) {
            // Get all orders that still don't have feedback
            $allOrders = Order::all();
            $ordersStillWithoutFeedback = $allOrders->filter(function ($order) {
                return !$order->feedback;
            });
            
            foreach ($ordersStillWithoutFeedback->take($remaining) as $order) {
                if (Feedback::count() >= 50) break;
                
                $user = $order->appointment->user;
                if (!$user) continue;

                Feedback::create([
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                    'rating' => $faker->numberBetween(1, 5),
                    'comment' => $faker->optional(0.7)->paragraph(),
                    'admin_response' => $faker->optional(0.3)->sentence(),
                    'admin_checked' => $faker->boolean(40),
                    'responded_at' => $faker->optional(0.3)->dateTimeBetween($order->created_at, 'now'),
                ]);
            }
        }
    }
}

