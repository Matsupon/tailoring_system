# Admin-Tailor Local Development Setup

## Prerequisites
- Node.js installed
- Laravel backend running on http://192.168.10.87:8000

## Quick Start

1. **Clean build artifacts** (first time only):
   ```bash
   clean-build.bat
   ```

2. **Install dependencies** (first time only):
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```
   Or double-click `start-local-dev.bat`

4. **Open your browser** to:
   ```
   http://localhost:3000
   ```

## Configuration

The app is configured to connect to your Laravel backend at:
```
http://192.168.10.87:8000/api
```

## Recent Fixes

### Refund Issue Fixed ✅
- **Problem**: Refunded orders were still appearing in Orders History page
- **Solution**: Updated backend to exclude refunded orders from history endpoint
- **Result**: Refunded orders now properly disappear from both Orders page and Orders History page

### Local Development Setup ✅
- **Problem**: App was configured for production deployment
- **Solution**: Updated API base URL to point to local Laravel server
- **Result**: App now works with local Laravel backend on port 8000

## Backend Requirements

Make sure your Laravel backend is running with:
- Database connection working
- Storage symlink created
- CORS configured to allow localhost:3000

## Testing

Use `test-api-connection.html` to verify:
- Basic API connectivity
- Authentication is working
- Backend is responding correctly

## Troubleshooting

If you get API errors:
1. Check that Laravel backend is running on port 8000
2. Verify the IP address 192.168.10.87 is correct
3. Check Laravel logs for any errors
4. Ensure CORS is properly configured
5. Clear browser cache and localStorage

## Development Notes

- The app will automatically reload when you make changes
- API calls are configured to use the full URL (no proxy)
- Images are served from the Laravel storage directory
- Refunded orders are automatically filtered out from all views