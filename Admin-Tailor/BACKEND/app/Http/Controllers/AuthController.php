<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        \Log::info('Hit register route');
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'phone' => 'required|string|max:20',
            'password' => 'required|string|min:6',
            'address' => 'required|string|max:255',
        ]);
    
        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'],
            'password' => Hash::make($validated['password']),
            'address' => $validated['address'],
        ]);
    
        $token = $user->createToken('mobile')->plainTextToken;
    
        return response()->json([
            'message' => 'User registered successfully!',
            'user' => $user,
            'access_token' => $token,
        ], 201);
    }

    public function login(Request $request) {
        $user = User::where('email', $request->email)->first();
        if (! $user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }
        return response()->json(['access_token' => $user->createToken('mobile')->plainTextToken]);
    }

    public function user(Request $request) {
        $user = $request->user();
        $user->image_url = $user->profile_image 
            ? asset('storage/' . $user->profile_image) 
            : null;
    
        return response()->json(['user' => $user]);
    }

    public function logout(Request $request) {
        $request->user()->tokens()->delete();
        return response()->json(['message' => 'Logged out']);
    }
}
