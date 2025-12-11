# Supabase Authentication Setup Guide

## Issue: 401 Unauthorized Error

You're seeing this error because email/password authentication needs to be properly configured in your Supabase project.

## Steps to Fix:

### 1. Enable Email Authentication in Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/plptlitwnhiajcuspzxi
2. Click on **Authentication** in the left sidebar
3. Click on **Providers**
4. Find **Email** provider and click on it
5. Toggle **Enable Email provider** to ON
6. Click **Save**

### 2. Configure Email Settings (for testing)

For development/testing, you may want to disable email confirmation:

1. In the same Authentication section, go to **Settings**
2. Find **Email Auth** section
3. Toggle **Enable email confirmations** to OFF (for testing only)
4. Click **Save**

**Important:** For production, keep email confirmation enabled for security.

### 3. Create a Test User

You have two options:

#### Option A: Through Supabase Dashboard
1. Go to **Authentication** → **Users**
2. Click **Add user**
3. Select **Create new user**
4. Enter email: `dhirajbhakare21@gmail.com`
5. Enter a password (at least 6 characters)
6. Click **Create user**

#### Option B: Through Your App
1. Reload your app at http://localhost:3000
2. Click "Don't have an account? Sign Up"
3. Enter your email and password
4. Click "Sign In"

### 4. Verify Configuration

Check your browser console (F12) for detailed error messages. The improved error handling will now show:
- Connection issues
- Invalid credentials
- Email confirmation requirements
- Registration status

## Current Environment Variables

Your `.env.local` is correctly configured with:
```
NEXT_PUBLIC_SUPABASE_URL=https://plptlitwnhiajcuspzxi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[configured]
```

## Testing the Fix

1. After enabling email authentication in Supabase
2. Restart your Next.js dev server:
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```
3. Try signing up with a new account
4. Check the browser console for detailed logs

## Common Issues

### "Invalid login credentials"
- User doesn't exist yet → Use Sign Up first
- Wrong password → Double-check your password

### "Email not confirmed"
- Check your email inbox for confirmation link
- OR disable email confirmation in Supabase settings (testing only)

### Still seeing 401 errors?
- Clear browser cache and cookies
- Check Supabase project status at https://status.supabase.com
- Verify your anon key hasn't been rotated in Supabase settings

## Need Help?

If you're still having issues:
1. Check the browser console (F12) for detailed error logs
2. Check Supabase logs: Dashboard → Logs → Auth logs
3. Verify the Authentication provider is enabled and saved
