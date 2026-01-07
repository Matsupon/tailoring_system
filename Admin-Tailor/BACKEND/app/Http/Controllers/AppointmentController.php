<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Appointment;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;
use App\Models\Notification;
use App\Models\ServiceType;

class AppointmentController extends Controller
{
    public function getServiceTypes()
    {
        try {
            $serviceTypes = ServiceType::orderBy('name')->get();
            
            return response()->json([
                'success' => true,
                'data' => $serviceTypes
            ], 200);
        } catch (\Exception $e) {
            \Log::error('Error fetching service types', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch service types',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Test method for debugging
    public function test()
    {
        return response()->json([
            'message' => 'AppointmentController is working!',
            'timestamp' => now(),
            'user_id' => auth()->id(),
            'authenticated' => auth()->check()
        ]);
    }

    public function store(Request $request)
    {
        // Log immediately when method is called
        \Log::info('=== AppointmentController::store() CALLED ===', [
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'has_auth_token' => $request->bearerToken() ? 'yes' : 'no',
            'auth_user_id' => auth()->check() ? auth()->id() : 'not authenticated',
            'content_type' => $request->header('Content-Type'),
            'content_length' => $request->header('Content-Length'),
        ]);
        
        try {
            // Log the incoming request data for debugging
            \Log::info('Appointment booking request received', [
                'headers' => $request->headers->all(),
                'data' => $request->all(),
                'files' => $request->allFiles(),
                'user_id' => auth()->id()
            ]);

            $validated = $request->validate([
                'service_type' => 'required|string',
                'sizes' => 'required|string',  
                'total_quantity' => 'required|integer',
                'notes' => 'nullable|string',
                'design_image' => 'nullable|file|image|max:5120',
                'gcash_proof' => 'required|file|image|max:5120',
                'preferred_due_date' => 'required|date',
                'appointment_date' => 'required|date|after_or_equal:today',
                'appointment_time' => 'required|date_format:H:i',
            ]);

            \Log::info('Validation passed', $validated);
        } catch (ValidationException $e) {
            \Log::error('Validation failed', [
                'errors' => $e->errors(),
                'request_data' => $request->all()
            ]);
            
            return response()->json([
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
        }
    
        // Check conflicts across both appointments and admin-set order schedules
        // EXCLUDE appointments that are linked to finished orders (those slots are now available)
        // EXCLUDE cancelled appointments (state = 'cancelled') - their slots should be available
        try {
            $conflictInAppointments = Appointment::where('appointment_date', $validated['appointment_date'])
                ->where('appointment_time', $validated['appointment_time'])
                ->where(function($q) {
                    $q->where('state', 'active')
                      ->orWhereNull('state'); // Include appointments without state column (backward compatibility)
                })
                ->where(function ($q) {
                    $q->whereDoesntHave('order') // Appointments without orders (still pending)
                      ->orWhereHas('order', function ($q2) {
                          $q2->where('status', '!=', 'Finished') // Or orders that aren't finished
                             ->where('status', '!=', 'Cancelled'); // Exclude cancelled orders
                      });
                })
                ->exists();

            // Also check conflicts in Orders: Ready to Check (check_appointment_*) and Completed (pickup_appointment_*) - EXCLUDE FINISHED AND CANCELLED ORDERS
            $conflictInOrders = \App\Models\Order::where('status', '!=', 'Finished') // Exclude finished orders
                ->where('status', '!=', 'Cancelled') // Exclude cancelled orders - their slots should be available
                ->where(function ($q) use ($validated) {
                    $q->where(function ($q1) use ($validated) {
                        $q1->whereDate('check_appointment_date', $validated['appointment_date'])
                           ->where('check_appointment_time', $validated['appointment_time']);
                    })
                    ->orWhere(function ($q2) use ($validated) {
                        $q2->whereDate('pickup_appointment_date', $validated['appointment_date'])
                           ->where('pickup_appointment_time', $validated['appointment_time']);
                    });
                })
                ->exists();

            $conflict = $conflictInAppointments || $conflictInOrders;
        } catch (\Exception $conflictError) {
            \Log::error('Error checking appointment conflicts', [
                'error' => $conflictError->getMessage(),
                'trace' => $conflictError->getTraceAsString(),
                'date' => $validated['appointment_date'],
                'time' => $validated['appointment_time']
            ]);
            
            // If conflict check fails, allow the appointment but log the error
            // This prevents blocking appointments due to database query issues
            $conflict = false;
        }
    
        if ($conflict) {
            \Log::warning('Double booking attempt', [
                'date' => $validated['appointment_date'],
                'time' => $validated['appointment_time']
            ]);
            
            return response()->json([
                'message' => 'This time slot is already taken.',
                'errors' => ['appointment_time' => ['Already booked.']]
            ], 422);
        }
    
        try {
            $designImagePath = null;
            if ($request->hasFile('design_image')) {
                $designImagePath = $request->file('design_image')->store('designs', 'public');
                \Log::info('Design image uploaded', ['path' => $designImagePath]);
            }
        
            $gcashProofPath = $request->file('gcash_proof')->store('gcash_proofs', 'public');
            \Log::info('GCash proof uploaded', ['path' => $gcashProofPath]);
        
            $appointment = Appointment::create([
                'user_id' => auth()->id(),
                'service_type' => $validated['service_type'],
                'sizes' => $validated['sizes'],
                'total_quantity' => $validated['total_quantity'],
                'notes' => $validated['notes'] ?? null,
                'design_image' => $designImagePath,
                'gcash_proof' => $gcashProofPath,
                'preferred_due_date' => $validated['preferred_due_date'],
                'appointment_date' => $validated['appointment_date'],
                'appointment_time' => $validated['appointment_time'],
                'status' => 'pending', // Explicitly set status to pending for new appointments
                'state' => 'active', // Default state is active for new appointments
            ]);

            \Log::info('Appointment created successfully', [
                'appointment_id' => $appointment->id,
                'user_id' => $appointment->user_id
            ]);
        
            // Customer-facing notification
            Notification::create([
                'user_id' => $appointment->user_id,
                'type'    => 'appointment_booked',
                'title'   => 'You have successfully booked an appointment!',
                'body'    => 'Please wait while the admin reviews your appointment request. Your order will be processed once it has been approved.',
                'data'    => [
                    'appointment_id'  => $appointment->id,
                    'appointment_date'=> $appointment->appointment_date,
                    'appointment_time'=> $appointment->appointment_time,
                    'created_by'      => 'customer',
                ],
            ]);

            // Admin-facing notification for dashboard tracking (will be filtered out for customers)
            Notification::create([
                'user_id' => $appointment->user_id,
                'type'    => 'appointment_book',
                'title'   => 'New appointment submitted',
                'body'    => null,
                'data'    => [
                    'appointment_id'  => $appointment->id,
                    'appointment_date'=> $appointment->appointment_date,
                    'appointment_time'=> $appointment->appointment_time,
                ],
            ]);
        
            return response()->json([
                'message' => 'Appointment booked successfully',
                'appointment' => $appointment
            ], 201);
            
        } catch (\Exception $e) {
            \Log::error('Error creating appointment', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'validated_data' => $validated
            ]);
            
            return response()->json([
                'message' => 'Failed to create appointment',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    
    

    public function getAvailableSlots(Request $request)
    {
        $dateInput = $request->input('date');
        $excludeOrderId = $request->input('exclude_order_id'); // Optional: exclude this order's appointment when editing
        $excludeAppointmentId = $request->input('exclude_appointment_id'); // Optional: exclude this appointment when editing (for pending appointments without orders)
        
        if (!$dateInput) {
            return response()->json([
                'message' => 'Date parameter is required',
                'errors' => ['date' => ['The date field is required.']]
            ], 422);
        }
        
        try {
            // Parse and normalize the date
            $date = \Carbon\Carbon::parse($dateInput)->format('Y-m-d');
            $today = \Carbon\Carbon::today()->format('Y-m-d');
            
            // Check if date is today or in the future
            if ($date < $today) {
                return response()->json([
                    'message' => 'Date must be today or in the future',
                    'errors' => ['date' => ['The date must be today or in the future.']]
                ], 422);
            }
        } catch (\Exception $parseError) {
            return response()->json([
                'message' => 'Invalid date format',
                'errors' => ['date' => ['The date must be a valid date.']]
            ], 422);
        }
        
        // Generate 30-minute time slots from 8:00 AM to 8:00 PM (excluding 12:00 and 12:30)
        $allowedSlots = [];
        for ($hour = 8; $hour <= 20; $hour++) {
            for ($minute = 0; $minute < 60; $minute += 30) {
                $time = sprintf('%02d:%02d', $hour, $minute);
                if ($time !== '12:00' && $time !== '12:30') {
                    $allowedSlots[] = $time;
                }
            }
        }

        $allBooked = collect();

        // 1. Booked from Appointment model: appointment_date and appointment_time
        // Exclude cancelled appointments (state = 'cancelled') - their slots should be available
        // If exclude_order_id is provided, exclude appointments linked to that order
        // If exclude_appointment_id is provided, exclude that specific appointment (for pending appointments without orders)
        $appointmentsQuery = Appointment::whereDate('appointment_date', $date)
            ->whereNotNull('appointment_time')
            ->where(function($q) {
                $q->where('state', 'active')
                  ->orWhereNull('state'); // Include appointments without state column (backward compatibility)
            });
        
        if ($excludeOrderId) {
            $appointmentsQuery->whereDoesntHave('order', function($q) use ($excludeOrderId) {
                $q->where('id', $excludeOrderId);
            });
        }
        
        if ($excludeAppointmentId) {
            $appointmentsQuery->where('id', '!=', $excludeAppointmentId);
        }
        
        $bookedFromAppointments = $appointmentsQuery
            ->pluck('appointment_time')
            ->map(function ($time) { 
                try {
                    // Try to parse as datetime first
                    $parsed = \Carbon\Carbon::parse($time);
                    return $parsed->format('H:i');
                } catch (\Exception $e) {
                    // If already in H:i format, return as is
                    if (preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $time)) {
                        return substr($time, 0, 5); // Return HH:MM format
                    }
                    return null;
                }
            })
            ->filter()
            ->toArray();
        $allBooked = $allBooked->merge($bookedFromAppointments);

        // 2. Booked from Order model: scheduled_at (extract time from datetime)
        // Exclude cancelled orders - their slots should be available
        $scheduledQuery = \App\Models\Order::whereDate('scheduled_at', $date)
            ->whereNotNull('scheduled_at')
            ->where('status', '!=', 'Cancelled');
        
        if ($excludeOrderId) {
            $scheduledQuery->where('id', '!=', $excludeOrderId);
        }
        
        $bookedFromScheduled = $scheduledQuery
            ->get()
            ->map(function ($order) {
                try {
                    return \Carbon\Carbon::parse($order->scheduled_at)->format('H:i');
                } catch (\Exception $e) {
                    return null;
                }
            })
            ->filter()
            ->toArray();
        $allBooked = $allBooked->merge($bookedFromScheduled);

        // 3. Booked from Order model: completed_at (extract time from datetime)
        // Exclude cancelled orders - their slots should be available
        $completedQuery = \App\Models\Order::whereDate('completed_at', $date)
            ->whereNotNull('completed_at')
            ->where('status', '!=', 'Cancelled');
        
        if ($excludeOrderId) {
            $completedQuery->where('id', '!=', $excludeOrderId);
        }
        
        $bookedFromCompleted = $completedQuery
            ->get()
            ->map(function ($order) {
                try {
                    return \Carbon\Carbon::parse($order->completed_at)->format('H:i');
                } catch (\Exception $e) {
                    return null;
                }
            })
            ->filter()
            ->toArray();
        $allBooked = $allBooked->merge($bookedFromCompleted);

        // 4. Booked from Order model: check_appointment_date and check_appointment_time
        // Exclude cancelled orders - their slots should be available
        $checkQuery = \App\Models\Order::whereDate('check_appointment_date', $date)
            ->whereNotNull('check_appointment_time')
            ->where('status', '!=', 'Cancelled');
        
        if ($excludeOrderId) {
            $checkQuery->where('id', '!=', $excludeOrderId);
        }
        
        $bookedFromCheck = $checkQuery
            ->pluck('check_appointment_time')
            ->map(function ($t) { 
                try {
                    $parsed = \Carbon\Carbon::parse($t);
                    return $parsed->format('H:i');
                } catch (\Exception $e) {
                    if (preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $t)) {
                        return substr($t, 0, 5);
                    }
                    return null;
                }
            })
            ->filter()
            ->toArray();
        $allBooked = $allBooked->merge($bookedFromCheck);

        // 5. Booked from Order model: pickup_appointment_date and pickup_appointment_time
        // Exclude cancelled orders - their slots should be available
        $pickupQuery = \App\Models\Order::whereDate('pickup_appointment_date', $date)
            ->whereNotNull('pickup_appointment_time')
            ->where('status', '!=', 'Cancelled');
        
        if ($excludeOrderId) {
            $pickupQuery->where('id', '!=', $excludeOrderId);
        }
        
        $bookedFromPickup = $pickupQuery
            ->pluck('pickup_appointment_time')
            ->map(function ($t) { 
                try {
                    $parsed = \Carbon\Carbon::parse($t);
                    return $parsed->format('H:i');
                } catch (\Exception $e) {
                    if (preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $t)) {
                        return substr($t, 0, 5);
                    }
                    return null;
                }
            })
            ->filter()
            ->toArray();
        $allBooked = $allBooked->merge($bookedFromPickup);

        // Get unique booked times
        $allBooked = $allBooked->unique()->values()->toArray();

        $available = array_values(array_diff($allowedSlots, $allBooked));

        return response()->json([
            'available_slots' => $available
        ]);
    }

public function adminGetAllAppointments()
{
    try {
        // Get all pending appointments:
        // - Active appointments (state = 'active')
        // - Cancelled appointments without refund_image (need refund processing)
        // Exclude appointments that already have refund_image (refund already processed)
        $appointments = Appointment::with('user')
    ->where('status', 'pending')
    ->where(function($q) {
        $q->where('state', 'active')
          ->orWhere(function($q2) {
              $q2->where('state', 'cancelled')
                 ->whereNull('refund_image');
          });
    })
    ->orderBy('created_at', 'desc')
    ->get()
    ->map(function ($appointment) {
        return [
            'id' => $appointment->id,
            'service_type' => $appointment->service_type,
            'sizes' => json_decode($appointment->sizes, true),
            'total_quantity' => $appointment->total_quantity ?? 'N/A',
            'preferred_due_date' => $appointment->preferred_due_date 
                ? \Carbon\Carbon::parse($appointment->preferred_due_date)->format('Y-m-d H:i:s') 
                : 'N/A',
            'appointment_date' => $appointment->appointment_date 
                ? \Carbon\Carbon::parse($appointment->appointment_date)->format('Y-m-d') 
                : 'N/A',
            'appointment_time' => $appointment->appointment_time 
                ? \Carbon\Carbon::parse($appointment->appointment_time)->format('H:i')
                : 'N/A',
            'notes' => $appointment->notes ?? 'No notes provided.',
            'design_image' => $appointment->design_image 
                ? asset('storage/' . $appointment->design_image) 
                : null,
            'gcash_proof' => $appointment->gcash_proof 
                ? asset('storage/' . $appointment->gcash_proof) 
                : null,
            'refund_image' => $appointment->refund_image 
                ? asset('storage/' . $appointment->refund_image) 
                : null,
            'status' => $appointment->status,
            'state' => $appointment->state ?? 'active',
            'created_at' => $appointment->created_at->toDateTimeString(),
            'user' => [
                'id' => $appointment->user->id,
                'name' => $appointment->user->name,
                'phone' => $appointment->user->phone,
                'email' => $appointment->user->email,
            ]
        ];
    });

        return response()->json([
            'success' => true,
            'data' => $appointments
        ], 200);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch appointments',
            'error' => $e->getMessage()
        ], 500);
    }
}

public function adminGetAcceptedAppointments()
{
    try {
        $appointments = Appointment::with(['user', 'order'])
            ->where('status', 'accepted')
            ->where('state', 'active') // Only show active appointments (not cancelled)
            ->whereNull('refund_image') // Exclude appointments with refund_image (already refunded)
            ->whereHas('order', function($query) {
                $query->where('status', '!=', 'Finished')
                      ->where('status', '!=', 'Cancelled');
            })
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($appointment) {
                return [
                    'id' => $appointment->id,
                    'service_type' => $appointment->service_type,
                    'sizes' => json_decode($appointment->sizes, true),
                    'total_quantity' => $appointment->total_quantity ?? 'N/A',
                    'preferred_due_date' => $appointment->preferred_due_date 
                        ? \Carbon\Carbon::parse($appointment->preferred_due_date)->format('Y-m-d H:i:s') 
                        : 'N/A',
                    'appointment_date' => $appointment->appointment_date 
                        ? \Carbon\Carbon::parse($appointment->appointment_date)->format('Y-m-d') 
                        : 'N/A',
                    'appointment_time' => $appointment->appointment_time 
                        ? \Carbon\Carbon::parse($appointment->appointment_time)->format('H:i')
                        : 'N/A',
                    'notes' => $appointment->notes ?? 'No notes provided.',
                    'design_image' => $appointment->design_image 
                        ? asset('storage/' . $appointment->design_image) 
                        : null,
                    'gcash_proof' => $appointment->gcash_proof 
                        ? asset('storage/' . $appointment->gcash_proof) 
                        : null,
                    'refund_image' => $appointment->refund_image 
                        ? asset('storage/' . $appointment->refund_image) 
                        : null,
                    'status' => $appointment->status,
                    'state' => $appointment->state ?? 'active',
                    'order_status' => $appointment->order->status ?? 'N/A',
                    'created_at' => $appointment->created_at->toDateTimeString(),
                    'user' => [
                        'id' => $appointment->user->id,
                        'name' => $appointment->user->name,
                        'phone' => $appointment->user->phone,
                        'email' => $appointment->user->email,
                    ]
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $appointments
        ], 200);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch accepted appointments',
            'error' => $e->getMessage()
        ], 500);
    }
}


public function adminGetAppointmentById($id)
{
    try {
        $appointment = Appointment::with('user')->findOrFail($id);

        $sizes = [];
        if (!empty($appointment->sizes)) {
            $decodedSizes = json_decode($appointment->sizes, true);
            if (is_array($decodedSizes)) {
                foreach ($decodedSizes as $size => $qty) {
                    if ($qty > 0) {
                        $sizes[] = "$size - {$qty} pcs.";
                    }
                }
            }
        }

        $formattedAppointment = [
            'id'                 => $appointment->id,
            'user_name'          => $appointment->user->name ?? 'N/A',
            'phone_number'       => $appointment->user->phone ?? 'N/A',
            'service_type'       => $appointment->service_type ?? 'N/A',
            'sizes'              => $sizes ?: ['No sizes provided'],
            'total_quantity'     => $appointment->total_quantity ?? 'N/A',

            'appointment_date'   => $appointment->appointment_date 
                                    ?? ($appointment->appointment_time 
                                        ? \Carbon\Carbon::parse($appointment->appointment_time)->format('Y-m-d') 
                                        : 'N/A'),

            'preferred_due_date' => $appointment->preferred_due_date 
                                    ? \Carbon\Carbon::parse($appointment->preferred_due_date)->format('Y-m-d H:i:s') 
                                    : 'N/A',
            'appointment_time'   => $appointment->appointment_time 
                                    ? \Carbon\Carbon::parse($appointment->appointment_time)->format('H:i:s') 
                                    : 'N/A',
            'notes'              => $appointment->notes ?? 'No notes provided',
            'design_image'       => $appointment->design_image 
                                    ? asset('storage/' . $appointment->design_image) 
                                    : null,
            'gcash_proof'        => $appointment->gcash_proof 
                                    ? asset('storage/' . $appointment->gcash_proof) 
                                    : null,
            'refund_image'       => $appointment->refund_image 
                                    ? asset('storage/' . $appointment->refund_image) 
                                    : null,
            'status'             => $appointment->status,
            'created_at'         => $appointment->created_at->toDateTimeString(),
        ];

        return response()->json([
            'success' => true,
            'data' => $formattedAppointment
        ], 200);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Appointment not found',
            'error' => $e->getMessage()
        ], 404);
    }
}


