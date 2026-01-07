# Network Error Troubleshooting Guide

## What the Error Means

The error `ERR_NETWORK` or `Network Error` means your mobile app **cannot connect** to your backend server at `http://192.168.137.223:8000/api`. This is **NOT** a slow network issue - it's a connectivity problem.

## Quick Checklist

### 1. ✅ Is Your Backend Server Running?

**Check on your computer (where the backend is hosted):**
- Open a terminal/command prompt
- Check if Laravel server is running
- If not, start it with: `php artisan serve --host=0.0.0.0 --port=8000`

### 2. ✅ Verify the IP Address is Correct

**On your computer (Windows):**
```bash
ipconfig
```
Look for your local IP address (usually starts with `192.168.x.x`)

**On your computer (Mac/Linux):**
```bash
ifconfig
# or
ip addr
```

**Update the IP in your mobile app:**
- The IP in the error: `192.168.137.223`
- Make sure this matches your computer's current IP address
- IP addresses can change when you reconnect to WiFi

### 3. ✅ Test Server Accessibility

**From your computer's browser, try:**
```
http://192.168.137.223:8000/api
# or
http://localhost:8000/api
```

**From your mobile device's browser:**
```
http://192.168.137.223:8000/api
```

If this doesn't work on your phone, the server is not accessible from your network.

### 4. ✅ Check Network Connection

**Both devices must be on the same network:**
- Your computer (server) and mobile device must be on the **same WiFi network**
- They cannot be on different networks
- Mobile data won't work - must be WiFi

### 5. ✅ Firewall Issues

**Windows Firewall:**
- Go to Windows Defender Firewall
- Allow PHP/Laravel through the firewall
- Or temporarily disable firewall to test

**Antivirus Software:**
- Some antivirus programs block incoming connections
- Add an exception for port 8000

### 6. ✅ Laravel Server Configuration

**Make sure Laravel is listening on all interfaces:**
```bash
php artisan serve --host=0.0.0.0 --port=8000
```

**NOT:**
```bash
php artisan serve  # This only listens on localhost
```

### 7. ✅ Update API URL in Mobile App

**Option 1: Create `.env` file in `mobile uploads` folder:**
```
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:8000/api
```

**Option 2: Update `mobile uploads/utils/api.js`:**
```javascript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://YOUR_COMPUTER_IP:8000/api';
```

## Step-by-Step Solution

1. **Find your computer's IP address:**
   - Windows: `ipconfig` → Look for "IPv4 Address"
   - Mac/Linux: `ifconfig` → Look for "inet"

2. **Start Laravel server with correct host:**
   ```bash
   php artisan serve --host=0.0.0.0 --port=8000
   ```

3. **Test from browser:**
   - On your computer: `http://localhost:8000/api`
   - On your phone (same WiFi): `http://YOUR_IP:8000/api`

4. **Update mobile app:**
   - Update the IP address in `mobile uploads/utils/api.js`
   - Or create `.env` file with `EXPO_PUBLIC_API_URL`

5. **Restart your mobile app:**
   - Close and reopen the app
   - Or restart Expo: `npx expo start --clear`

## Common Issues

### Issue: IP Address Changed
**Solution:** Update the IP in your mobile app configuration

### Issue: Server Not Accessible from Phone
**Solution:** 
- Check firewall settings
- Ensure both devices on same WiFi
- Verify server is running with `--host=0.0.0.0`

### Issue: Port 8000 Blocked
**Solution:**
- Check firewall rules
- Try a different port: `php artisan serve --host=0.0.0.0 --port=8080`
- Update mobile app to use new port

### Issue: Server Works on Computer but Not Phone
**Solution:**
- Server is probably only listening on `localhost`
- Use `--host=0.0.0.0` to listen on all interfaces

## Testing Connectivity

**From mobile device, open browser and try:**
```
http://192.168.137.223:8000/api
```

If you see a response (even an error), the server is reachable. If you see "Cannot connect" or timeout, the server is not accessible.

## Still Having Issues?

1. Check Laravel logs: `storage/logs/laravel.log`
2. Check if port 8000 is in use: `netstat -an | grep 8000`
3. Try using `localhost` with an emulator (Android Studio/iOS Simulator)
4. Check your router's settings for client isolation

