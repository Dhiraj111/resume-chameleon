# 🪣 Storage Bucket Setup Guide

## Error: "Bucket not found"

The `resumes` storage bucket doesn't exist in your Supabase project. This is needed to store uploaded PDF files.

---

## ✅ Quick Setup (2 Minutes)

### Step 1: Create the Bucket

1. Open: **https://app.supabase.com**
2. Select your project
3. Click: **Storage** (left sidebar)
4. Click: **Create a new bucket**
5. Name: `resumes` (exactly this)
6. Choose: **Public** bucket (or Private if you prefer)
7. Click: **Create bucket**

### Step 2: Configure RLS Policy (Optional but Recommended)

If you made it **Public**:
- Users can view any resume
- Good for development/demo

If you made it **Private**:
- Users can only access their own resumes
- More secure for production

---

## 📋 Complete Bucket Configuration

For **Production Security** (Recommended):

1. **Create bucket "resumes"** (Public for simplicity, or Private)

2. **Set bucket policies** (in Supabase Dashboard):
   - Go to: Storage → resumes → Policies
   - Add policy:
     ```
     Name: Allow public read access
     Target roles: All roles, unauthenticated
     Grant: SELECT
     Using: true (allow all)
     ```
   
   - Add policy:
     ```
     Name: Allow users to upload their own files
     Target roles: authenticated
     Grant: INSERT
     Using: true
     ```

---

## 🚀 After Creating Bucket

1. Refresh your browser: http://localhost:3000
2. Try uploading a PDF again
3. Should work now! ✅

---

## 📝 Bucket Details

**Bucket Name**: `resumes`
**File Path Format**: `{user_id}/{timestamp}-{filename}.pdf`
**File Size Limit**: 10 MB (configured in app)
**Access Level**: Public or Private (your choice)

---

## ✅ Verification

1. Supabase Dashboard → Storage
2. Click: **resumes** bucket
3. Should see uploaded PDFs in folders like:
   ```
   resumes/
     └── user-id-123/
         ├── 1702000000000-resume.pdf
         ├── 1702000100000-resume.pdf
   ```

---

## ❓ Still Not Working?

Check:
1. Bucket name is exactly `resumes` (lowercase)
2. Bucket exists in Storage section
3. You refreshed browser after creating bucket
4. Your `.env.local` has correct Supabase URL and keys

---

## 🔒 Security Note

For **Production**:
- Make bucket **Private**
- Set **RLS policies** to only allow users to access their own files
- Use **Service Role Key** on backend (already done in code)

For **Development**:
- Can use **Public** bucket for simplicity
- Backend still uses Service Role Key (secure)

---

That's it! The bucket setup is now complete. Try uploading a PDF again! 🚀
