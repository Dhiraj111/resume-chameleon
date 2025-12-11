import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Shared analysis shape coming from Supabase/Kestra
export type Analysis = {
  id?: string
  toxicityScore?: number
  redFlags?: Array<{ text: string; meaning?: string }>
  fitScore?: number
  summary?: string
  missingSkills?: string[]
  interviewQuestions?: Array<{ question: string; tip?: string }>
  aiResponse?: string
  status?: string
  extractedText?: string
  createdAt?: string
  updatedAt?: string
}

// Normalize Supabase row (snake_case) into the camelCase Analysis shape
export function mapAnalysis(row: any): Analysis {
  if (!row) return {}

  // Helper to safely convert to array
  const ensureArray = (val: any) => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') return [val]; // Single object becomes array
    return [];
  };

  const redFlags = Array.isArray(row.red_flags)
    ? row.red_flags.map((flag: any) =>
        typeof flag === "string"
          ? { text: flag, meaning: "" }
          : { text: flag?.text || "", meaning: flag?.meaning || flag?.reason || "" }
      )
    : row.redFlags || [];

  const missingSkills = (() => {
    if (Array.isArray(row.missing_skills)) return row.missing_skills;
    if (Array.isArray(row.missingSkills)) return row.missingSkills;
    if (typeof row.missing_skills === 'string') return [row.missing_skills];
    return [];
  })();

  // Extract interview questions from ai_response or separate column
  const aiResponseObj = row.ai_response ?? row.aiResponse ?? {};
  const interviewQuestions = (() => {
    // First check if interview_questions is nested in ai_response
    if (typeof aiResponseObj === 'object' && Array.isArray(aiResponseObj.interview_questions)) {
      return aiResponseObj.interview_questions;
    }
    // Then check if it's a separate column
    const raw = row.interview_questions || row.interviewQuestions;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      // Single object case
      return [raw];
    }
    return [];
  })();

  // Ensure numeric fields are actually numbers
  const toxicityScore = (() => {
    const val = row.toxicity_score ?? row.toxicityScore ?? 0;
    return typeof val === 'number' ? val : parseInt(val, 10) || 0;
  })();

  const fitScore = (() => {
    const val = row.fit_score ?? row.fitScore ?? 0;
    return typeof val === 'number' ? val : parseInt(val, 10) || 0;
  })();

  // Safe string extractor - handles objects, arrays, null, undefined
  const safeString = (val: any): string => {
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val, null, 2);
      } catch {
        return String(val);
      }
    }
    return '';
  };

  // Extract summary and aiResponse from ai_response JSONB
  // ai_response is a JSONB object with { summary: "...", interview_questions: [...], ... } structure
  const summary = (() => {
    if (row.summary) return String(row.summary); // Direct summary column
    if (typeof aiResponseObj === 'object' && aiResponseObj.summary) {
      return String(aiResponseObj.summary); // Summary nested in ai_response
    }
    return '';
  })();

  const aiResponse = (() => {
    if (typeof aiResponseObj === 'string') return aiResponseObj;
    if (typeof aiResponseObj === 'object') return safeString(aiResponseObj);
    return '';
  })();

  return {
    id: row.id,
    toxicityScore,
    redFlags,
    fitScore,
    summary,
    missingSkills,
    interviewQuestions,
    aiResponse,
    status: String(row.status ?? "unknown"),
    extractedText: String(row.resume_text ?? row.extracted_text ?? row.extractedText ?? ""),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
