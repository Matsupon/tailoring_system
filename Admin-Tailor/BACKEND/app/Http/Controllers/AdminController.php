<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function update(Request $request)
    {
        $admin = $request->user();

        if (! $admin || !($admin instanceof \App\Models\Admin)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'fullname' => ['required', 'string', 'max:255', Rule::unique('admins', 'fullname')->ignore($admin->id)],
            'email' => ['required', 'email', 'max:255', Rule::unique('admins', 'email')->ignore($admin->id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'min:6'],
        ]);

        $admin->fullname = $validated['fullname'];
        $admin->email = $validated['email'];
        $admin->phone = $validated['phone'] ?? null;
        $admin->address = $validated['address'] ?? null;

        if (!empty($validated['password'])) {
            $admin->password = Hash::make($validated['password']);
        }

        $admin->save();

        return response()->json([
            'message' => 'Profile updated successfully',
            'admin' => [
                'id' => $admin->id,
                'fullname' => $admin->fullname,
                'email' => $admin->email,
                'phone' => $admin->phone,
                'address' => $admin->address,
                'profile_image' => $admin->profile_image,
                'profile_image_url' => $admin->profile_image ? asset('storage/' . $admin->profile_image) : null,
            ],
        ]);
    }

    public function me(Request $request)
    {
        $admin = $request->user();

        if (! $admin || !($admin instanceof \App\Models\Admin)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json([
            'admin' => [
                'id' => $admin->id,
                'fullname' => $admin->fullname,
                'email' => $admin->email,
                'phone' => $admin->phone,
                'address' => $admin->address,
                'profile_image' => $admin->profile_image,
                'profile_image_url' => $admin->profile_image ? asset('storage/' . $admin->profile_image) : null,
            ],
        ]);
    }

    /**
     * Get admin contact information (public endpoint for customers)
     * Customers need this for payment instructions
     */
    public function getContactInfo()
    {
        // Get the first admin (or you could get a specific admin)
        $admin = \App\Models\Admin::first();

        if (!$admin) {
            return response()->json([
                'success' => false,
                'message' => 'Admin contact information not available'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'phone' => $admin->phone ?? '0912 345 6789',
                'email' => $admin->email ?? null,
                'address' => $admin->address ?? null,
            ],
        ]);
    }

    public function uploadProfilePhoto(Request $request)
    {
        $admin = $request->user();
        if (! $admin || !($admin instanceof \App\Models\Admin)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'photo' => ['required','image','mimes:jpeg,png,jpg,webp','max:5120'], // 5MB
        ]);

        $path = $request->file('photo')->store('admin_profiles', 'public');

        $admin->profile_image = $path;
        $admin->save();

        return response()->json([
            'message' => 'Profile photo updated',
            'admin' => [
                'id' => $admin->id,
                'fullname' => $admin->fullname,
                'email' => $admin->email,
                'phone' => $admin->phone,
                'address' => $admin->address,
                'profile_image' => $admin->profile_image,
                'profile_image_url' => asset('storage/' . $admin->profile_image),
            ]
        ]);
    }
}