public function dashboard()
{
    $today = Carbon::today()->toDateString();

    $todaysAppointments = Appointment::whereDate('appointment_date', $today)->count();

    $appointmentsList = Appointment::whereDate('appointment_date', $today)->get();

    return view('dashboard', compact('todaysAppointments', 'appointmentsList'));
}



    public function adminRejectAppointment(Request $request, $id)
    {
        try {
            // Validate refund image is required
            $validated = $request->validate([
                'refund_image' => 'required|file|image|max:5120',
            ]);

            $appointment = Appointment::with('order')->findOrFail($id);
            $appointmentUserId = $appointment->user_id;
            $order = $appointment->order;

            // Upload refund image
            $refundImagePath = null;
            if ($request->hasFile('refund_image')) {
                $refundImagePath = $request->file('refund_image')->store('refunds', 'public');
                \Log::info('Refund image uploaded', ['path' => $refundImagePath]);
            }

            // Update appointment status to rejected and save refund image
            // Set state to 'cancelled' to make the time slot available again
            // Note: We don't clear appointment_date and appointment_time because the columns are NOT NULL
            // The filtering logic excludes appointments with state != 'active'
            $appointment->status = 'rejected';
            $appointment->state = 'cancelled';
            $appointment->refund_image = $refundImagePath;
            $appointment->save();

            // If order exists, mark it as cancelled instead of deleting it
            // This keeps the rejected appointment visible in the mobile app
            if ($order) {
                $order->status = 'Cancelled';
                $order->save();
            }

            // Create a notification to inform the user their appointment was rejected by admin
            Notification::create([
                'user_id' => $appointmentUserId,
                'type'    => 'appointment_rejected',
                'title'   => "We're sorry, unfortunately your appointment has been rejected by the admin.",
                'body'    => 'Please ensure you uploaded the correct gcash payment proof and try again next time. Your payment has been refunded.',
                'data'    => [
                    'appointment_id' => $appointment->id,
                    'refund_image'   => $refundImagePath ? asset('storage/' . $refundImagePath) : null,
                    'reason'         => 'rejected_by_admin',
                ],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Appointment rejected successfully'
            ], 200);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error rejecting appointment', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'appointment_id' => $id
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to reject appointment',
                'error' => $e->getMessage()
            ], 500);
        }
    }



    public function index()
    {
        try {
            // Only return pending and accepted appointments (exclude rejected)
            $appointments = Appointment::with('user')
                ->whereIn('status', ['pending', 'accepted'])
                ->get();
            return response()->json($appointments);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch appointments',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $appointment = Appointment::with('order')->findOrFail($id);
            $appointmentUserId = $appointment->user_id;
            $order = $appointment->order;

            // Create a notification to inform the user their appointment was deleted/rejected by admin
            Notification::create([
                'user_id' => $appointmentUserId,
                'type'    => 'appointment_rejected',
                'title'   => "We're sorry, unfortunately your appointment has been rejected by the admin.",
                'body'    => 'Please ensure you uploaded the correct gcash payment proof and try again next time',
                'data'    => [
                    'appointment_id' => $appointment->id,
                    'reason'         => 'deleted_by_admin',
                ],
            ]);

            // Delete the order first (if exists) to maintain referential integrity
            if ($order) {
                $order->delete();
            }

            // Delete the appointment
            $appointment->delete();

            return response()->json(['message' => 'Appointment rejected and deleted.']);
        } catch (\Exception $e) {
            \Log::error('Error deleting appointment', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'appointment_id' => $id
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete appointment',
                'error' => $e->getMessage()
            ], 500);
        }
    }


    public function getNextAppointment(Request $request)
    {
        $userId = $request->user()->id;

        $appointment = \App\Models\Appointment::where('user_id', $userId)
            ->whereDate('appointment_date', '>=', now()->toDateString())
            ->orderBy('appointment_date', 'asc')
            ->orderBy('appointment_time', 'asc')
            ->first();

        if (!$appointment) {
            return response()->json([]);
        }

        return response()->json([
            'id' => $appointment->id,
            'service_type' => $appointment->service_type,
            'appointment_date' => \Carbon\Carbon::parse($appointment->appointment_date)->format('Y-m-d'),
            'appointment_time' => \Carbon\Carbon::parse($appointment->appointment_time)->format('H:i:s'),
        ]);
    }

    public function getNextAppointmentByOrderStatus(Request $request)
    {
        $userId = $request->user()->id;

        $latestOrder = \App\Models\Order::with('appointment')
            ->whereHas('appointment', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            })
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$latestOrder) {
            return $this->getNextAppointment($request);
        }

        $status = $latestOrder->status;
        $appointmentDate = null;
        $appointmentTime = null;

        if ($status === 'Pending') {
            $appointmentDate = $latestOrder->appointment->appointment_date;
            $appointmentTime = $latestOrder->appointment->appointment_time;
        } elseif ($status === 'Ready to Check') {
            $appointmentDate = $latestOrder->check_appointment_date;
            $appointmentTime = $latestOrder->check_appointment_time;
        } elseif ($status === 'Completed') {
            $appointmentDate = $latestOrder->pickup_appointment_date;
            $appointmentTime = $latestOrder->pickup_appointment_time;
        }

        if (!$appointmentDate || !$appointmentTime) {
            return response()->json([]);
        }

        return response()->json([
            'id' => $latestOrder->appointment->id,
            'service_type' => $latestOrder->appointment->service_type,
            'appointment_date' => \Carbon\Carbon::parse($appointmentDate)->format('Y-m-d'),
            'appointment_time' => \Carbon\Carbon::parse($appointmentTime)->format('H:i:s'),
            'order_status' => $status,
        ]);
    }

    public function updateOrderDetails(Request $request)
    {
        try {
            $validated = $request->validate([
                'order_id' => 'required|exists:orders,id',
                'appointment_date' => 'required|date|after_or_equal:today',
                'appointment_time' => 'required|date_format:H:i',
                'preferred_due_date' => 'required|date',
            ]);

            $order = \App\Models\Order::with('appointment')->findOrFail($validated['order_id']);
            $userId = $request->user()->id;

            // Verify the order belongs to the authenticated user
            if ($order->appointment->user_id !== $userId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            // Update appointment date and time
            $order->appointment->appointment_date = $validated['appointment_date'];
            $order->appointment->appointment_time = $validated['appointment_time'];
            $order->appointment->preferred_due_date = $validated['preferred_due_date'];
            $order->appointment->save();

            // Create customer notification
            Notification::create([
                'user_id' => $userId,
                'type' => 'order_details_updated',
                'title' => 'You have successfully updated your Order Details!',
                'body' => null,
                'data' => [
                    'order_id' => $order->id,
                    'appointment_id' => $order->appointment->id,
                    'appointment_date' => $validated['appointment_date'],
                    'appointment_time' => $validated['appointment_time'],
                    'preferred_due_date' => $validated['preferred_due_date'],
                ],
            ]);

            // Create admin notification - store with user_id = 0 to indicate it's for all admins
            // Note: This requires user_id to be nullable in the notifications table or foreign key check disabled
            try {
                // Temporarily disable foreign key checks
                \DB::statement('SET FOREIGN_KEY_CHECKS=0');
                \DB::table('notifications')->insert([
                    'user_id' => 0,
                    'type' => 'customer_appointment_updated',
                    'title' => $order->appointment->user->name . ' updated their next appointment date and time!',
                    'body' => 'Your next appointment date and time with them will be ' . 
                        Carbon::parse($validated['appointment_date'])->format('F j, Y') . ' at ' . 
                        Carbon::parse($validated['appointment_time'])->format('g:i A'),
                    'data' => json_encode([
                        'order_id' => $order->id,
                        'appointment_id' => $order->appointment->id,
                        'customer_name' => $order->appointment->user->name,
                        'customer_user_id' => $order->appointment->user_id,
                        'appointment_date' => $validated['appointment_date'],
                        'appointment_time' => $validated['appointment_time'],
                        'preferred_due_date' => $validated['preferred_due_date'],
                    ]),
                    'is_viewed' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                \DB::statement('SET FOREIGN_KEY_CHECKS=1');
            } catch (\Exception $e) {
                \DB::statement('SET FOREIGN_KEY_CHECKS=1'); // Re-enable in case of error
                \Log::warning('Failed to create admin notification: ' . $e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Order details updated successfully',
                'data' => [
                    'appointment_date' => $order->appointment->appointment_date,
                    'appointment_time' => $order->appointment->appointment_time,
                    'preferred_due_date' => $order->appointment->preferred_due_date,
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Error updating order details', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to update order details',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function updateAppointmentDetails(Request $request)
    {
        try {
            $validated = $request->validate([
                'appointment_id' => 'required|exists:appointments,id',
                'appointment_date' => 'required|date|after_or_equal:today',
                'appointment_time' => 'required|date_format:H:i',
                'preferred_due_date' => 'required|date',
            ]);

            $appointment = Appointment::findOrFail($validated['appointment_id']);
            $userId = $request->user()->id;

            // Verify the appointment belongs to the authenticated user
            if ($appointment->user_id !== $userId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            // Only allow updating pending appointments (those without orders or with pending orders)
            if ($appointment->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only pending appointments can be updated directly'
                ], 400);
            }

            // Check for conflicts across both appointments and admin-set order schedules
            // EXCLUDE the current appointment when checking for conflicts
            // EXCLUDE cancelled appointments (state = 'cancelled') - their slots should be available
            $conflictInAppointments = Appointment::where('appointment_date', $validated['appointment_date'])
                ->where('appointment_time', $validated['appointment_time'])
                ->where('id', '!=', $appointment->id)
                ->where(function($q) {
                    $q->where('state', 'active')
                      ->orWhereNull('state'); // Include appointments without state column (backward compatibility)
                })
                ->where(function ($q) {
                    $q->whereDoesntHave('order') // Appointments without orders (still pending)
                      ->orWhereHas('order', function ($q2) {
                          $q2->where('status', '!=', 'Finished') // Or orders that aren't finished
                             ->where('status', '!=', 'Cancelled'); // Exclude cancelled orders
                      });
                })
                ->exists();

            // Also check conflicts in Orders: Ready to Check (check_appointment_*) and Completed (pickup_appointment_*) - EXCLUDE FINISHED AND CANCELLED ORDERS
            $conflictInOrders = \App\Models\Order::where('status', '!=', 'Finished')
                ->where('status', '!=', 'Cancelled') // Exclude cancelled orders - their slots should be available
                ->where(function ($q) use ($validated) {
                    $q->where(function ($q1) use ($validated) {
                        $q1->whereDate('check_appointment_date', $validated['appointment_date'])
                           ->where('check_appointment_time', $validated['appointment_time']);
                    })
                    ->orWhere(function ($q2) use ($validated) {
                        $q2->whereDate('pickup_appointment_date', $validated['appointment_date'])
                           ->where('pickup_appointment_time', $validated['appointment_time']);
                    });
                })
                ->exists();

            $conflict = $conflictInAppointments || $conflictInOrders;

            if ($conflict) {
                return response()->json([
                    'message' => 'This time slot is already taken.',
                    'errors' => ['appointment_time' => ['Already booked.']]
                ], 422);
            }

            // Update appointment date, time, and due date
            $appointment->appointment_date = $validated['appointment_date'];
            $appointment->appointment_time = $validated['appointment_time'];
            $appointment->preferred_due_date = $validated['preferred_due_date'];
            $appointment->save();

            // Create customer notification
            Notification::create([
                'user_id' => $userId,
                'type' => 'appointment_updated',
                'title' => 'You have successfully updated your appointment details!',
                'body' => null,
                'data' => [
                    'appointment_id' => $appointment->id,
                    'appointment_date' => $validated['appointment_date'],
                    'appointment_time' => $validated['appointment_time'],
                    'preferred_due_date' => $validated['preferred_due_date'],
                ],
            ]);

            // Create admin notification
            try {
                \DB::statement('SET FOREIGN_KEY_CHECKS=0');
                \DB::table('notifications')->insert([
                    'user_id' => 0,
                    'type' => 'customer_appointment_updated',
                    'title' => $appointment->user->name . ' updated their appointment date and time!',
                    'body' => 'Appointment date and time: ' . 
                        Carbon::parse($validated['appointment_date'])->format('F j, Y') . ' at ' . 
                        Carbon::parse($validated['appointment_time'])->format('g:i A'),
                    'data' => json_encode([
                        'appointment_id' => $appointment->id,
                        'customer_name' => $appointment->user->name,
                        'customer_user_id' => $appointment->user_id,
                        'appointment_date' => $validated['appointment_date'],
                        'appointment_time' => $validated['appointment_time'],
                        'preferred_due_date' => $validated['preferred_due_date'],
                    ]),
                    'is_viewed' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                \DB::statement('SET FOREIGN_KEY_CHECKS=1');
            } catch (\Exception $e) {
                \DB::statement('SET FOREIGN_KEY_CHECKS=1');
                \Log::warning('Failed to create admin notification: ' . $e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Appointment details updated successfully',
                'data' => [
                    'appointment_date' => $appointment->appointment_date,
                    'appointment_time' => $appointment->appointment_time,
                    'preferred_due_date' => $appointment->preferred_due_date,
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Error updating appointment details', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to update appointment details',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function myAppointments(Request $request)
    {
        try {
            $userId = $request->user()->id;
            
            $appointments = Appointment::with('order')
                ->where('user_id', $userId)
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function ($appointment) {
                    $order = $appointment->order;
                    $appointmentStatus = $appointment->status; // 'pending', 'accepted', 'rejected'
                    $orderStatus = $order ? $order->status : null; // 'Pending', 'Ready to Check', 'Completed', 'Finished'
                    $handled = $order ? (bool)($order->handled ?? false) : false;
                    
                    // Determine display status for filtering
                    // Priority order:
                    // 1. rejected (status) -> Rejected (admin rejected the appointment)
                    // 2. cancelled (state) -> Cancelled (user cancelled the appointment)
                    // 3. accepted (status) -> Accepted (admin accepted, order exists)
                    // 4. pending (status) -> Requesting (waiting for admin approval)
                    $appointmentState = $appointment->state ?? 'active';
                    $displayStatus = 'Requesting'; // Default for pending appointments
                    
                    if ($appointmentStatus === 'rejected') {
                        // Admin rejected - show as Rejected regardless of state
                        $displayStatus = 'Rejected';
                    } elseif ($appointmentState === 'cancelled' && $appointmentStatus !== 'rejected') {
                        // User cancelled - show as Cancelled (only if not rejected by admin)
                        $displayStatus = 'Cancelled';
                    } elseif ($appointmentStatus === 'accepted' && $order) {
                        // Admin accepted and order exists - show as Accepted
                        $displayStatus = 'Accepted';
                    }
                    // Note: pending appointments without orders should still show as "Requesting"
                    // because they're waiting for admin approval, not rejected
                    
                    return [
                        'id' => $appointment->id,
                        'service_type' => $appointment->service_type,
                        'sizes' => json_decode($appointment->sizes, true),
                        'total_quantity' => $appointment->total_quantity,
                        'notes' => $appointment->notes,
                        'design_image' => $appointment->design_image 
                            ? asset('storage/' . $appointment->design_image) 
                            : null,
                        'gcash_proof' => $appointment->gcash_proof 
                            ? asset('storage/' . $appointment->gcash_proof) 
                            : null,
                        'refund_image' => $appointment->refund_image 
                            ? asset('storage/' . $appointment->refund_image) 
                            : null,
                        'preferred_due_date' => $appointment->preferred_due_date 
                            ? \Carbon\Carbon::parse($appointment->preferred_due_date)->format('Y-m-d') 
                            : null,
                        'appointment_date' => $appointment->appointment_date 
                            ? \Carbon\Carbon::parse($appointment->appointment_date)->format('Y-m-d') 
                            : null,
                        'appointment_time' => $appointment->appointment_time 
                            ? \Carbon\Carbon::parse($appointment->appointment_time)->format('H:i') 
                            : null,
                        'status' => $appointmentStatus, // Appointment status: pending, accepted, rejected
                        'display_status' => $displayStatus, // For filtering: Requesting, Accepted, Rejected, Cancelled
                        'state' => $appointment->state ?? 'active', // Appointment state: active, cancelled
                        'created_at' => $appointment->created_at->toDateTimeString(),
                        'order' => $order ? [
                            'id' => $order->id,
                            'status' => $orderStatus,
                            'handled' => $handled,
                            'queue_number' => $order->queue_number,
                            'scheduled_at' => $order->scheduled_at,
                            'completed_at' => $order->completed_at,
                            'total_amount' => $order->total_amount,
                            'check_appointment_date' => $order->check_appointment_date,
                            'check_appointment_time' => $order->check_appointment_time,
                            'pickup_appointment_date' => $order->pickup_appointment_date,
                            'pickup_appointment_time' => $order->pickup_appointment_time,
                        ] : null,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $appointments
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching user appointments', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch appointments',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function cancelAppointment(Request $request, $id)
    {
        try {
            $userId = $request->user()->id;
            $appointment = Appointment::with('order')->findOrFail($id);

            // Verify the appointment belongs to the authenticated user
            if ($appointment->user_id !== $userId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            // Only allow cancellation if:
            // - Appointment status is 'pending' (Requesting)
            // - OR if order exists: Order status is 'Pending' AND Order handled is 0 (false)
            $order = $appointment->order;
            
            if ($appointment->status !== 'pending') {
                // If appointment is accepted, check order status
                if (!$order) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Only pending appointments can be cancelled'
                    ], 400);
                }
                
                if ($order->status !== 'Pending') {
                    return response()->json([
                        'success' => false,
                        'message' => 'Only pending orders can be cancelled'
                    ], 400);
                }
                
                if ($order->handled) {
                    return response()->json([
                        'success' => false,
                        'message' => 'This order has already been handled and cannot be cancelled'
                    ], 400);
                }
            }

            // Store user_id and user info before deletion for notifications
            $appointmentUserId = $appointment->user_id;
            $appointment->load('user'); // Load user relationship to get customer name
            $customerName = $appointment->user->name ?? 'Customer';
            
            // Determine if this is a booking appointment or an order
            // Booking appointment: status is 'pending' and no order exists (not accepted by admin yet)
            // Order: order exists and order status is 'Pending' (accepted by admin, order created)
            $isBookingAppointment = $appointment->status === 'pending' && !$order;
            $isOrder = $order && $order->status === 'Pending';
            
            // Create admin notification BEFORE deletion
            try {
                // Determine notification message based on what was cancelled
                if ($isBookingAppointment) {
                    $notificationTitle = $customerName . ' cancelled a booking appointment';
                    $cancellationType = 'booking_appointment';
                } elseif ($isOrder) {
                    $notificationTitle = $customerName . ' cancelled an order';
                    $cancellationType = 'order';
                } else {
                    // Fallback case (shouldn't happen based on validation, but handle gracefully)
                    $notificationTitle = $customerName . ' cancelled an appointment';
                    $cancellationType = 'appointment';
                }
                
                \DB::statement('SET FOREIGN_KEY_CHECKS=0');
                \DB::table('notifications')->insert([
                    'user_id' => 0,
                    'type' => 'customer_appointment_updated',
                    'title' => $notificationTitle,
                    'body' => null,
                    'data' => json_encode([
                        'appointment_id' => $appointment->id,
                        'customer_name' => $customerName,
                        'customer_user_id' => $appointmentUserId,
                        'cancellation_type' => $cancellationType,
                        'cancelled_at' => now()->toDateTimeString(),
                    ]),
                    'is_viewed' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                \DB::statement('SET FOREIGN_KEY_CHECKS=1');
            } catch (\Exception $adminNotifError) {
                \DB::statement('SET FOREIGN_KEY_CHECKS=1');
                \Log::error('Failed to create admin cancellation notification', [
                    'error' => $adminNotifError->getMessage(),
                    'appointment_id' => $id,
                    'customer_user_id' => $appointmentUserId
                ]);
                // Don't fail the request if admin notification creation fails
            }

            // Update appointment state to 'cancelled' instead of deleting
            $appointment->state = 'cancelled';
            $appointment->save();

            // If order exists, set its status to 'Cancelled' instead of deleting
            if ($order) {
                $order->status = 'Cancelled';
                $order->save();
            }

            // Create notification for the user
            try {
                Notification::create([
                    'user_id' => $appointmentUserId,
                    'type' => 'order_cancelled',
                    'title' => 'You have successfully cancelled an order!',
                    'body' => null,
                    'data' => [
                        'appointment_id' => $id,
                        'cancelled_at' => now()->toDateTimeString(),
                    ],
                ]);
            } catch (\Exception $notifError) {
                \Log::error('Failed to create cancellation notification', [
                    'error' => $notifError->getMessage(),
                    'user_id' => $appointmentUserId,
                    'appointment_id' => $id
                ]);
                // Don't fail the request if notification creation fails
            }

            return response()->json([
                'success' => true,
                'message' => 'Appointment and order cancelled successfully'
            ]);
        } catch (\Exception $e) {
            \Log::error('Error cancelling appointment', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to cancel appointment',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function adminRefundAppointment(Request $request, $id)
    {
        try {
            // Validate refund image is required
            $validated = $request->validate([
                'refund_image' => 'required|file|image|max:5120',
            ]);

            $appointment = Appointment::with('order', 'user')->findOrFail($id);

            // Check if appointment is cancelled
            if ($appointment->state !== 'cancelled') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only cancelled appointments can be refunded'
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
                'appointment_id' => $id
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to process refund',
                'error' => $e->getMessage()
            ], 500);
        }
    }

}
