<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Appointment;
use App\Models\Notification;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Schema;

class OrderController extends Controller
{
    public function store(Request $request, $appointmentId)
    {
        try {
            $appointment = Appointment::findOrFail($appointmentId);
    
            // Get queue number based on appointment date and time (chronological order)
            $appointmentDate = \Carbon\Carbon::parse($appointment->appointment_date)->toDateString();
            $appointmentTime = $appointment->appointment_time;
            
            // Count orders for the same appointment date that have earlier appointment times
            $ordersForSameDate = Order::whereHas('appointment', function($query) use ($appointmentDate, $appointmentTime) {
                $query->whereDate('appointment_date', $appointmentDate)
                      ->where('appointment_time', '<', $appointmentTime);
            })->count();
            
            $queueNumber = $ordersForSameDate + 1;
    
            $order = Order::create([
                'appointment_id' => $appointment->id,
                'queue_number'   => $queueNumber,
                'status'         => 'Pending',
            ]);
    
            $appointment->status = 'accepted';
            $appointment->save();
    
            try {
                Notification::create([
                    'user_id' => $appointment->user_id,
                    'type'    => 'appointment_accepted',
                    'title'   => 'Your appointment has been accepted by the Admin!',
                    'body'    => null,
                    'data'    => [
                        'appointment_id' => $appointment->id,
                        'order_id'       => $order->id,
                        'appointment_date' => \Carbon\Carbon::parse($appointment->appointment_date)->format('Y-m-d'),
                        'appointment_time' => \Carbon\Carbon::parse($appointment->appointment_time)->format('H:i:s'),
                    ],
                ]);
            } catch (\Exception $e) {
                \Log::error('Failed to create appointment accepted notification', [
                    'error' => $e->getMessage(),
                    'appointment_id' => $appointment->id,
                    'order_id' => $order->id,
                    'user_id' => $appointment->user_id
                ]);
            }
    
            return response()->json([
                'success' => true,
                'message' => 'Appointment accepted and moved to orders',
                'order'   => $order,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }


    public function index()
    {
        try {
            // First, recalculate queue numbers for all orders grouped by their derived next-appointment date
            $this->recalculateAllQueueNumbers();
            
            // Get all orders (including Cancelled) that don't have refund_image yet
            // Exclude orders whose appointments already have refund_image (refund already processed)
            $orders = Order::with(['appointment.user'])
                ->where('status', '!=', 'Finished')
                ->whereHas('appointment', function($q) {
                    // Show orders whose appointments don't have refund_image yet
                    $q->whereNull('refund_image');
                })
                ->orderBy('created_at', 'asc')
                ->get()
                ->filter(function ($order) {
                    // Additional safety check: ensure appointment exists
                    return $order->appointment !== null;
                })
                ->map(function ($order) {
                    return [
                        'id' => $order->id,
                        'queue_number' => $order->queue_number,
                        'status' => $order->status,
                    'handled' => (bool) ($order->handled ?? false),
                        'scheduled_at' => $order->scheduled_at ?? null,
                        'completed_at' => $order->completed_at ?? null,
                        'total_amount' => $order->total_amount ?? null,
                        // Return dates as YYYY-MM-DD strings WITHOUT timezone conversion
                        'check_appointment_date' => $order->check_appointment_date 
                            ? substr($order->check_appointment_date, 0, 10) // Ensure YYYY-MM-DD format
                            : null,
                        'check_appointment_time' => $order->check_appointment_time 
                            ? substr($order->check_appointment_time, 0, 5) // Ensure HH:MM format
                            : null,
                        'pickup_appointment_date' => $order->pickup_appointment_date 
                            ? substr($order->pickup_appointment_date, 0, 10) // Ensure YYYY-MM-DD format
                            : null,
                        'pickup_appointment_time' => $order->pickup_appointment_time 
                            ? substr($order->pickup_appointment_time, 0, 5) // Ensure HH:MM format
                            : null,
                    'created_at' => $order->created_at,
                    'appointment' => [
                        'id' => $order->appointment->id,
                        'service_type' => $order->appointment->service_type,
                        'sizes' => json_decode($order->appointment->sizes, true),
                        'total_quantity' => $order->appointment->total_quantity,
                        'notes' => $order->appointment->notes,
                        'status' => $order->appointment->status ?? 'pending',
                        'state' => $order->appointment->state ?? 'active',
                        'refund_image' => $order->appointment->refund_image 
                            ? asset('storage/' . $order->appointment->refund_image) 
                            : null,
                        'design_image' => $order->appointment->design_image 
                            ? asset('storage/' . $order->appointment->design_image) 
                            : null,
                        'gcash_proof' => $order->appointment->gcash_proof 
                            ? asset('storage/' . $order->appointment->gcash_proof) 
                            : null,
                        'preferred_due_date' => $order->appointment->preferred_due_date
                            ? \Carbon\Carbon::parse($order->appointment->preferred_due_date)->format('Y-m-d')
                            : null,
                        'appointment_date' => $order->appointment->appointment_date 
                            ? \Carbon\Carbon::parse($order->appointment->appointment_date)->format('Y-m-d')
                            : null,
                        'appointment_time' => $order->appointment->appointment_time 
                            ? \Carbon\Carbon::parse($order->appointment->appointment_time)->format('H:i:s')
                            : null,
                        'user' => [
                            'id' => $order->appointment->user->id,
                            'name' => $order->appointment->user->name,
                            'phone' => $order->appointment->user->phone,
                            'email' => $order->appointment->user->email,
                        ]
                    ]
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $orders,
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in index', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Failed to fetch orders: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function history()
    {
        $orders = Order::with(['appointment.user', 'feedback'])
            ->where('status', 'Finished')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'status' => 'Completed', 
                    'scheduled_at' => $order->scheduled_at,
                    'completed_at' => $order->completed_at,
                    'total_amount' => $order->total_amount,
                    // Return dates as YYYY-MM-DD strings WITHOUT timezone conversion
                    'check_appointment_date' => $order->check_appointment_date 
                        ? substr($order->check_appointment_date, 0, 10)
                        : null,
                    'check_appointment_time' => $order->check_appointment_time 
                        ? substr($order->check_appointment_time, 0, 5)
                        : null,
                    'pickup_appointment_date' => $order->pickup_appointment_date 
                        ? substr($order->pickup_appointment_date, 0, 10)
                        : null,
                    'pickup_appointment_time' => $order->pickup_appointment_time 
                        ? substr($order->pickup_appointment_time, 0, 5)
                        : null,
                    'created_at' => $order->created_at,
                    'appointment' => [
                        'id' => $order->appointment->id,
                        'service_type' => $order->appointment->service_type,
                        'sizes' => json_decode($order->appointment->sizes, true),
                        'total_quantity' => $order->appointment->total_quantity,
                        'notes' => $order->appointment->notes,
                        'status' => $order->appointment->status ?? 'pending',
                        'design_image' => $order->appointment->design_image 
                            ? asset('storage/' . $order->appointment->design_image) 
                            : null,
                        'gcash_proof' => $order->appointment->gcash_proof 
                            ? asset('storage/' . $order->appointment->gcash_proof) 
                            : null,
                        'preferred_due_date' => $order->appointment->preferred_due_date
                            ? \Carbon\Carbon::parse($order->appointment->preferred_due_date)->format('Y-m-d')
                            : null,
                        'appointment_date' => $order->appointment->appointment_date 
                            ? \Carbon\Carbon::parse($order->appointment->appointment_date)->format('Y-m-d')
                            : null,
                        'appointment_time' => $order->appointment->appointment_time 
                            ? \Carbon\Carbon::parse($order->appointment->appointment_time)->format('H:i:s')
                            : null,
                        'user' => [
                            'id' => $order->appointment->user->id,
                            'name' => $order->appointment->user->name,
                            'phone' => $order->appointment->user->phone,
                            'email' => $order->appointment->user->email,
                        ]
                    ],
                    'feedback' => $order->feedback ? [
                        'id' => $order->feedback->id,
                        'rating' => (int)$order->feedback->rating,
                        'comment' => $order->feedback->comment,
                        'admin_response' => $order->feedback->admin_response,
                        'admin_checked' => (bool)$order->feedback->admin_checked,
                        'responded_at' => $order->feedback->responded_at,
                        'created_at' => $order->feedback->created_at,
                    ] : null,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $orders,
        ]);
    }

    public function updateStatus(Request $request, Order $order)
{
    $validated = $request->validate([
        'status'        => 'required|in:Pending,Ready to Check,Completed,Finished',
        'scheduled_at'  => 'nullable|date',     
        'total_amount'  => 'nullable|numeric',  
        
        'check_appointment_date' => 'nullable|date|required_if:status,Ready to Check',
        'check_appointment_time' => 'nullable|date_format:H:i|required_if:status,Ready to Check',
        'pickup_appointment_date' => 'nullable|date|required_if:status,Completed',
        'pickup_appointment_time' => 'nullable|date_format:H:i|required_if:status,Completed',
    ]);

    // Prevent admin from setting status to 'Cancelled' - only users can cancel orders
    if ($validated['status'] === 'Cancelled') {
        return response()->json([
            'success' => false,
            'message' => 'Admin cannot set order status to Cancelled. Only users can cancel their orders.'
        ], 403);
    }

    $order->status = $validated['status'];
    // Reset handled to false when status is updated
    $order->handled = false;
    
    if ($validated['status'] === 'Ready to Check' && !empty($validated['scheduled_at'])) {
        $order->scheduled_at = $validated['scheduled_at'];
    }
    
    if ($validated['status'] === 'Completed') {
        if (!empty($validated['scheduled_at'])) {
            $order->completed_at = $validated['scheduled_at'];
        }
        if (isset($validated['total_amount'])) {
            $order->total_amount = $validated['total_amount'];
        }
    }
    
    if ($validated['status'] === 'Ready to Check') {
        $order->check_appointment_date = $validated['check_appointment_date'];
        $order->check_appointment_time = $validated['check_appointment_time'];
    }
    
    if ($validated['status'] === 'Completed') {
        $order->pickup_appointment_date = $validated['pickup_appointment_date'];
        $order->pickup_appointment_time = $validated['pickup_appointment_time'];
    }
    
    $order->save();

    $appointment = $order->appointment;
    $userId = $appointment->user_id;

    if ($validated['status'] === 'Ready to Check') {
        try {
            \Log::info('Creating notification for Ready to Check', [
                'order_id' => $order->id,
                'user_id' => $userId,
                'scheduled_at' => $validated['scheduled_at']
            ]);
            
            $notification = Notification::create([
                'user_id' => $userId,
                'type'    => 'ready_to_check',
                'title'   => 'Your order is now ready to be checked',
                'body'    => null,
                'data'    => [
                    'order_id'      => $order->id,
                    'appointment_id'=> $appointment->id,
                    'scheduled_at'  => $validated['scheduled_at'],
                    'check_appointment_date' => $validated['check_appointment_date'],
                    'check_appointment_time' => $validated['check_appointment_time'],
                ],
            ]);
            
            \Log::info('Notification created successfully', [
                'notification_id' => $notification->id,
                'order_id' => $order->id
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to create notification for Ready to Check', [
                'error' => $e->getMessage(),
                'order_id' => $order->id,
                'user_id' => $userId,
                'trace' => $e->getTraceAsString()
            ]);
        }
    }

    if ($validated['status'] === 'Completed') {
        if (empty($validated['scheduled_at'])) {
            return response()->json(['message' => 'scheduled_at is required for Completed'], 422);
        }
        if (!isset($validated['total_amount'])) {
            return response()->json(['message' => 'total_amount is required for Completed'], 422);
        }

        try {
            Notification::create([
                'user_id' => $userId,
                'type'    => 'order_completed',
                'title'   => 'Your order is now completed',
                'body'    => null,
                'data'    => [
                    'order_id'      => $order->id,
                    'appointment_id'=> $appointment->id,
                    'scheduled_at'  => $validated['scheduled_at'],
                    'total_amount'  => (float)$validated['total_amount'],
                    'pickup_appointment_date' => $validated['pickup_appointment_date'],
                    'pickup_appointment_time' => $validated['pickup_appointment_time'],
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to create notification for Completed', [
                'error' => $e->getMessage(),
                'order_id' => $order->id,
                'user_id' => $userId
            ]);
        }
    }

    if ($validated['status'] === 'Finished') {
        try {
            \Log::info('Creating notification for Finished', [
                'order_id' => $order->id,
                'user_id' => $userId
            ]);
            
            Notification::create([
                'user_id' => $userId,
                'type'    => 'order_finished',
                'title'   => 'Congratulations! Your order is now finished!',
                'body'    => null,
                'data'    => [
                    'order_id'      => $order->id,
                    'appointment_id'=> $appointment->id,
                ],
            ]);
            
            \Log::info('Notification created successfully for Finished status', [
                'order_id' => $order->id
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to create notification for Finished', [
                'error' => $e->getMessage(),
                'order_id' => $order->id,
                'user_id' => $userId,
                'trace' => $e->getTraceAsString()
            ]);
        }
    }

    return response()->json([
        'success' => true,
        'data'    => $order->fresh(['appointment', 'appointment.user']),
    ]);
}

    public function getBookedTimes(Request $request)
    {
        try {
            $validated = $request->validate([
                'date' => 'required|date',
                'kind' => 'required|in:check,pickup',
                'order_id' => 'nullable|integer|exists:orders,id', // Optional: exclude this order's times
            ]);

            $date = $validated['date'];
            $excludeOrderId = $validated['order_id'] ?? null;
            
            // Collect ALL appointment times from non-Finished orders for the given date
            // This includes: check_appointment_time, pickup_appointment_time, and original appointment_time
            $allTimes = collect();

            // Get all check appointment times from non-Finished orders (excluding the current order being updated)
            $checkTimesQuery = Order::whereDate('check_appointment_date', $date)
                ->whereNotNull('check_appointment_time')
                ->where('status', '!=', 'Finished');
            
            if ($excludeOrderId) {
                $checkTimesQuery->where('id', '!=', $excludeOrderId);
            }
            
            $checkTimes = $checkTimesQuery->pluck('check_appointment_time')
                ->map(function ($t) { return \Carbon\Carbon::parse($t)->format('H:i'); });
            $allTimes = $allTimes->merge($checkTimes);

            // Get all pickup appointment times from non-Finished orders (excluding the current order being updated)
            $pickupTimesQuery = Order::whereDate('pickup_appointment_date', $date)
                ->whereNotNull('pickup_appointment_time')
                ->where('status', '!=', 'Finished');
            
            if ($excludeOrderId) {
                $pickupTimesQuery->where('id', '!=', $excludeOrderId);
            }
            
            $pickupTimes = $pickupTimesQuery->pluck('pickup_appointment_time')
                ->map(function ($t) { return \Carbon\Carbon::parse($t)->format('H:i'); });
            $allTimes = $allTimes->merge($pickupTimes);

            // Also include ALL appointment times from Appointment table (pending AND accepted)
            // This ensures that even unaccepted appointments claim their date/time slots
            // Exclude rejected appointments (they don't claim slots anymore)
            // Exclude cancelled appointments (they don't claim slots anymore)
            $appointmentTimesQuery = \App\Models\Appointment::whereDate('appointment_date', $date)
                ->whereNotNull('appointment_time')
                ->whereIn('status', ['pending', 'accepted']) // Include both pending and accepted
                ->where(function($q) {
                    $q->where('state', 'active')
                      ->orWhereNull('state'); // Include appointments without state column
                });
            
            // If excluding an order, also exclude appointments linked to that order
            if ($excludeOrderId) {
                $appointmentTimesQuery->whereDoesntHave('order', function($query) use ($excludeOrderId) {
                    $query->where('id', $excludeOrderId);
                });
            }
            
            $appointmentTimes = $appointmentTimesQuery->pluck('appointment_time')
                ->map(function ($t) { 
                    try {
                        return \Carbon\Carbon::parse($t)->format('H:i');
                    } catch (\Exception $e) {
                        // If already in H:i format, return as is
                        if (preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $t)) {
                            return substr($t, 0, 5); // Return HH:MM format
                        }
                        return null;
                    }
                })
                ->filter();
            $allTimes = $allTimes->merge($appointmentTimes);

            // Return unique times
            $times = $allTimes
                ->unique()
                ->values()
                ->all();

            return response()->json([
                'success' => true,
                'booked_times' => $times,
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to fetch booked times', [
                'error' => $e->getMessage(),
                'date' => $request->get('date'),
                'kind' => $request->get('kind')
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch booked times',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function myLatest(Request $request)
    {
        try {
            $userId = $request->user()->id;
            \Log::info('Fetching latest order for user', ['user_id' => $userId]);
    
            $order = Order::with('appointment.user')
                ->whereHas('appointment', function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                })
                ->where('status', '!=', 'Finished')
                ->where('status', '!=', 'Cancelled') // Exclude cancelled orders
                ->orderBy('created_at', 'desc')
                ->first();
    
            if (!$order) {
                \Log::info('No order found for user', ['user_id' => $userId]);
                return response()->json([
                    'success' => true,
                    'data' => null,
                ]);
            }
    
            \Log::info('Latest order fetched successfully', [
                'user_id' => $userId,
                'order_id' => $order->id,
                'status' => $order->status
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'id'           => $order->id,
                    'status'       => $order->status,
                    'queue_number' => $order->queue_number,
                    'scheduled_at' => $order->scheduled_at,
                    'completed_at' => $order->completed_at,
                    'appointment'  => [
                        'id'               => $order->appointment->id,
                        'service_type'     => $order->appointment->service_type,
                        'sizes'            => json_decode($order->appointment->sizes, true),
                        'total_quantity'   => $order->appointment->total_quantity,
                        'preferred_due_date' => $order->appointment->preferred_due_date
                            ? \Carbon\Carbon::parse($order->appointment->preferred_due_date)->format('Y-m-d')
                            : null,
                        'notes'            => $order->appointment->notes,
                        'status'           => $order->appointment->status ?? 'pending',
                        'design_image'     => $order->appointment->design_image
                            ? asset('storage/' . $order->appointment->design_image)
                            : null,
                        'gcash_proof'      => $order->appointment->gcash_proof
                            ? asset('storage/' . $order->appointment->gcash_proof)
                            : null,
                        'appointment_date' => $order->appointment->appointment_date 
                            ? \Carbon\Carbon::parse($order->appointment->appointment_date)->format('Y-m-d')
                            : null,
                        'appointment_time' => $order->appointment->appointment_time 
                            ? \Carbon\Carbon::parse($order->appointment->appointment_time)->format('H:i:s')
                            : null,
                        'user' => $order->appointment->relationLoaded('user') && $order->appointment->user ? [
                            'id' => $order->appointment->user->id,
                            'name' => $order->appointment->user->name,
                            'phone' => $order->appointment->user->phone,
                            'email' => $order->appointment->user->email,
                        ] : null,
                    ],
                    'check_appointment_date' => $order->check_appointment_date,
                    'check_appointment_time' => $order->check_appointment_time,
                    'pickup_appointment_date' => $order->pickup_appointment_date,
                    'pickup_appointment_time' => $order->pickup_appointment_time,
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to fetch latest order', [
                'error' => $e->getMessage(),
                'user_id' => $request->user()->id,
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch latest order',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    public function myOrders(Request $request)
    {
        try {
            $userId = $request->user()->id;
            \Log::info('Fetching all non-finished orders for user', ['user_id' => $userId]);
    
            $orders = Order::with('appointment.user')
                ->whereHas('appointment', function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                })
                ->where('status', '!=', 'Finished')
                ->where('status', '!=', 'Cancelled') // Exclude cancelled orders from customer view
                ->orderBy('created_at', 'desc')
                ->get();
    
            \Log::info('Orders fetched successfully', [
                'user_id' => $userId,
                'count' => $orders->count()
            ]);

            return response()->json([
                'success' => true,
                'data' => $orders->map(function ($order) {
                    return [
                        'id'           => $order->id,
                        'status'       => $order->status,
                        'queue_number' => $order->queue_number,
                        'scheduled_at' => $order->scheduled_at,
                        'completed_at' => $order->completed_at,
                        'appointment'  => [
                            'id'               => $order->appointment->id,
                            'service_type'     => $order->appointment->service_type,
                            'sizes'            => json_decode($order->appointment->sizes, true),
                            'total_quantity'   => $order->appointment->total_quantity,
                            'preferred_due_date' => $order->appointment->preferred_due_date
                                ? \Carbon\Carbon::parse($order->appointment->preferred_due_date)->format('Y-m-d')
                                : null,
                            'notes'            => $order->appointment->notes,
                            'status'           => $order->appointment->status ?? 'pending',
                            'design_image'     => $order->appointment->design_image
                                ? asset('storage/' . $order->appointment->design_image)
                                : null,
                            'gcash_proof'      => $order->appointment->gcash_proof
                                ? asset('storage/' . $order->appointment->gcash_proof)
                                : null,
                            'appointment_date' => $order->appointment->appointment_date 
                                ? \Carbon\Carbon::parse($order->appointment->appointment_date)->format('Y-m-d')
                                : null,
                            'appointment_time' => $order->appointment->appointment_time 
                                ? \Carbon\Carbon::parse($order->appointment->appointment_time)->format('H:i:s')
                                : null,
                            'user' => $order->appointment->relationLoaded('user') && $order->appointment->user ? [
                                'id' => $order->appointment->user->id,
                                'name' => $order->appointment->user->name,
                                'phone' => $order->appointment->user->phone,
                                'email' => $order->appointment->user->email,
                            ] : null,
                        ],
                        'check_appointment_date' => $order->check_appointment_date,
                        'check_appointment_time' => $order->check_appointment_time,
                        'pickup_appointment_date' => $order->pickup_appointment_date,
                        'pickup_appointment_time' => $order->pickup_appointment_time,
                    ];
                }),
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to fetch orders', [
                'error' => $e->getMessage(),
                'user_id' => $request->user()->id,
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch orders',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
    

    public function myHistory(Request $request)
    {
        try {
            $userId = $request->user()->id;
            \Log::info('Fetching finished orders for user', ['user_id' => $userId]);
    
        $orders = Order::with(['appointment.user', 'feedback'])
            ->whereHas('appointment', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            })
            ->where('status', 'Finished')
            ->where('status', '!=', 'Cancelled') // Exclude cancelled orders
            ->orderBy('created_at', 'desc')
            ->get();
    
            if ($orders->isEmpty()) {
                \Log::info('No finished orders found for user', ['user_id' => $userId]);
                return response()->json([
                    'success' => true,
                    'data' => [],
                ]);
            }
    
            \Log::info('Finished orders fetched successfully', [
                'user_id' => $userId,
                'count' => $orders->count()
            ]);

            return response()->json([
                'success' => true,
                'data' => $orders->map(function ($order) {
                    return [
                        'id'           => $order->id,
                        'status'       => 'Completed', 
                        'scheduled_at' => $order->scheduled_at,
                        'completed_at' => $order->completed_at,
                        'appointment'  => [
                            'id'               => $order->appointment->id,
                            'service_type'     => $order->appointment->service_type,
                            'sizes'            => json_decode($order->appointment->sizes, true),
                            'total_quantity'   => $order->appointment->total_quantity,
                            'preferred_due_date' => $order->appointment->preferred_due_date
                                ? \Carbon\Carbon::parse($order->appointment->preferred_due_date)->format('Y-m-d')
                                : null,
                            'notes'            => $order->appointment->notes,
                            'status'           => $order->appointment->status ?? 'pending',
                            'design_image'     => $order->appointment->design_image
                                ? asset('storage/' . $order->appointment->design_image)
                                : null,
                            'gcash_proof'      => $order->appointment->gcash_proof
                                ? asset('storage/' . $order->appointment->gcash_proof)
                                : null,
                            'appointment_date' => $order->appointment->appointment_date 
                                ? \Carbon\Carbon::parse($order->appointment->appointment_date)->format('Y-m-d')
                                : null,
                            'appointment_time' => $order->appointment->appointment_time 
                                ? \Carbon\Carbon::parse($order->appointment->appointment_time)->format('H:i:s')
                                : null,
                            'user' => $order->appointment->relationLoaded('user') && $order->appointment->user ? [
                                'id' => $order->appointment->user->id,
                                'name' => $order->appointment->user->name,
                                'phone' => $order->appointment->user->phone,
                                'email' => $order->appointment->user->email,
                            ] : null,
                        ],
                        'check_appointment_date' => $order->check_appointment_date,
                        'check_appointment_time' => $order->check_appointment_time,
                        'pickup_appointment_date' => $order->pickup_appointment_date,
                        'pickup_appointment_time' => $order->pickup_appointment_time,
                        'feedback' => $order->feedback ? [
                            'id' => $order->feedback->id,
                            'rating' => (int)$order->feedback->rating,
                            'comment' => $order->feedback->comment,
                            'admin_response' => $order->feedback->admin_response,
                            'admin_checked' => (bool)$order->feedback->admin_checked,
                            'responded_at' => $order->feedback->responded_at,
                            'created_at' => $order->feedback->created_at,
                        ] : null,
                    ];
                }),
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to fetch latest order', [
                'error' => $e->getMessage(),
                'user_id' => $request->user()->id,
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch latest order',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
    
    public function getOrderStats()
    {
        try {
            // Count only Pending, Ready to Check, and Completed orders
            // Exclude Finished and Cancelled orders
            $pendingOrders = Order::whereIn('status', ['Pending', 'Ready to Check', 'Completed'])->count();
            $finishedOrders = Order::where('status', 'Finished')->count();

            return response()->json([
                'success' => true,
                'data' => [
                    'pending_orders' => $pendingOrders,
                    'finished_orders' => $finishedOrders,
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in getOrderStats', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Failed to fetch order statistics: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function getTodayQueue()
    {
        try {
            // Use application timezone (defaults to Asia/Manila)
            $timezone = config('app.timezone', 'Asia/Manila');
            
            // Set timezone for Carbon operations
            $today = \Carbon\Carbon::now($timezone)->toDateString();
            $nowTime = \Carbon\Carbon::now($timezone)->format('H:i:s');
            $currentDateTime = \Carbon\Carbon::now($timezone);

            \Log::info('getTodayQueue called', [
                'today' => $today,
                'now_time' => $nowTime,
                'timezone' => $timezone,
                'server_time' => \Carbon\Carbon::now()->toDateTimeString(),
                'local_time' => \Carbon\Carbon::now($timezone)->toDateTimeString()
            ]);

            // Fetch orders with status: Pending, Ready to Check, Completed
            // Exclude Finished and Cancelled orders
            // Exclude orders where appointment status is 'pending' (not accepted)
            $candidateOrders = Order::with('appointment.user')
                ->whereIn('status', ['Pending', 'Ready to Check', 'Completed'])
                ->whereHas('appointment', function($qa) {
                    // Exclude orders where appointment status is 'pending' (not accepted)
                    // Include orders with null/empty status (treated as accepted)
                    // Handle case-insensitive comparison
                    $qa->where(function($q) {
                        $q->whereNull('status')
                          ->orWhere('status', '')
                          ->orWhereRaw('LOWER(TRIM(status)) != ?', ['pending']);
                    });
                })
                ->get();

            \Log::info('Candidate orders fetched', [
                'count' => $candidateOrders->count(),
                'order_ids' => $candidateOrders->pluck('id')->toArray()
            ]);

            // Compute next appointment date/time for each order using getDerivedDateTime
            // This matches the logic in Orders.jsx
            $enriched = $candidateOrders->map(function($order) {
                [$date, $time] = $this->getDerivedDateTime($order);
                
                \Log::debug('Order derived datetime', [
                    'order_id' => $order->id,
                    'order_status' => $order->status,
                    'appointment_status' => optional($order->appointment)->status,
                    'derived_date' => $date,
                    'derived_time' => $time,
                    'check_appointment_date' => $order->check_appointment_date,
                    'check_appointment_time' => $order->check_appointment_time,
                    'pickup_appointment_date' => $order->pickup_appointment_date,
                    'pickup_appointment_time' => $order->pickup_appointment_time,
                    'appointment_date' => optional($order->appointment)->appointment_date,
                    'appointment_time' => optional($order->appointment)->appointment_time,
                ]);
                
                return [
                    'model' => $order,
                    'next_appointment_date' => $date,
                    'next_appointment_time' => $time,
                ];
            });

            // Filter orders that have an appointment today
            $todayOrders = $enriched
                ->filter(function($item) use ($today) {
                    $orderDate = $item['next_appointment_date'];
                    $hasTodayAppointment = !empty($orderDate) && $orderDate === $today;
                    
                    \Log::debug('Checking if order has today appointment', [
                        'order_id' => $item['model']->id,
                        'order_date' => $orderDate,
                        'today' => $today,
                        'dates_match' => $orderDate === $today,
                        'has_today_appointment' => $hasTodayAppointment,
                        'order_date_type' => gettype($orderDate),
                        'today_type' => gettype($today),
                    ]);
                    
                    if ($hasTodayAppointment) {
                        \Log::info('Order has today appointment', [
                            'order_id' => $item['model']->id,
                            'date' => $item['next_appointment_date'],
                            'time' => $item['next_appointment_time'],
                            'status' => $item['model']->status
                        ]);
                    }
                    
                    return $hasTodayAppointment;
                })
                ->sortBy(function($item) {
                    return $item['next_appointment_time'] ?? '23:59:59';
                })
                ->values();

            \Log::info('Today orders filtered', [
                'count' => $todayOrders->count(),
                'order_ids' => $todayOrders->pluck('model.id')->toArray()
            ]);

            if ($todayOrders->isEmpty()) {
                \Log::info('No today orders found');
                return response()->json([
                    'success' => true,
                    'data' => [
                        'has_queue' => false,
                        'message' => 'No upcoming queues for today',
                        'current_customer' => null,
                        'next_customer' => null,
                        'all_orders' => [],
                        'current_date' => $today,
                        'current_time' => $nowTime
                    ]
                ]);
            }

            // Reassign queue numbers for today's orders based on derived time
            $queueNumber = 1;
            foreach ($todayOrders as $item) {
                $model = $item['model'];
                $model->queue_number = $queueNumber;
                $model->save();
                $queueNumber++;
            }

            // Determine current and next based on current time
            $currentIndex = 0;
            foreach ($todayOrders as $idx => $item) {
                $derivedTime = $item['next_appointment_time'] ?? '23:59:59';
                if ($derivedTime >= $nowTime) { 
                    $currentIndex = $idx; 
                    break; 
                }
                $currentIndex = $idx; // if all earlier, last one becomes current
            }

            $currentCustomer = $todayOrders->get($currentIndex);
            $nextCustomer = $todayOrders->get($currentIndex + 1);

            \Log::info('Current and next customer determined', [
                'current_index' => $currentIndex,
                'current_customer_id' => $currentCustomer ? $currentCustomer['model']->id : null,
                'next_customer_id' => $nextCustomer ? $nextCustomer['model']->id : null
            ]);

            // Format all orders for display
            $allOrders = $todayOrders->map(function ($item) {
                $model = $item['model'];
                return [
                    'id' => $model->id,
                    'queue_number' => $model->queue_number,
                    'name' => $model->appointment->user->name ?? 'N/A',
                    'service_type' => $model->appointment->service_type ?? 'N/A',
                    'appointment_time' => $item['next_appointment_time'] ?? 'N/A',
                    'appointment_date' => $item['next_appointment_date'] ?? 'N/A',
                    'status' => $model->status,
                    'appointment' => [
                        'appointment_date' => optional($model->appointment)->appointment_date,
                        'appointment_time' => optional($model->appointment)->appointment_time,
                    ]
                ];
            });

            \Log::info('Today queue response prepared', [
                'all_orders_count' => count($allOrders),
                'has_queue' => true
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'has_queue' => true,
                    'current_date' => $today,
                    'current_time' => $nowTime,
                    'current_customer' => $currentCustomer ? [
                        'queue_number' => $currentCustomer['model']->queue_number,
                        'name' => $currentCustomer['model']->appointment->user->name ?? 'N/A',
                        'appointment_time' => $currentCustomer['next_appointment_time'] ?? 'N/A',
                        'appointment_date' => $currentCustomer['next_appointment_date'] ?? 'N/A',
                        'status' => $currentCustomer['model']->status,
                    ] : null,
                    'next_customer' => $nextCustomer ? [
                        'queue_number' => $nextCustomer['model']->queue_number,
                        'name' => $nextCustomer['model']->appointment->user->name ?? 'N/A',
                        'appointment_time' => $nextCustomer['next_appointment_time'] ?? 'N/A',
                        'appointment_date' => $nextCustomer['next_appointment_date'] ?? 'N/A',
                        'status' => $nextCustomer['model']->status,
                    ] : null,
                    'all_orders' => $allOrders
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in getTodayQueue', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Failed to fetch today\'s queue: ' . $e->getMessage(),
            ], 500);
        }
    }


    public function getTodayAppointmentsCount()
    {
        try {
            $today = \Carbon\Carbon::today()->toDateString();

            // Check if columns exist before querying
            $hasCheckDate = Schema::hasColumn('orders', 'check_appointment_date');
            $hasPickupDate = Schema::hasColumn('orders', 'pickup_appointment_date');

            $candidateOrders = Order::with('appointment')
                ->where('status', '!=', 'Finished')
                ->where('status', '!=', 'Cancelled') // Exclude cancelled orders
                ->whereHas('appointment', function($qa) {
                    // Exclude orders where appointment status is 'pending' (not accepted)
                    // Include orders with null/empty status (treated as accepted)
                    // Handle case-insensitive comparison
                    $qa->where(function($q) {
                        $q->whereNull('status')
                          ->orWhere('status', '')
                          ->orWhereRaw('LOWER(TRIM(status)) != ?', ['pending']);
                    });
                })
                ->where(function($q) use ($today, $hasCheckDate, $hasPickupDate) {
                    if ($hasCheckDate) {
                        $q->whereDate('check_appointment_date', $today);
                    }
                    if ($hasPickupDate) {
                        $q->orWhereDate('pickup_appointment_date', $today);
                    }
                    $q->orWhereHas('appointment', function($qa) use ($today) {
                        $qa->whereDate('appointment_date', $today);
                    });
                })
                ->get();

            $count = $candidateOrders->filter(function($order) use ($today) {
                    [$d, $t] = $this->getDerivedDateTime($order);
                    return !empty($d) && $d === $today;
                })
                ->count();

            return response()->json([
                'success' => true,
                'data' => [
                    'todays_appointments' => $count,
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in getTodayAppointmentsCount', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Failed to fetch today\'s appointments count: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function recalculateQueueNumbers()
    {
        try {
            $this->recalculateAllQueueNumbers();
            
            return response()->json([
                'success' => true,
                'message' => 'Queue numbers recalculated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to recalculate queue numbers',
            ], 500);
        }
    }
    
    private function recalculateAllQueueNumbers()
    {
        // Get all non-finished and non-cancelled orders and group by their derived next-appointment date
        $orders = Order::with('appointment')
            ->where('status', '!=', 'Finished')
            ->where('status', '!=', 'Cancelled') // Exclude cancelled orders from queue
            ->get();

        $enriched = $orders->map(function($order) {
            [$d, $t] = $this->getDerivedDateTime($order);
            return [
                'model' => $order,
                'derived_date' => $d,
                'derived_time' => $t,
            ];
        });

        $groups = $enriched
            ->filter(function($item) {
                return !empty($item['derived_date']);
            })
            ->groupBy(function($item) {
                return $item['derived_date'];
            });

        foreach ($groups as $date => $group) {
            $sorted = $group->sortBy(function($item) {
                return $item['derived_time'] ?? '23:59:59';
            })->values();
            $qn = 1;
            foreach ($sorted as $item) {
                $model = $item['model'];
                $model->queue_number = $qn;
                $model->save();
                $qn++;
            }
        }
    }

    /**
     * Get the next appointment date/time by checking ALL date/time fields from both Order and Appointment tables
     * Returns the earliest upcoming appointment (today or future)
     */
    private function getNextAppointmentDateTime($order, $currentDateTime)
    {
        $appointments = [];
        $allDateTimes = [];

        // 1. Check scheduled_at from Order table
        if ($order->scheduled_at) {
            $scheduledAt = \Carbon\Carbon::parse($order->scheduled_at);
            $appointments[] = [
                'date' => $scheduledAt->toDateString(),
                'time' => $scheduledAt->format('H:i:s'),
                'datetime' => $scheduledAt,
                'type' => 'scheduled_at'
            ];
            $allDateTimes['scheduled_at'] = [
                'date' => $scheduledAt->toDateString(),
                'time' => $scheduledAt->format('H:i:s'),
                'datetime' => $scheduledAt->toDateTimeString()
            ];
        } else {
            $allDateTimes['scheduled_at'] = null;
        }

        // 2. Check appointment_date and appointment_time from Appointment table
        if ($order->appointment) {
            if ($order->appointment->appointment_date && $order->appointment->appointment_time) {
                $apptDate = \Carbon\Carbon::parse($order->appointment->appointment_date);
                $apptTime = \Carbon\Carbon::parse($order->appointment->appointment_time);
                $apptDateTime = $apptDate->copy()->setTime($apptTime->hour, $apptTime->minute, $apptTime->second);
                
                $appointments[] = [
                    'date' => $apptDate->toDateString(),
                    'time' => $apptTime->format('H:i:s'),
                    'datetime' => $apptDateTime,
                    'type' => 'appointment_date_time'
                ];
                $allDateTimes['appointment_date_time'] = [
                    'date' => $apptDate->toDateString(),
                    'time' => $apptTime->format('H:i:s'),
                    'datetime' => $apptDateTime->toDateTimeString()
                ];
            } else {
                $allDateTimes['appointment_date_time'] = null;
            }
        } else {
            $allDateTimes['appointment_date_time'] = null;
        }

        // 3. Check check_appointment_date and check_appointment_time from Order table
        if ($order->check_appointment_date && $order->check_appointment_time) {
            $checkDate = \Carbon\Carbon::parse($order->check_appointment_date);
            $checkTime = \Carbon\Carbon::parse($order->check_appointment_time);
            $checkDateTime = $checkDate->copy()->setTime($checkTime->hour, $checkTime->minute, $checkTime->second);
            
            $appointments[] = [
                'date' => $checkDate->toDateString(),
                'time' => $checkTime->format('H:i:s'),
                'datetime' => $checkDateTime,
                'type' => 'check_appointment'
            ];
            $allDateTimes['check_appointment'] = [
                'date' => $checkDate->toDateString(),
                'time' => $checkTime->format('H:i:s'),
                'datetime' => $checkDateTime->toDateTimeString()
            ];
        } else {
            $allDateTimes['check_appointment'] = null;
        }

        // 4. Check pickup_appointment_date and pickup_appointment_time from Order table
        if ($order->pickup_appointment_date && $order->pickup_appointment_time) {
            $pickupDate = \Carbon\Carbon::parse($order->pickup_appointment_date);
            $pickupTime = \Carbon\Carbon::parse($order->pickup_appointment_time);
            $pickupDateTime = $pickupDate->copy()->setTime($pickupTime->hour, $pickupTime->minute, $pickupTime->second);
            
            $appointments[] = [
                'date' => $pickupDate->toDateString(),
                'time' => $pickupTime->format('H:i:s'),
                'datetime' => $pickupDateTime,
                'type' => 'pickup_appointment'
            ];
            $allDateTimes['pickup_appointment'] = [
                'date' => $pickupDate->toDateString(),
                'time' => $pickupTime->format('H:i:s'),
                'datetime' => $pickupDateTime->toDateTimeString()
            ];
        } else {
            $allDateTimes['pickup_appointment'] = null;
        }

        // Find the earliest upcoming appointment (today or future)
        $upcomingAppointments = collect($appointments)
            ->filter(function($apt) use ($currentDateTime) {
                return $apt['datetime'] >= $currentDateTime->copy()->startOfDay();
            })
            ->sortBy('datetime')
            ->values();

        if ($upcomingAppointments->isEmpty()) {
            return [
                'date' => null,
                'time' => null,
                'type' => null,
                'all_date_times' => $allDateTimes
            ];
        }

        $nextAppointment = $upcomingAppointments->first();

        return [
            'date' => $nextAppointment['date'],
            'time' => $nextAppointment['time'],
            'type' => $nextAppointment['type'],
            'all_date_times' => $allDateTimes
        ];
    }

    private function getDerivedDateTime($order)
    {
        // FIRST CHECK: If appointment is still pending (Requesting), NEVER return appointment date/time
        // This must be checked FIRST before any other logic
        $appointmentStatus = optional($order->appointment)->status;
        $normalizedStatus = $appointmentStatus ? strtolower(trim($appointmentStatus)) : '';
        
        // If appointment status is 'pending' (Requesting), don't return any appointment date
        // This means the appointment hasn't been accepted by admin yet
        if ($normalizedStatus === 'pending') {
            return [null, null];
        }
        
        $status = $order->status;
        $date = null; 
        $time = null;
        
        // For Ready to Check: Show admin-set check appointment, otherwise fall back to original user appointment
        if ($status === 'Ready to Check') {
            if ($order->check_appointment_date && $order->check_appointment_time) {
                $date = $order->check_appointment_date;
                $time = $order->check_appointment_time;
            } else {
                $date = optional($order->appointment)->appointment_date;
                $time = optional($order->appointment)->appointment_time;
            }
        } 
        // For Completed: Show admin-set pickup appointment, otherwise fall back to original user appointment
        elseif ($status === 'Completed') {
            if ($order->pickup_appointment_date && $order->pickup_appointment_time) {
                $date = $order->pickup_appointment_date;
                $time = $order->pickup_appointment_time;
            } else {
                $date = optional($order->appointment)->appointment_date;
                $time = optional($order->appointment)->appointment_time;
            }
        } 
        // For Pending order status: Only show appointment date if appointment is accepted (not pending)
        // Double check: even if order status is Pending, don't show if appointment is still pending
        elseif ($status === 'Pending') {
            // Already checked above - if appointment is pending, return null
            // So if we reach here, appointment is accepted
            $date = optional($order->appointment)->appointment_date;
            $time = optional($order->appointment)->appointment_time;
        }
        // For Finished or Cancelled: No next appointment
        elseif ($status === 'Finished' || $status === 'Cancelled') {
            return [null, null];
        }
        // Default fallback (shouldn't happen, but just in case)
        else {
            $date = optional($order->appointment)->appointment_date;
            $time = optional($order->appointment)->appointment_time;
        }
        
        // Normalize formats - extract date part if datetime string is provided
        if ($date) {
            // If date contains time (datetime string), extract just the date part
            if (strpos($date, ' ') !== false) {
                $date = explode(' ', $date)[0];
            }
            // Parse and normalize to YYYY-MM-DD format
            $date = \Carbon\Carbon::parse($date)->toDateString();
        } else {
            $date = null;
        }
        
        // Normalize time format - handle HH:MM or HH:MM:SS
        if ($time) {
            // If time contains seconds, keep them; otherwise add :00
            $timeParts = explode(':', $time);
            if (count($timeParts) === 2) {
                $time = $time . ':00';
            }
            // Ensure format is H:i:s
            $time = \Carbon\Carbon::parse($time)->format('H:i:s');
        } else {
            $time = null;
        }
        
        return [$date, $time];
    }


    public function toggleHandled(Request $request, $orderId)
    {
        try {
            // Find the order manually to avoid route model binding issues
            $order = Order::findOrFail($orderId);

            $validated = $request->validate([
                'handled' => 'required',
            ]);

            // Convert various boolean representations to actual boolean
            $handledValue = $validated['handled'];
            
            // Handle different input types
            if (is_string($handledValue)) {
                $lowerValue = strtolower($handledValue);
                if (in_array($lowerValue, ['true', '1', 'yes', 'on'])) {
                    $handledValue = true;
                } elseif (in_array($lowerValue, ['false', '0', 'no', 'off'])) {
                    $handledValue = false;
                } else {
                    $handledValue = (bool) $handledValue;
                }
            } else {
                $handledValue = (bool) $handledValue;
            }

            $order->handled = $handledValue;
            $order->save();

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $order->id,
                    'handled' => $order->handled,
                    'status' => $order->status,
                ],
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            \Log::error('Order not found in toggleHandled', [
                'order_id' => $orderId ?? 'unknown',
                'request_data' => $request->all()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Order not found',
                'error' => 'Order not found',
            ], 404);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::error('Validation error in toggleHandled', [
                'errors' => $e->errors(),
                'request_data' => $request->all(),
                'order_id' => $orderId ?? 'unknown'
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error in toggleHandled', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'order_id' => $orderId ?? 'unknown',
                'request_data' => $request->all(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
                'message' => 'Failed to update handled status',
            ], 500);
        }
    }

    public function dashboardData()
    {
        $today = Carbon::today();
    
        $todaysAppointments = Appointment::whereDate('appointment_date', $today)
            ->where('status', 'accepted')
            ->whereHas('order')
            ->count();
    
        $recentAppointments = Appointment::with('user', 'order')
            ->where('status', 'accepted')
            ->whereHas('order')
            ->orderBy('appointment_date', 'desc')
            ->take(5)
            ->get();
    
        return response()->json([
            'success' => true,
            'data' => [
                'todaysAppointments' => $todaysAppointments,
                'recentAppointments' => $recentAppointments,
            ]
        ]);
    }

    public function updateSizesQuantity(Request $request, Order $order)
    {
        try {
            $validated = $request->validate([
                'sizes' => 'required|string',
                'total_quantity' => 'required|integer|min:1',
            ]);

            $appointment = $order->appointment;
            if (!$appointment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Appointment not found for this order'
                ], 404);
            }

            // Validate sizes JSON
            $sizes = json_decode($validated['sizes'], true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid sizes format'
                ], 422);
            }

            // Calculate total from sizes to ensure consistency
            $calculatedTotal = 0;
            if (is_array($sizes)) {
                $calculatedTotal = array_sum(array_map('intval', $sizes));
            }

            if ($calculatedTotal !== (int)$validated['total_quantity']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Total quantity does not match the sum of sizes'
                ], 422);
            }

            // Update appointment
            $appointment->sizes = $validated['sizes'];
            $appointment->total_quantity = $validated['total_quantity'];
            $appointment->save();

            return response()->json([
                'success' => true,
                'message' => 'Sizes and quantity updated successfully',
                'data' => [
                    'order_id' => $order->id,
                    'sizes' => json_decode($validated['sizes'], true),
                    'total_quantity' => $validated['total_quantity']
                ]
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error updating sizes and quantity', [
                'error' => $e->getMessage(),
                'order_id' => $order->id ?? 'unknown',
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update sizes and quantity',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function adminRefundOrder(Request $request, $orderId)
    {
        try {
            // Validate refund image is required
            $validated = $request->validate([
                'refund_image' => 'required|file|image|max:5120',
            ]);

            $order = Order::with('appointment.user')->findOrFail($orderId);
            $appointment = $order->appointment;

            if (!$appointment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Appointment not found for this order'
                ], 404);
            }

            // Check if order is cancelled
            if ($order->status !== 'Cancelled') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only cancelled orders can be refunded'
                ], 400);
            }

            // Upload refund image
            $refundImagePath = null;
            if ($request->hasFile('refund_image')) {
                $refundImagePath = $request->file('refund_image')->store('refunds', 'public');
                \Log::info('Refund image uploaded', ['path' => $refundImagePath]);
            }

            // Update appointment with refund image
            $appointment->refund_image = $refundImagePath;
            $appointment->save();

            // Create notification for the user
            Notification::create([
                'user_id' => $appointment->user_id,
                'type'    => 'refund_processed',
                'title'   => 'Your down payment for the cancelled appointment/order has been successfully refunded by the admin.',
                'body'    => null,
                'data'    => [
                    'appointment_id' => $appointment->id,
                    'order_id' => $order->id,
                    'refund_image'   => $refundImagePath ? asset('storage/' . $refundImagePath) : null,
                ],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Refund processed successfully'
            ], 200);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error processing refund', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'order_id' => $orderId
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to process refund',
                'error' => $e->getMessage()
            ], 500);
        }
    }




}
