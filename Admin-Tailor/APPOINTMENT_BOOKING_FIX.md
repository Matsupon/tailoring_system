# Appointment Booking Fix - Summary

## Issues Fixed

### 1. **Critical: API Routes Not Loaded** ✅
**Problem**: The `api.php` routes file was not being registered in Laravel's bootstrap configuration, causing all API endpoints (including `/api/appointments`) to return 404 errors.

**Fix**: Added `api: __DIR__.'/../routes/api.php'` to `BACKEND/bootstrap/app.php`

**File**: `BACKEND/bootstrap/app.php`

### 2. **API URL Mismatch** ✅
**Problem**: Backend was configured for `192.168.10.87` but mobile app was using `192.168.137.223`

**Fix**: Updated backend `.env` file to match mobile app configuration

**Files Modified**:
- `BACKEND/.env` - Updated `APP_URL`, `SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN`, and `VITE_API_URL`

### 3. **Model Casting Issue** ✅
**Problem**: The `Appointment` model was casting `sizes` to array and `appointment_time` to datetime, which could conflict with the controller expecting JSON string and time validation

**Fix**: Removed unnecessary casts from the model - Laravel will handle these appropriately

**File**: `BACKEND/app/Models/Appointment.php`

---

## Setup Instructions

### Step 1: Start WAMP Server
1. Open WAMP Control Panel
2. Make sure all services (Apache, MySQL, PHP) are running (green icon)
3. Verify MySQL is accessible at `127.0.0.1:3306`

### Step 2: Start Laravel Backend
Open PowerShell in the BACKEND directory and run:

```powershell
cd C:\wamp64\www\Admin-Tailor\BACKEND
php artisan serve --host=192.168.137.223 --port=8000
```

**Important**: Make sure the IP address matches your network configuration. You can find your IP with:
```powershell
ipconfig
```
Look for "Wireless LAN adapter Wi-Fi" -> "IPv4 Address"

### Step 3: Run Migrations (if needed)
If the database tables don't exist or need updating:

```powershell
cd C:\wamp64\www\Admin-Tailor\BACKEND
php artisan migrate
```

### Step 4: Check Storage Permissions
Make sure the storage directory is writable (for file uploads):

```powershell
cd C:\wamp64\www\Admin-Tailor\BACKEND
php artisan storage:link
```

### Step 5: Clear Laravel Caches
Clear all Laravel caches to ensure the configuration changes take effect:

```powershell
cd C:\wamp64\www\Admin-Tailor\BACKEND
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
```

### Step 6: Start Mobile App
In a new terminal:

```powershell
cd "C:\wamp64\www\Admin-Tailor\mobile uploads"
npx expo start
```

---

## Testing the Fix

### Test 1: Verify API Endpoint is Accessible

Using PowerShell:
```powershell
curl http://192.168.137.223:8000/api/test
```

Expected response:
```json
{
  "message": "API is working!",
  "timestamp": "2025-11-09T..."
}
```

### Test 2: Test Appointment Booking Endpoint (Requires Auth Token)

First, login and get a token, then test the appointments endpoint:

```powershell
# Login first (replace with actual credentials)
$loginResponse = Invoke-RestMethod -Uri "http://192.168.137.223:8000/api/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"user@example.com","password":"password"}'

$token = $loginResponse.token

# Test appointments test endpoint
Invoke-RestMethod -Uri "http://192.168.137.223:8000/api/appointments/test" `
  -Method GET `
  -Headers @{"Authorization"="Bearer $token"}
```

### Test 3: Test Available Slots Endpoint

```powershell
Invoke-RestMethod -Uri "http://192.168.137.223:8000/api/appointments/available-slots?date=2025-11-10" `
  -Method GET `
  -Headers @{"Authorization"="Bearer $token"}
```

Expected response:
```json
{
  "available_slots": ["08:00", "08:30", "09:00", ...]
}
```

### Test 4: Test Full Appointment Booking from Mobile App

1. Open the mobile app
2. Login with valid credentials
3. Navigate to "Book Appointment"
4. Fill in all required fields:
   - Select service type
   - Select sizes and quantities
   - Upload design image (optional)
   - Upload GCash proof (required)
   - Select preferred due date
   - Select appointment date and time
5. Click "Book an Appointment"
6. Should see success message

---

## Troubleshooting

### Issue: "Network Error" in Mobile App

