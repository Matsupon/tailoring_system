# Admin-Tailor Local Development & Refund Fix Summary

## Changes Made

### 1. Local Development Configuration ✅

**File: `src/api.js`**
- Changed API base URL from `/api` to `http://192.168.10.87:8000/api`
- Fixed FormData upload issue by removing Content-Type header for file uploads
- Added proper 401 error handling with token cleanup
- Enhanced error logging for better debugging

**File: `BACKEND/.env`**
- Added localhost:3000 to SANCTUM_STATEFUL_DOMAINS for React dev server

### 2. Refund Issue Fix ✅

**File: `BACKEND/app/Http/Controllers/OrderController.php`**
- **Problem**: `history()` function was showing all finished orders, including refunded ones
- **Fix**: Added `whereNull('refund_image')` filter to exclude refunded orders
- **Result**: Refunded orders no longer appear in Orders History page

**Before:**
```php
$orders = Order::with(['appointment.user', 'feedback'])
    ->where('status', 'Finished')
    ->orderBy('created_at', 'desc')
    ->get()
```

**After:**
```php
$orders = Order::with(['appointment.user', 'feedback'])
    ->where('status', 'Finished')
    ->whereHas('appointment', function($q) {
        // Exclude orders whose appointments have been refunded
        $q->whereNull('refund_image');
    })
    ->orderBy('created_at', 'desc')
    ->get()
```

### 3. Development Tools Created ✅

**Files Created:**
- `start-local-dev.bat` - Quick start script for development server
- `clean-build.bat` - Cleanup script for build artifacts
- `test-api-connection.html` - API connectivity testing tool
- `README-LOCAL-SETUP.md` - Comprehensive setup guide
- `CHANGES-SUMMARY.md` - This summary file

## How the Refund System Works Now

### Frontend (Orders.jsx & Appointments.jsx)
1. User clicks "Refund" button on cancelled order/appointment
2. Modal opens requiring GCash refund image upload
3. Image is sent to backend via FormData
4. On success, item is removed from frontend list immediately

### Backend (OrderController.php & AppointmentController.php)
1. Validates refund image upload
2. Stores image in `storage/refunds/` directory
3. Updates appointment record with `refund_image` path
4. Creates notification for customer
5. Order/appointment is now filtered out of all future API responses

### Database Impact
- `appointments.refund_image` field stores the refund proof image path
- Orders with `refund_image` are excluded from:
  - Orders list (`/api/orders`)
  - Orders history (`/api/orders/history`)
  - Appointments list (already filtered)

## Troubleshooting Common Issues

### 422 Error on File Uploads (Fixed) ✅
**Problem**: Getting 422 validation errors when uploading refund images
**Cause**: Default `Content-Type: application/json` header conflicts with FormData
**Solution**: API interceptor now automatically removes Content-Type for FormData uploads

### API Connection Issues
**Problem**: Cannot connect to Laravel backend
**Solutions**:
1. Verify Laravel is running on `http://192.168.10.87:8000`
2. Check Laravel logs: `tail -f storage/logs/laravel.log`
3. Test with `test-api-connection.html`
4. Verify CORS configuration allows localhost:3000

### Authentication Issues
**Problem**: Getting 401 unauthorized errors
**Solutions**:
1. Check if admin token exists in localStorage
2. Try logging out and logging back in
3. Verify token is being sent in Authorization header

## Testing the Fix
```bash
cd Admin-Tailor
clean-build.bat
npm install
npm start
```

### 2. Test Refund Functionality
1. Go to Orders page
2. Find a cancelled order
3. Click "Refund" button
4. Upload a GCash image
5. Confirm refund
6. **Expected Result**: Order disappears from Orders page
7. Check Orders History page
8. **Expected Result**: Order does not appear in history

### 3. Verify API Connection
- Open `test-api-connection.html` in browser
- Click "Test Basic Connection"
- Should show successful connection to Laravel backend

## Important Notes

- **Backend must be running** on `http://192.168.10.87:8000`
- **Database must be accessible** with proper migrations
- **Storage symlink must exist** for image uploads
- **CORS must allow** localhost:3000 requests

## Rollback Instructions

If you need to revert to production configuration:

**File: `src/api.js`**
```javascript
const baseURL = "/api"; // Change back from full URL
```

**File: `BACKEND/.env`**
```
SANCTUM_STATEFUL_DOMAINS=192.168.10.87:8081,192.168.10.87:19000
# Remove localhost:3000
```