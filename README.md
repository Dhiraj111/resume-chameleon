<div align="center">

# Resume Chameleon

AI-powered resume analysis that highlights toxic job descriptions, evaluates fit, and suggests improvements. One button handles PDF upload, extraction, database save, and Groq analysis.

</div>

## What It Does
- Analyze a job description against your resume (text or PDF)
- Detect toxic language and flag red flags with explanations
- Score role fit, rewrite your summary, and list missing skills
- Persist every analysis to Supabase with RLS
- Single unified "Run Analysis Agent" button (no manual extraction step)
- Kestra extracts PDFs and invokes Groq; all outputs are stored in Supabase

## Stack
- Next.js 16, React 19, TypeScript, Tailwind
- API Routes for backend logic
- Supabase PostgreSQL + RLS for data and auth; Supabase Storage for PDFs
- Kestra workflow for PDF text extraction and Groq invocation
- Groq Llama 3.3 via Groq API for analysis (default provider)

## Quick Start
1. Install deps: `npm install`
2. Create `.env.local` with:
	 ```bash
	 NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
	NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
	SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...    # service role, not anon
	AI_PROVIDER=groq
	GROQ_API_KEY=gsk_...
	 KESTRA_API_URL=http://localhost:8080
	 KESTRA_API_TOKEN=your-token
	 ```
3. Create the database table and RLS policies: run `SUPABASE_TABLES.sql` (or SQL in `SETUP_CONSOLIDATED.md`) in Supabase SQL Editor.
4. Start services:
	 ```bash
	 npm run dev          # app at http://localhost:3000
	 # in another shell if using PDF: start Kestra (docker-compose or your setup)
	 ```
5. Log in via Supabase Auth in the app, paste a job description, add resume text or upload a PDF, then click **Run Analysis Agent**.

## Usage
- **Input**: Job description (required) + resume text or PDF (one required; text wins if both provided)
- **Action**: Click **Run Analysis Agent**
- **Output**: Toxicity score, red flags with explanations, fit score, rewritten summary, missing skills; result saved to `analyses` table with file path when PDF provided (analysis performed via Groq)
- **Timing**: ~8s for text, ~15s for PDF (includes extraction)

## API
- **Endpoint**: `POST /api/analyze`
- **Headers**: `Content-Type: application/json`, `x-user-id` (Supabase user id), `x-user-email`
- **Body (text)**:
	```json
	{
		"jobDescription": "Senior Full Stack Engineer...",
		"resumeText": "10 years of experience..."
	}
	```
- **Body (PDF)**:
	```json
	{
		"jobDescription": "Senior Full Stack Engineer...",
		"resumeFile": "<base64 pdf>",
		"resumeFileName": "resume.pdf"
	}
	```
- Returns: `analysisId`, `analysisData` (toxicityScore, redFlags, fitScore, summary, missingSkills), and `success: true`
- Full reference: `API_DOCUMENTATION.md` (AI provider configurable via `AI_PROVIDER`, default `groq`)

## Project Map
- `app/page.tsx` – main UI with unified flow
- `pages/api/analyze.ts` – consolidated analysis endpoint (upload, extract, save, analyze)
- `pages/api/analyses.ts` – supporting API for analyses data
- `SUPABASE_TABLES.sql` – database schema and RLS policies
- `CONSOLIDATED_FLOW.md` – architecture and data flow
- `SETUP_CONSOLIDATED.md` – 5-minute setup checklist
- `DEPLOYMENT_CHECKLIST.md` – production steps

## Scripts
- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run start` – serve built app
- `npm run lint` – lint

## Troubleshooting
- Must be authenticated: login before running analysis
- Ensure all env vars are present; service role key must be the service key from Supabase
- PDF extraction hangs: verify Kestra is running and reachable at `KESTRA_API_URL`
- Database errors: confirm `analyses` table and RLS policies are applied
- API errors: check `AI_PROVIDER`, Groq API key, and Supabase connectivity

## Deployment
1. `npm run build` to verify production build
2. Set env vars in your hosting platform (include service role key)
3. Deploy (Vercel or your choice) and run through `DEPLOYMENT_CHECKLIST.md`

## Docs
- Setup: `SETUP_CONSOLIDATED.md`
- Flow: `CONSOLIDATED_FLOW.md`
- API: `API_DOCUMENTATION.md`
- Deployment: `DEPLOYMENT_CHECKLIST.md`
- Database: `SUPABASE_TABLES.sql`

</div>
