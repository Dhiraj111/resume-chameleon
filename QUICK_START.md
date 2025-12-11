# 🚀 Quick Start: PDF Upload Feature

## What You Get Now

Your Resume Chameleon app now has a **PDF upload & text extraction** feature. Users can:

1. Upload a PDF resume
2. System automatically extracts text (via Kestra + PyPDF2)
3. Resume textarea auto-fills with extracted text
4. Run analysis with the extracted content

---

## 3 Quick Steps to Get It Working

### Step 1: Update `.env.local` (2 minutes)

Add these 2 lines to your `.env.local`:

```env
KESTRA_API_URL=http://localhost:8080
KESTRA_API_TOKEN=temp_placeholder_for_now
```

### Step 2: Start Kestra Locally (5 minutes)

```bash
# Create Kestra folder
mkdir -p ~/kestra-workspace
cd ~/kestra-workspace

# Copy this docker-compose.yml into that folder:
```

Create `~/kestra-workspace/docker-compose.yml`:
```yaml
version: '3.8'
services:
  kestra:
    image: kestra/kestra:latest
    pull_policy: always
    entrypoint: /bin/bash
    command: [-c, /app/kestra server standalone]
    ports: ["8080:8080", "8081:8081"]
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
    depends_on: [postgres]

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: kestra
      POSTGRES_USER: kestra
      POSTGRES_PASSWORD: k3str4
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

volumes:
  postgres_data:
```

Start it:
```bash
cd ~/kestra-workspace
docker-compose up -d
```

Wait 15 seconds for startup.

### Step 3: Create Kestra Workflow (3 minutes)

1. Open http://localhost:8080
2. Click **"Flows"** → **"Create Flow"**
3. Paste this YAML and save:

```yaml
id: extract-pdf-text
namespace: resume
description: Extract text from PDF resume

variables:
  file_path:
    type: string
  user_id:
    type: string

tasks:
  - id: download_pdf
    type: io.kestra.plugin.core.http.Download
    uri: "https://YOUR_SUPABASE_URL/storage/v1/object/public/resumes/{{ vars.file_path }}"
    headers:
      Authorization: "Bearer YOUR_SUPABASE_ANON_KEY"

  - id: extract_text
    type: io.kestra.plugin.scripts.python.Script
    docker:
      image: python:3.11
    script: |
      import subprocess, sys
      subprocess.run(['pip', 'install', 'PyPDF2', '-q'], check=True)
      from PyPDF2 import PdfReader
      pdf_path = '{{ taskrun.outputDir }}/{{ vars.file_path | split('/') | last }}'
      text = ""
      try:
          with open(pdf_path, 'rb') as file:
              for page in PdfReader(file).pages:
                  text += page.extract_text()
      except Exception as e:
          print(f"Error: {e}", file=sys.stderr)
          sys.exit(1)
      with open('{{ taskrun.outputDir }}/extracted_text.txt', 'w') as f:
          f.write(text)

  - id: upload_text
    type: io.kestra.plugin.core.http.Upload
    from: "{{ taskrun.outputDir }}/extracted_text.txt"
    to: "https://YOUR_SUPABASE_URL/storage/v1/object/resumes/{{ vars.file_path }}.txt"
    headers:
      Authorization: "Bearer YOUR_SUPABASE_ANON_KEY"
      Content-Type: "text/plain"
```

**Replace:**
- `YOUR_SUPABASE_URL` with your Supabase URL (from .env.local)
- `YOUR_SUPABASE_ANON_KEY` with your Supabase anon key (from .env.local)

---

## Get Your Kestra API Token

1. In Kestra UI (http://localhost:8080)
2. Click profile icon → **Settings**
3. Go to **API Tokens** → **Create Token**
4. Copy the token
5. Update `.env.local`:
   ```
   KESTRA_API_TOKEN=your_copied_token_here
   ```

---

## Test It

```bash
# Start your app
npm run dev
```

1. Go to http://localhost:3000
2. Login with your email
3. Select a PDF file
4. Click "Upload & Extract"
5. Watch the resume textarea auto-fill

---

## What's Installed in Your Code

✅ **Frontend:** PDF upload UI in Resume card  
✅ **API Route 1:** `/api/kestra-extract` - Triggers extraction  
✅ **API Route 2:** `/api/resume-text` - Polls for results  
✅ **Validation:** File type & size checks  
✅ **Error Handling:** User-friendly error messages  
✅ **Status Feedback:** "Extracting..." state  

---

## Documentation

- `PDF_UPLOAD_SETUP.md` - Detailed setup guide
- `IMPLEMENTATION_SUMMARY.md` - What's been done
- This file - Quick start

---

## Troubleshooting

**"Kestra job failed"**
- Check `KESTRA_API_TOKEN` in `.env.local`
- Verify Kestra is running: http://localhost:8080

**"Extraction timeout"**
- Check Kestra workflow is executing in UI
- Verify Supabase URLs/keys in workflow are correct

**"File not found in Storage"**
- Create `resumes` bucket in Supabase Storage
- Add RLS policies (see PDF_UPLOAD_SETUP.md)

---

**Everything is ready! Follow the 3 steps above to test. 🎉**
