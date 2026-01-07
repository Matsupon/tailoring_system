<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        Log::info('✅ Received updateProfile request', [
            'method' => $request->method(),
            'content_type' => $request->header('Content-Type'),
            'has_file' => $request->hasFile('profile_image'),
            'user_id' => $request->user()?->id,
            'all_files' => array_keys($request->allFiles()),
        ]);

        try {
            $user = $request->user();
            
            if (!$user) {
                Log::error('❌ No authenticated user');
                return response()->json([
                    'message' => 'Unauthorized',
                    'error' => 'User not authenticated'
                ], 401);
            }

            // Normalize possible alternate file field names to 'profile_image'
            if (!$request->hasFile('profile_image')) {
                foreach (['image', 'avatar', 'file', 'photo'] as $alt) {
                    if ($request->hasFile($alt)) {
                        $request->files->set('profile_image', $request->file($alt));
                        break;
                    }
                }
            }

            // Validate request data
            $validated = $request->validate([
                'profile_image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:5120', // Increased to 5MB
                'name'   => 'sometimes|string|max:255',
                'email'  => 'sometimes|email|max:255|unique:users,email,' . $user->id,
                'phone'  => 'sometimes|string|max:20',
                'address'=> 'sometimes|string|max:255',
                'password' => 'sometimes|string|min:6',
            ]);

            Log::info('✅ Validation passed', [
                'validated_fields' => array_keys($validated),
                'has_profile_image' => isset($validated['profile_image']),
            ]);

            $dirty = false;
            
            // Update text fields
            $fields = ['name', 'email', 'phone', 'address'];
            foreach ($fields as $field) {
                if ($request->filled($field)) {
                    $user->{$field} = $validated[$field];
                    $dirty = true;
                    Log::info("✅ Updated field: {$field}", ['value' => $validated[$field]]);
                }
            }
            
            // Update password if provided
            if ($request->filled('password')) {
                $user->password = bcrypt($validated['password']);
                $dirty = true;
                Log::info('✅ Password updated');
            }

            // Handle profile image upload
            if ($request->hasFile('profile_image')) {
                $file = $request->file('profile_image');
                
                Log::info('✅ Processing profile image upload', [
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getClientMimeType(),
                    'size' => $file->getSize(),
                    'extension' => $file->getClientOriginalExtension(),
                    'is_valid' => $file->isValid(),
                ]);

                // Check if file is valid
                if (!$file->isValid()) {
                    Log::error('❌ Invalid file uploaded', [
                        'error' => $file->getError(),
                        'error_message' => $file->getErrorMessage(),
                    ]);
                    return response()->json([
                        'message' => 'Invalid file uploaded',
                        'error' => $file->getErrorMessage()
                    ], 422);
                }

                // Delete old profile image if exists
                if ($user->profile_image && Storage::disk('public')->exists($user->profile_image)) {
                    try {
                        Storage::disk('public')->delete($user->profile_image);
                        Log::info('🗑️ Deleted old profile image', ['path' => $user->profile_image]);
                    } catch (\Exception $e) {
                        Log::warning('⚠️ Failed to delete old image', [
                            'path' => $user->profile_image,
                            'error' => $e->getMessage()
                        ]);
                        // Continue anyway - not critical
                    }
                }

                // Store new profile image
                try {
                    $filename = 'profile_' . $user->id . '_' . time() . '.' . $file->getClientOriginalExtension();
                    $path = $file->storeAs('profile_images', $filename, 'public');
                    
                    if (!$path) {
                        throw new \Exception('Failed to store file');
                    }
                    
                    $user->profile_image = $path;
                    $dirty = true;
                    
                    Log::info('✅ Profile image stored successfully', [
                        'path' => $path,
                        'full_path' => Storage::disk('public')->path($path),
                    ]);
                } catch (\Exception $e) {
                    Log::error('❌ Failed to store profile image', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                    return response()->json([
                        'message' => 'Failed to upload profile image',
                        'error' => $e->getMessage()
                    ], 500);
                }
            }

            // Save user if any changes were made
            if ($dirty) {
                $user->save();
                Log::info('✅ User profile saved successfully', ['user_id' => $user->id]);
            } else {
                Log::info('ℹ️ No changes detected, skipping save');
            }

            // Build image URL
            $imageUrl = null;
            if ($user->profile_image) {
                $imageUrl = asset('storage/' . $user->profile_image);
                Log::info('✅ Generated image URL', ['url' => $imageUrl]);
            }

            return response()->json([
                'message' => 'Profile updated successfully.',
                'user' => $user->fresh(),
                'image_url' => $imageUrl,
            ], 200);

        } catch (ValidationException $e) {
            Log::error('❌ Validation failed', [
                'errors' => $e->errors(),
                'message' => $e->getMessage(),
            ]);
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('❌ Profile update failed', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Profile update failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
