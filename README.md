<div align="center">

# Resume Chameleon 🦎

**[Live Demo](https://resume-chameleon-swart.vercel.app/)**

**AI-powered resume analysis that predicts recruiter behavior, calculates ATS scores, and generates tailored interview questions.**

</div>

## 📖 Overview
Resume Chameleon is an intelligent career tool designed to decode the hiring process. Beyond simple keyword matching, it uses deep AI analysis to simulate a recruiter's perspective, calculating exactly how an Applicant Tracking System (ATS) views your resume and predicting whether a human recruiter would "Shortlist" or "Reject" you.

## 🚀 Key Features
- **ATS Compatibility Score:** Calculates a precise percentage score indicating how well your resume parses against the specific Job Description (JD).
- **Recruiter Action Prediction:** Simulates a human recruiter's decision (e.g., *Shortlist*, *Hold*, *Reject*) with detailed reasoning.
- **Tailored Interview Prep:** Generates 5 specific technical and behavioral interview questions based on the gaps between your resume and the JD.
- **Toxicity Detector:** Flags manipulative language or unrealistic expectations in job descriptions.
- **Unified Analysis Agent:** One button handles PDF upload, text extraction, database storage, and multi-step AI analysis.
- **Hybrid Automation:** Leverages **Kestra** for heavy-lifting workflow orchestration and **Groq (Llama 3.3)** for lightning-fast inference.

## 🛠 Tech Stack
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes (Serverless)
- **Database & Auth:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Workflow Orchestration:** Kestra (Docker-based)
- **AI Model:** Groq (Llama 3.3)
- **Connectivity:** Ngrok (Secure tunneling for local Kestra instance)

---

## 🏗 Architecture & Deployment (Hackathon Hybrid Setup)

To ensure zero-cost reliability and high performance during the hackathon, this project uses a **Hybrid Architecture**:

1.  **Frontend (Cloud):** The Next.js UI is deployed on **Vercel** for global accessibility.
2.  **Automation Engine (Local/Edge):** Kestra runs on a local high-performance Docker container to avoid cold starts and RAM limits of free cloud tiers.
3.  **Connectivity:** **Ngrok** is used to securely tunnel the local Kestra instance, allowing the Vercel cloud app to trigger workflows on the local machine.

### Quick Start (Local Development)

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Configure Environment:**
    Create a `.env.local` file:
    ```bash
    NEXT_PUBLIC_SUPABASE_URL=[https://your-project.supabase.co](https://your-project.supabase.co)
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
    SUPABASE_SERVICE_ROLE_KEY=your-service-key
    AI_PROVIDER=groq
    GROQ_API_KEY=gsk_...
    
    # Kestra Configuration
    KESTRA_API_URL=[https://your-ngrok-url.ngrok-free.app](https://your-ngrok-url.ngrok-free.app)
    KESTRA_API_TOKEN=your-token
    ```

3.  **Database Setup:**
    Run the scripts in `SUPABASE_TABLES.sql` in your Supabase SQL Editor to create tables and RLS policies.

4.  **Start Services:**
    - Start the Next.js app: `npm run dev`
    - Ensure Kestra is running via Docker.
    - Start Ngrok: `ngrok http 8080` (or your Kestra port).

---

## 📡 API Reference

**Endpoint:** `POST /api/analyze`

**Headers:**
- `Content-Type: application/json`
- `x-user-id`: Supabase User ID
- `x-user-email`: Supabase User Email

**Request Body (PDF):**
```json
{
    "jobDescription": "Senior Full Stack Engineer...",
    "resumeFile": "<base64_encoded_pdf_string>",
    "resumeFileName": "my_resume.pdf"
}

<div align="center">

Built with ❤️ for the 2025 Hackathon.

</div>

