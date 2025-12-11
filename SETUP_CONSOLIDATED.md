# ⚡ Quick Setup - Consolidated PDF Upload + Analysis

Complete setup in 5 minutes.

---

## ✅ Checklist

### **1. Create Database Table** (2 min)

Go to **Supabase Dashboard** → **SQL Editor** → Run this:

```sql
-- Create analyses table to store job description + resume + analysis results
CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Input data
  job_description TEXT NOT NULL,
  resume_text TEXT NOT NULL,
  resume_file_path VARCHAR(500),
  
  -- Analysis results (from Gemini)
  toxicity_score INTEGER,
  red_flags JSONB,
  fit_score INTEGER,
  summary TEXT,
  missing_skills TEXT[],
  
  -- Interview prep (optional)
  interview_questions JSONB,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, error
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own analyses"
  ON analyses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analyses"
  ON analyses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses"
  ON analyses FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses"
  ON analyses FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for faster queries
CREATE INDEX analyses_user_id_idx ON analyses(user_id);
CREATE INDEX analyses_created_at_idx ON analyses(created_at DESC);
```

✅ **Done**: Check Supabase → Tables → `analyses` exists

---

### **2. Verify .env.local** (1 min)

Your `.env.local` should have these variables (you already have these):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (IMPORTANT: Service role, not anon key)

GEMINI_API_KEY=AIza...

KESTRA_API_URL=http://localhost:8080
KESTRA_API_TOKEN=your-token
```

⚠️ **IMPORTANT**: `SUPABASE_SERVICE_ROLE_KEY` is different from anon key!
- Get it from: **Settings** → **API** → Look for "Service Role Key"

✅ **Done**: All vars present

---

### **3. Start Backend Services** (1 min)

Make sure these are running:

```bash
# Terminal 1: Start your app
npm run dev

# Terminal 2: Start Kestra (for PDF extraction)
cd ~/kestra-workspace
docker-compose up -d
```

Wait 10 seconds for services to start.

✅ **Done**: http://localhost:3000 loads without errors

---

### **4. Test in Browser** (1 min)

1. Open http://localhost:3000
2. **Login** to your account
3. **Enter a Job Description** (copy-paste from any JD)
4. **Option A - Paste Resume Text**:
   - Click resume textarea
   - Paste your resume text
   - Click **"Run Analysis Agent"**
   
5. **Option B - Upload PDF**:
   - Click file input under "Or Upload PDF Resume"
   - Select a PDF file
   - Click **"Run Analysis Agent"** (now does everything!)
6. **Wait** ~8-15 seconds for analysis
7. **View Results** - Should show toxicity score, red flags, fit score, etc.

✅ **Done**: Analysis completes successfully

---

### **5. Verify Database** (Optional, but good practice)

Go to **Supabase Dashboard** → **SQL Editor** → Run:

```sql
-- Check if your analysis was saved
SELECT id, job_description, resume_text, toxicity_score, status
FROM analyses
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;
```

You should see your analysis record with:
- ✅ job_description (what you entered)
- ✅ resume_text (extracted from PDF or pasted text)
- ✅ toxicity_score (number from Gemini)
- ✅ status = 'completed'

---

## 🎯 What Changed from Before

| Before | After |
|--------|-------|
| "Upload & Extract" button | Removed |
| Separate PDF extraction step | Integrated into analysis |
| Data not saved to DB | Now saved to `analyses` table |
| Only "Run Analysis" button | Still "Run Analysis Agent" but now handles PDF + analysis |

---

## 🚀 You're Done!

The app now:
- ✅ Accepts resume as text OR PDF
- ✅ Uploads PDF to Supabase Storage (if provided)
- ✅ Extracts text with Kestra (if PDF)
- ✅ Saves everything to `analyses` table
- ✅ Runs Gemini analysis
- ✅ Displays results

---

## 🐛 If Something Breaks

| Issue | Fix |
|-------|-----|
| Button doesn't work | Are you logged in? Is job description filled? Is resume or PDF provided? |
| "Analysis failed" | Check `GEMINI_API_KEY` in .env.local |
| PDF extraction stuck | Check Kestra: `docker-compose ps` |
| Database error | Did you run the SQL above? Check Supabase logs |

---

## 📚 For More Details

- **Full documentation**: See `CONSOLIDATED_FLOW.md`
- **API details**: See `pages/api/analyze.ts` (well documented)
- **Database schema**: See `SUPABASE_TABLES.sql`

---

**That's it! You're ready to use Resume Chameleon with full PDF + analysis integration.** 🎉
