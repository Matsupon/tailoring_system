    <?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminAuthController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\ServiceTypeController;

Route::get('/test', function () {
    return response()->json(['message' => 'API is working!', 'timestamp' => now()]);
});

// Test authenticated endpoint (no file upload)
Route::middleware('auth:sanctum')->post('/test-auth', function (Request $request) {
    \Log::info('=== TEST AUTH ENDPOINT HIT ===', [
        'method' => $request->method(),
        'ip' => $request->ip(),
        'user_id' => auth()->id(),
        'has_token' => $request->bearerToken() ? 'yes' : 'no',
    ]);
    return response()->json([
        'message' => 'Authenticated endpoint works!',
        'user_id' => auth()->id(),
        'timestamp' => now(),
    ]);
});


Route::get('/test-appointments', function () {
    return response()->json([
        'message' => 'Appointments endpoint is accessible!',
        'timestamp' => now(),
        'auth_required' => true
    ]);
});

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/admin/login', [AdminAuthController::class, 'login']);

// Public endpoint for fetching service types (no auth required)
Route::get('/service-types', [ServiceTypeController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
        Route::get('/user', [AuthController::class, 'user']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/profile', [ProfileController::class, 'update']);
        
        // Admin profile endpoints (admin only)
        Route::patch('/admin/profile', [AdminController::class, 'update']);
        Route::get('/admin/profile', [AdminController::class, 'me']);
        Route::post('/admin/profile/photo', [AdminController::class, 'uploadProfilePhoto']);
        
        // Public endpoint for customers to get admin contact info
        Route::get('/admin/contact', [AdminController::class, 'getContactInfo']);

    Route::get('/appointments/test', [AppointmentController::class, 'test']);
    
    Route::get('/appointments/test-next', [AppointmentController::class, 'getNextAppointmentByOrderStatus']);

    //customer side appointments
    Route::post('/appointments', [AppointmentController::class, 'store']); 
    Route::get('/appointments/available-slots', [AppointmentController::class, 'getAvailableSlots']);
    Route::get('/me/orders/latest', [OrderController::class, 'myLatest']);
    Route::get('/me/orders', [OrderController::class, 'myOrders']);
    Route::get('/me/orders/history', [OrderController::class, 'myHistory']);
    Route::get('/appointments/next-appointment', [AppointmentController::class, 'getNextAppointmentByOrderStatus']);
    Route::get('/appointments/next', [AppointmentController::class, 'getNextAppointment']);
    Route::patch('/appointments/update-order-details', [AppointmentController::class, 'updateOrderDetails']);
    Route::patch('/appointments/update-appointment-details', [AppointmentController::class, 'updateAppointmentDetails']);
    Route::get('/me/appointments', [AppointmentController::class, 'myAppointments']);
    Route::delete('/appointments/{id}/cancel', [AppointmentController::class, 'cancelAppointment']);

    // Customers
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::get('/customers/{id}', [CustomerController::class, 'show']);


    //admin side appointments
    Route::get('/appointments', [AppointmentController::class, 'index']); 
    Route::get('/admin/appointments', [AppointmentController::class, 'adminGetAllAppointments']); 
    Route::get('/admin/appointments/accepted', [AppointmentController::class, 'adminGetAcceptedAppointments']); 
    Route::get('/admin/appointments/{id}', [AppointmentController::class, 'adminGetAppointmentById']); 
    Route::delete('/appointments/{id}', [AppointmentController::class, 'destroy']);
    Route::post('/admin/appointments/{id}/reject', [AppointmentController::class, 'adminRejectAppointment']);
    Route::post('/admin/appointments/{id}/refund', [AppointmentController::class, 'adminRefundAppointment']); 

    // Orders
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/history', [OrderController::class, 'history']); 
    Route::post('/orders/{appointmentId}', [OrderController::class, 'store']);
    Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus']);
    Route::patch('/orders/{orderId}/handled', [OrderController::class, 'toggleHandled']);
    Route::patch('/orders/{order}/sizes-quantity', [OrderController::class, 'updateSizesQuantity']);
    Route::post('/admin/orders/{orderId}/refund', [OrderController::class, 'adminRefundOrder']);
    Route::get('/orders/booked-times', [OrderController::class, 'getBookedTimes']);
    Route::get('/orders/stats', [OrderController::class, 'getOrderStats']);
    Route::get('/orders/today-queue', [OrderController::class, 'getTodayQueue']);
    Route::get('/orders/today-appointments-count', [OrderController::class, 'getTodayAppointmentsCount']);
    
    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    // Admin: appointment new-items counter and view tracking
    Route::get('/notifications/appointments/unviewed-count', [NotificationController::class, 'countUnviewedAppointments']);
    Route::patch('/notifications/appointments/{appointmentId}/viewed', [NotificationController::class, 'markAppointmentAsViewed']);
    Route::get('/notifications/appointments/view-states', [NotificationController::class, 'getAppointmentViewStates']);
    // Update old appointment_booked notifications
    Route::post('/notifications/update-appointment-booked', [NotificationController::class, 'updateAppointmentBookedNotifications']);
    // Admin notifications for customer appointment updates
    Route::get('/admin/notifications', [NotificationController::class, 'adminIndex']);
    Route::get('/admin/notifications/unviewed-count', [NotificationController::class, 'adminUnviewedCount']);
    Route::patch('/admin/notifications/{id}/viewed', [NotificationController::class, 'markAdminNotificationAsViewed']);

    //Admin DASHBOARD
    Route::get('/orders/today-appointments-count', [OrderController::class, 'getTodayAppointmentsCount']);
    Route::get('/orders/today-queue', [OrderController::class, 'getTodayQueue']);
    Route::get('/dashboard-data', [OrderController::class, 'dashboardData']);
    Route::post('/orders/recalculate-queue', [OrderController::class, 'recalculateQueueNumbers']);

    // Feedback
    // Customer
    Route::get('/feedback/my-pending', [FeedbackController::class, 'myPending']);
    Route::post('/feedback', [FeedbackController::class, 'store']);
    // Admin
    Route::get('/feedback', [FeedbackController::class, 'index']);
    Route::patch('/feedback/{feedback}/respond', [FeedbackController::class, 'respond']);
    Route::delete('/feedback/{feedback}', [FeedbackController::class, 'destroy']);

    // Service Types (Admin only)
    Route::post('/service-types', [ServiceTypeController::class, 'store']);
    Route::get('/service-types/{id}', [ServiceTypeController::class, 'show']);
    Route::put('/service-types/{id}', [ServiceTypeController::class, 'update']);
    Route::delete('/service-types/{id}', [ServiceTypeController::class, 'destroy']);

});