**Check:**
1. Is Laravel server running? `php artisan serve --host=192.168.137.223 --port=8000`
2. Can you access `http://192.168.137.223:8000/api/test` from browser?
3. Are mobile device and computer on same network?
4. Is Windows Firewall blocking port 8000?

**Test firewall:**
```powershell
New-NetFirewallRule -DisplayName "Laravel Dev Server" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

### Issue: "401 Unauthorized"

**Check:**
1. Is the user logged in?
2. Is the auth token valid?
3. Check AsyncStorage for token:
   ```javascript
   const token = await AsyncStorage.getItem('authToken');
   console.log('Token:', token);
   ```

### Issue: "422 Validation Error"

**Check:**
1. Are all required fields filled?
2. Is the GCash proof image uploaded?
3. Is the appointment date in the future?
4. Is the appointment time in correct format (HH:mm)?
5. Check Laravel logs: `BACKEND/storage/logs/laravel.log`

### Issue: File Upload Fails

**Check:**
1. Is `storage/app/public` directory writable?
2. Has `php artisan storage:link` been run?
3. Check file size limits in `php.ini`:
   - `upload_max_filesize = 10M`
   - `post_max_size = 10M`
4. Check Laravel file size validation (currently 5120KB = 5MB max)

### Issue: "This time slot is already taken"

This means another appointment exists for that date/time. Try:
1. Select a different time slot
2. Check available slots endpoint to see what's free

### Issue: Database Connection Failed

**Check:**
1. Is MySQL running in WAMP?
2. Check `.env` database credentials:
   ```
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=tailoringSystem
   DB_USERNAME=root
   DB_PASSWORD=
   ```
3. Test database connection:
   ```powershell
   cd C:\wamp64\www\Admin-Tailor\BACKEND
   php artisan tinker
   DB::connection()->getPdo();
   ```

---

## Monitoring and Logs

### View Laravel Logs
```powershell
Get-Content "C:\wamp64\www\Admin-Tailor\BACKEND\storage\logs\laravel.log" -Tail 50 -Wait
```

### View Real-time Laravel Logs
```powershell
cd C:\wamp64\www\Admin-Tailor\BACKEND
php artisan serve --host=192.168.137.223 --port=8000 | Tee-Object -FilePath "server.log"
```

### Enable Debug Mode
In `BACKEND/.env`:
```
APP_DEBUG=true
LOG_LEVEL=debug
```

---

## Key Configuration Files

### Backend Configuration
- **Routes**: `BACKEND/routes/api.php`
- **Controller**: `BACKEND/app/Http/Controllers/AppointmentController.php`
- **Model**: `BACKEND/app/Models/Appointment.php`
- **Environment**: `BACKEND/.env`
- **CORS**: `BACKEND/config/cors.php`
- **Bootstrap**: `BACKEND/bootstrap/app.php`

### Mobile App Configuration
- **Component**: `mobile uploads/components/BookAppointment.jsx`
- **API Client**: `mobile uploads/utils/api.js`
- **Environment**: `mobile uploads/.env`

---

## API Endpoints Reference

### Public Endpoints
- `GET /api/test` - Test API connectivity

### Protected Endpoints (require auth token)
- `POST /api/appointments` - Create new appointment
- `GET /api/appointments/available-slots?date=YYYY-MM-DD` - Get available time slots
- `GET /api/appointments/test` - Test appointments controller
- `GET /api/me/appointments` - Get user's appointments
- `DELETE /api/appointments/{id}/cancel` - Cancel appointment

---

## Expected Request Format for POST /api/appointments

```javascript
FormData:
- service_type: string (required)
- sizes: string (JSON, required) - e.g. '{"Small":2,"Medium":3}'
- total_quantity: integer (required)
- notes: string (nullable)
- design_image: file (image, max 5MB, optional)
- gcash_proof: file (image, max 5MB, required)
- preferred_due_date: date (YYYY-MM-DD, required)
- appointment_date: date (YYYY-MM-DD, required, must be today or future)
- appointment_time: time (HH:mm, required, e.g. "14:30")
```

---

## Summary of Changes Made

1. ✅ Added API routes to Laravel bootstrap (`bootstrap/app.php`)
2. ✅ Fixed API URL mismatch in backend `.env`
3. ✅ Removed problematic casts from Appointment model
4. ✅ Verified CORS configuration
5. ✅ Verified route definitions in `routes/api.php`
6. ✅ Verified controller logic in `AppointmentController.php`

The appointment booking should now work correctly! If you still encounter issues, follow the troubleshooting steps above and check the Laravel logs for specific error messages.
