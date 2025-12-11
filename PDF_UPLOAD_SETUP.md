# PDF Resume Upload & Extraction Integration Guide

## ✅ COMPLETED IN CODE

Your `app/page.tsx` now has:
- ✅ PDF file upload UI in the Resume card
- ✅ File validation (PDF only, max 10MB)
- ✅ Upload to Supabase Storage
- ✅ Kestra workflow trigger
- ✅ Polling for extraction completion
- ✅ Auto-populate resume textarea with extracted text

Your API routes are created:
- ✅ `/pages/api/kestra-extract.ts` - Triggers Kestra workflow
- ✅ `/pages/api/resume-text.ts` - Fetches extracted text

---

## 🚀 REMAINING SETUP STEPS

### **Step 1: Add Environment Variables**

Update your `.env.local` with:

```
# Existing variables (already have these)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_key

# New variables for Kestra (add these)
KESTRA_API_URL=http://localhost:8080
KESTRA_API_TOKEN=your_kestra_token_here
```

**How to get KESTRA_API_TOKEN:**
1. Run Kestra locally with Docker (see Step 2)
2. Go to http://localhost:8080
3. Click profile → Settings → API Tokens → Create Token
4. Copy the token and add to `.env.local`

---

### **Step 2: Setup Kestra (Local Development)**

**Install Docker:**
- macOS: https://www.docker.com/products/docker-desktop

**Create Kestra folder and files:**

```bash
mkdir -p ~/kestra-workspace
cd ~/kestra-workspace
```

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  kestra:
    image: kestra/kestra:latest
    pull_policy: always
    entrypoint: /bin/bash
    command:
      - -c
      - /app/kestra server standalone
    ports:
      - "8080:8080"
      - "8081:8081"
    environment:
      KESTRA_CONFIGURATION: |
        datasources:
          postgres:
            url: jdbc:postgresql://postgres:5432/kestra
            driverClassName: org.postgresql.Driver
            username: kestra
            password: k3str4
        kestra:
          server:
            ssl:
              enabled: false
          repository:
            type: postgres
          storage:
            type: local
            local:
              base-path: /tmp/kestra-storage
          queue:
            type: postgres
          cache:
            type: postgres
          secret:
            type: env
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: kestra
      POSTGRES_USER: kestra
      POSTGRES_PASSWORD: k3str4
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Start Kestra:**

```bash
cd ~/kestra-workspace
docker-compose up -d
```

Access Kestra UI: http://localhost:8080

---

### **Step 3: Create Kestra Workflow**

In Kestra UI (http://localhost:8080):

1. Click **"Flows"** → **"Create Flow"**
2. Paste this YAML:

```yaml
id: extract-pdf-text
namespace: resume
description: "Extract text from PDF resume using PyPDF2"

variables:
  file_path:
    type: string
    description: "Path to PDF file in Supabase Storage (e.g., user_id/timestamp-file.pdf)"
  user_id:
    type: string
    description: "User ID for database reference"

tasks:
  - id: download_pdf
    type: io.kestra.plugin.core.http.Download
    uri: "{{ env('SUPABASE_URL') }}/storage/v1/object/public/resumes/{{ vars.file_path }}"
    headers:
      Authorization: "Bearer {{ env('SUPABASE_ANON_KEY') }}"

  - id: extract_text
    type: io.kestra.plugin.scripts.python.Script
    docker:
      image: python:3.11
    script: |
      import subprocess
      import sys
      subprocess.run(['pip', 'install', 'PyPDF2', '-q'], check=True)
      
      from PyPDF2 import PdfReader
      
      pdf_path = '{{ taskrun.outputDir }}/{{ vars.file_path | split('/') | last }}'
      text = ""
      
      try:
          with open(pdf_path, 'rb') as file:
              reader = PdfReader(file)
              for page in reader.pages:
                  text += page.extract_text()
          
          if not text.strip():
              print("Warning: PDF appears to be empty or unreadable", file=sys.stderr)
              text = "[Unable to extract text - PDF may be scanned or encrypted]"
      except Exception as e:
          print(f"Error reading PDF: {str(e)}", file=sys.stderr)
          sys.exit(1)
      
      # Save extracted text
      with open('{{ taskrun.outputDir }}/extracted_text.txt', 'w') as f:
          f.write(text)

  - id: upload_text
    type: io.kestra.plugin.core.http.Upload
    from: "{{ taskrun.outputDir }}/extracted_text.txt"
    to: "{{ env('SUPABASE_URL') }}/storage/v1/object/resumes/{{ vars.file_path }}.txt"
    headers:
      Authorization: "Bearer {{ env('SUPABASE_ANON_KEY') }}"
      Content-Type: "text/plain"
```

3. Click **"Save"**

---

### **Step 4: Add Kestra Environment Variables**

In Kestra UI:

1. Go to **Admin** → **Namespace Variables** (or **Secrets**)
2. Add these variables:

| Variable Name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase URL |
| `SUPABASE_ANON_KEY` | Your Supabase Anon Key |

---

### **Step 5: Create Supabase Tables & RLS**

In Supabase Dashboard → **SQL Editor**, run:

```sql
-- Create user profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create resumes table
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  extracted_text TEXT,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'processing',
  kestra_job_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view their own resumes"
  ON resumes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own resumes"
  ON resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

### **Step 6: Create Storage Bucket**

In Supabase → **Storage**:

1. Click **"Create a new bucket"**
2. Name: `resumes`
3. Public: **OFF** (keep private)
4. Click **Create**

Add RLS policies (SQL Editor):

```sql
-- Storage bucket RLS for resumes
CREATE POLICY "Users can upload their own resumes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their own resumes"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own resumes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 🧪 Testing the Flow

1. **Start your app:**
```bash
npm run dev
```

2. **Login** with your Supabase account

3. **Upload a PDF:**
   - Click "Choose File"
   - Select a PDF resume
   - Click "Upload & Extract"

4. **Monitor:**
   - Check Kestra UI at http://localhost:8080 for workflow execution
   - Check Supabase Storage for `user_id/timestamp.pdf.txt` file
   - Resume textarea should auto-fill in 2-4 seconds

5. **Run Analysis:**
   - Click "Run Analysis Agent"
   - System uses extracted text + Job Description for analysis

---

## 🔧 Troubleshooting

**Issue: "Kestra job failed"**
- Check `.env.local` has `KESTRA_API_URL` and `KESTRA_API_TOKEN`
- Verify Kestra is running: `docker-compose ps` in `~/kestra-workspace`
- Check Kestra logs: `docker-compose logs kestra`

**Issue: "Extraction timeout"**
- Check Kestra workflow execution in UI
- Verify Supabase keys are correct in Kestra variables
- Check network connectivity

**Issue: Empty extracted text**
- PDF may be scanned/image-based (need OCR)
- Install Tesseract for OCR support in Kestra
- Or ask user to upload text-based PDFs

---

## 📝 Architecture Overview

```
User Upload (PDF)
    ↓
Supabase Storage (resumes bucket)
    ↓
Kestra Workflow Trigger (via API)
    ↓
Kestra Tasks:
  1. Download PDF from Supabase
  2. Extract text (PyPDF2)
  3. Upload .txt to Supabase Storage
    ↓
Frontend polls `/api/resume-text`
    ↓
Auto-fill textarea + Run Gemini Analysis
```

---

**Status:** All frontend code ✅ | API routes created ✅ | Ready for Kestra setup 🚀
