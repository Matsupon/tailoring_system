<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ServiceType;
use Illuminate\Validation\ValidationException;

class ServiceTypeController extends Controller
{
    public function index()
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

    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:service_types,name',
                'downpayment_amount' => 'required|numeric|min:0',
            ]);

            $serviceType = ServiceType::create([
                'name' => $validated['name'],
                'downpayment_amount' => $validated['downpayment_amount'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Service type created successfully',
                'data' => $serviceType
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error creating service type', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to create service type',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function show($id)
    {
        try {
            $serviceType = ServiceType::findOrFail($id);
            
            return response()->json([
                'success' => true,
                'data' => $serviceType
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Service type not found',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $serviceType = ServiceType::findOrFail($id);
            
            $validated = $request->validate([
                'name' => 'sometimes|string|max:255|unique:service_types,name,' . $id,
                'downpayment_amount' => 'sometimes|numeric|min:0',
            ]);

            $serviceType->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Service type updated successfully',
                'data' => $serviceType->fresh()
            ], 200);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error updating service type', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update service type',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $serviceType = ServiceType::findOrFail($id);
            
            // Check if service type is being used in appointments
            $appointmentCount = \App\Models\Appointment::where('service_type', $serviceType->name)->count();
            
            if ($appointmentCount > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete service type. It is being used in ' . $appointmentCount . ' appointment(s).'
                ], 422);
            }
            
            $serviceType->delete();

            return response()->json([
                'success' => true,
                'message' => 'Service type deleted successfully'
            ], 200);
        } catch (\Exception $e) {
            \Log::error('Error deleting service type', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete service type',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}