<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Feedback;
use App\Models\Order;
use App\Models\Notification;

class FeedbackController extends Controller
{
    // Customer: create feedback for finished order
    public function store(Request $request)
    {
        $validated = $request->validate([
            'order_id' => 'required|exists:orders,id',
            'rating'   => 'required|integer|min:1|max:5',
            'comment'  => 'nullable|string',
        ]);

        $userId = $request->user()->id;

        $order = Order::with('appointment')
            ->where('id', $validated['order_id'])
            ->whereHas('appointment', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            })
            ->firstOrFail();

        if ($order->status !== 'Finished') {
            return response()->json([
                'success' => false,
                'message' => 'Feedback can only be submitted for finished orders.'
            ], 422);
        }

        $existing = Feedback::where('order_id', $order->id)->where('user_id', $userId)->first();
        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'Feedback already exists for this order.'
            ], 409);
        }

        $feedback = Feedback::create([
            'order_id' => $order->id,
            'user_id'  => $userId,
            'rating'   => $validated['rating'],
            'comment'  => $validated['comment'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'data'    => $feedback,
        ]);
    }

    // Admin: list all feedback with order and user
    public function index()
    {
        $list = Feedback::with(['order.appointment.user'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $list,
        ]);
    }

    // Admin: respond or check feedback
    public function respond(Request $request, Feedback $feedback)
    {
        $validated = $request->validate([
            'admin_response' => 'nullable|string',
            'admin_checked'  => 'nullable|boolean',
        ]);

        if (array_key_exists('admin_response', $validated)) {
            $feedback->admin_response = $validated['admin_response'];
            $feedback->responded_at = now();
        }
        if (array_key_exists('admin_checked', $validated)) {
            $feedback->admin_checked = (bool)$validated['admin_checked'];
            if ($feedback->admin_checked && empty($feedback->responded_at)) {
                $feedback->responded_at = now();
            }
        }
        $feedback->save();

        // Send a notification to the feedback owner (order user)
        try {
            $order = $feedback->order()->with('appointment')->first();
            $userId = optional($order->appointment)->user_id;
            if ($userId) {
                $hasResponse = !empty($feedback->admin_response);
                $title = $hasResponse ? 'Admin responded to your feedback' : 'Admin checked your feedback';
                $body  = $hasResponse ? $feedback->admin_response : null;
                Notification::create([
                    'user_id' => $userId,
                    'type'    => 'feedback_responded',
                    'title'   => $title,
                    'body'    => $body,
                    'data'    => [
                        'feedback_id'   => $feedback->id,
                        'order_id'      => $feedback->order_id,
                        'admin_checked' => (bool)$feedback->admin_checked,
                        'admin_response'=> $feedback->admin_response,
                        'responded_at'  => optional($feedback->responded_at)->toIso8601String(),
                    ],
                ]);
            }
        } catch (\Exception $e) {
            \Log::error('Failed to create feedback response notification', [
                'error' => $e->getMessage(),
                'feedback_id' => $feedback->id,
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $feedback->fresh(['order.appointment.user'])
        ]);
    }

    // Customer: get most recent finished order without feedback
    public function myPending(Request $request)
    {
        $userId = $request->user()->id;

        $order = Order::with('appointment')
            ->where('status', 'Finished')
            ->whereHas('appointment', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            })
            ->whereDoesntHave('feedback')
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$order) {
            return response()->json(['success' => true, 'data' => null]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'order_id' => $order->id,
                'service_type' => optional($order->appointment)->service_type,
                'completed_at' => $order->completed_at,
            ]
        ]);
    }

    // Admin: delete feedback
    public function destroy(Feedback $feedback)
    {
        try {
            $feedback->delete();
            
            return response()->json([
                'success' => true,
                'message' => 'Feedback deleted successfully'
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to delete feedback', [
                'error' => $e->getMessage(),
                'feedback_id' => $feedback->id,
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete feedback'
            ], 500);
        }
    }
}
