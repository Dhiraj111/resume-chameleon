'use client'; // <--- THIS IS REQUIRED FOR NEXT.JS

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import Spline from '@splinetool/react-spline';
import { 
  Briefcase, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight, 
  Zap, 
  ShieldAlert, 
  Cpu, 
  Loader, 
  RefreshCcw,
  Copy,
  Sparkles,
  User,
  X,
  LogOut,
  Mail,
  Lock,
  Upload
} from 'lucide-react';
import { mapAnalysis, type Analysis } from '@/lib/utils';

// Helper to safely access environment variables without crashing in browser preview
const getEnvVar = (key: string) => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || "";
    }
  } catch (e) {
    // process is not defined
    return "";
  }
  return "";
};

// Initialize Client
// Support both public (browser) and server-style names to avoid crashes in dev
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

if (!supabase) {
  console.warn('Supabase is not configured. Check environment variables.');
} else {
  console.log('✅ Supabase client initialized successfully');
  console.log('Supabase URL:', supabaseUrl);
  // Test the connection
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('❌ Supabase connection test failed:', error);
    } else {
      console.log('✅ Supabase connection test passed');
      console.log('Current session:', data.session ? 'Active' : 'None');
    }
  });
}

const App = () => {
  const [appState, setAppState] = useState('landing'); // landing, analyzing, results
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [workflowStep, setWorkflowStep] = useState(0);
  
  // PDF Upload States
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedResumeText, setExtractedResumeText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  
  // Gemini Data States
  const [analysisData, setAnalysisData] = useState<Analysis | null>(null);
  const [interviewPrep, setInterviewPrep] = useState<any>(null);
  const [loadingInterview, setLoadingInterview] = useState(false);

  // Spline loading state
  const [splineLoaded, setSplineLoaded] = useState(false);

  // Auth States
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Client-side only flag to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Setup Supabase Auth Listener on Mount
  useEffect(() => {
    if (!supabase) return;

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null);
    });

    // Listen for changes (login, logout, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Mock data for defaults
  const mockJD = `We are looking for a Rockstar Developer 10x Engineer! 
Must be willing to work hard and play hard. We are a family here. 
Requirements: 
- 10 years experience in a language released 2 years ago.
- Ability to handle high-pressure environment.
- Available on weekends for "occasional" sprints.
- Salary: Competitive (Equity heavy).`;

  const mockResume = `John Doe
Software Engineer
Experienced in React and Node.js. looking for a new role.
I built several web apps and I am good at coding.`;

  const workflowSteps = [
    { id: 1, name: 'Ingesting Data', agent: 'Kestra IO Agent' },
    { id: 2, name: 'Scanning for Red Flags', agent: 'Toxic Detector Bot' },
    { id: 3, name: 'Analyzing Skills Gap', agent: 'Match Engine' },
    { id: 4, name: 'Generating "Chameleon" Resume', agent: 'Writer Agent' },
    { id: 5, name: 'Validating Format', agent: 'CodeRabbit QA' },
  ];

  // --- API Call Helper ---
  const callGemini = async (prompt: string) => {
    try {
      const response = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        }
      );
      
      if (!response.ok) throw new Error('API call failed');
      
      const data = await response.json();
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
      console.error("API Error:", error);
      return null;
    }
  };

  const handleAnalyze = async () => {
    if (!user) {
      setAuthError('Please log in to run analysis.');
      return;
    }

    if (!jobDescription.trim()) {
      setAuthError('Please enter a Job Description.');
      return;
    }

    if (!resumeText.trim() && !resumeFile) {
      setAuthError('Please enter Resume text or upload a PDF file.');
      return;
    }

    setAuthError('');
    setAppState('analyzing');
    setIsExtracting(true);
    setAnalysisData(null); // Clear previous results for fresh analysis
    setInterviewPrep([]);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setWorkflowStep(step);
      if (step >= workflowSteps.length) {
        clearInterval(interval);
      }
    }, 1500);

    try {
      const requestBody: any = { jobDescription: jobDescription.trim() };

      // FIXED: Properly handle FileReader async operation
      if (resumeFile) {
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = (e.target?.result as string).split(',')[1];
            resolve(result);
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(resumeFile);
        });

        requestBody.resumeFile = base64Content;
        requestBody.resumeFileName = resumeFile.name;
      } else {
        requestBody.resumeText = resumeText.trim();
      }

      // Call initial analyze endpoint to upload and store data
      console.log('📤 Uploading resume and job description...');
      const uploadResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-email': user.email || '',
        },
        body: JSON.stringify(requestBody),
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || `Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('Upload result:', uploadResult);
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload returned unsuccessful');
      }

      const analysisId = uploadResult.analysisId;
      if (!analysisId) {
        throw new Error('No analysis ID returned from upload');
      }

      // Simply poll Supabase for results from Kestra
      console.log('📋 Polling Supabase for Kestra results...');
      let analysisComplete = false;
      let supabaseAttempts = 0;
      const maxSupabaseAttempts = 120; // 2 minutes with 1 sec intervals

      while (!analysisComplete && supabaseAttempts < maxSupabaseAttempts) {
        supabaseAttempts++;
        
        // Wait 1 second before each attempt
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          // Fetch directly from Supabase
          const supabaseResponse = await fetch('/api/analyses', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': user.id,
            },
          });

          if (!supabaseResponse.ok) {
            console.log(`⏳ Supabase fetch failed (${supabaseResponse.status}), retrying... (attempt ${supabaseAttempts}/${maxSupabaseAttempts})`);
            continue;
          }

          const supabasePayload = await supabaseResponse.json();
          
          if (!supabasePayload.success) {
            console.log(`⏳ Supabase error: ${supabasePayload.error}... (attempt ${supabaseAttempts}/${maxSupabaseAttempts})`);
            continue;
          }

          if (!supabasePayload.analysis) {
            console.log(`⏳ No analysis record yet... (attempt ${supabaseAttempts}/${maxSupabaseAttempts})`);
            continue;
          }

          const analysis = mapAnalysis(supabasePayload.analysis);
          
          console.log('📊 Analysis status from Supabase:', { 
            status: analysis.status, 
            toxicity: analysis.toxicityScore, 
            ats_score: analysis.atsScore,
            fit: analysis.fitScore,
            redFlags: analysis.redFlags?.length || 0,
            skills: analysis.missingSkills?.length || 0
          });

          // Wait for Kestra to mark status as 'completed' (or 'analysis_complete')
          const isComplete = analysis.status === 'completed' || analysis.status === 'analysis_complete';
          
          if (isComplete) {
            console.log('✅ Kestra completed! Status is "completed" - displaying results');
            
            // Ensure all arrays are properly formatted
            const safeRedFlags = Array.isArray(analysis.redFlags) 
              ? analysis.redFlags.filter(f => f && typeof f === 'object').map(f => ({
                  text: String(f.text || ''),
                  meaning: String(f.meaning || '')
                }))
              : [];
            
            const safeSkills = Array.isArray(analysis.missingSkills)
              ? analysis.missingSkills.filter(s => s).map(s => String(s))
              : [];
            
            const safeQuestions = Array.isArray(analysis.interviewQuestions)
              ? analysis.interviewQuestions.filter(q => q).map(q => {
                  // Handle both string and object formats
                  if (typeof q === 'string') {
                    return { question: q, tip: 'Share a concise, outcome-focused answer.' };
                  }
                  return {
                    question: String(q.question || q),
                    tip: String(q.tip || 'Share a concise, outcome-focused answer.')
                  };
                })
              : [];
            
            setAnalysisData({
              toxicityScore: Number(analysis.toxicityScore) || 0,
              redFlags: safeRedFlags,
              fitScore: Number(analysis.fitScore) || 0,
              atsScore: Number(analysis.atsScore) || 0,
              summary: String(analysis.summary || ''),
              missingSkills: safeSkills,
              interviewQuestions: safeQuestions,
              aiResponse: String(analysis.aiResponse || ''),
              extractedText: String(analysis.extractedText || ''),
              status: String(analysis.status || 'completed'),
            } as Analysis);

            analysisComplete = true;
            break;
          } else {
            console.log(`⏳ Waiting for Kestra to complete... Current status: "${analysis.status}" (attempt ${supabaseAttempts}/${maxSupabaseAttempts})`);
          }
        } catch (fetchError) {
          console.log(`⏳ Fetch error: ${fetchError instanceof Error ? fetchError.message : 'Unknown'}, retrying... (attempt ${supabaseAttempts}/${maxSupabaseAttempts})`);
        }
      }

      if (!analysisComplete) {
        throw new Error('Analysis timeout. Kestra processing took too long (2 minutes). Please refresh the page to check status.');
      }

      setResumeFile(null);
      
      setTimeout(() => {
        clearInterval(interval);
        setAppState('results');
        setIsExtracting(false);
      }, 7500);
    } catch (error) {
      clearInterval(interval);
      const errorMsg = error instanceof Error ? error.message : 'Analysis failed';
      console.error('Analysis error:', errorMsg);
      setAuthError(errorMsg);
      setAppState('landing');
      setIsExtracting(false);
    }
  };

  // Handle PDF file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.includes('pdf')) {
        setAuthError('Please upload a PDF file');
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setAuthError('File size must be less than 10MB');
        return;
      }
      setResumeFile(file);
      setAuthError('');
    }
  };

  // Upload PDF to Supabase Storage
  const handleUploadPDF = async () => {
    // Scenario 1: No file selected
    if (!resumeFile) {
      setAuthError('Please select a PDF file first');
      return;
    }

    // Scenario 2: No job description provided
    if (!jobDescription.trim()) {
      setAuthError('Please enter the Job Description before uploading. This helps with better analysis!');
      return;
    }

    // Scenario 3: User not logged in
    if (!user) {
      setAuthError('Please log in to upload and extract resume');
      return;
    }

    setIsExtracting(true);
    setAuthError('');

    try {
      // Create user folder path: user_id/filename.pdf
      const fileName = `${user.id}/${Date.now()}-${resumeFile.name}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase!.storage
        .from('resumes')
        .upload(fileName, resumeFile);

      if (error) throw error;

      console.log('File uploaded:', data);

      // Call Kestra workflow to extract text
      const kestraResponse = await fetch('/api/kestra-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: fileName,
          user_id: user.id,
        }),
      });

      if (!kestraResponse.ok) throw new Error('Kestra job failed');
      
      const kestraData = await kestraResponse.json();
      console.log('Kestra job started:', kestraData.job_id);

      // Poll for extraction completion (check every 2 seconds)
      let completed = false;
      let attempts = 0;
      
      while (!completed && attempts < 60) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(`/api/resume-text?file=${encodeURIComponent(fileName)}`);
        const statusData = await statusResponse.json();

        if (statusData.extracted_text) {
          setExtractedResumeText(statusData.extracted_text);
          setResumeText(statusData.extracted_text);
          setResumeFile(null);
          setIsExtracting(false);
          setAuthError('');
          completed = true;
          break;
        }
      }

      if (!completed) {
        setAuthError('Extraction timeout. Please try again.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setAuthError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsExtracting(false);
    }
  };

  const generateInterviewPrep = async () => {
    setLoadingInterview(true);
    const jdToUse = jobDescription || mockJD;
    const resumeToUse = resumeText || mockResume;

    const prepPrompt = `
      Based on the following JD and Resume, generate 3 specific, challenging interview questions the candidate is likely to be asked.
      
      JD: "${jdToUse}"
      Resume: "${resumeToUse}"

      Return JSON:
      {
        "questions": [
          { "question": "The question text", "tip": "Brief tip on how to answer" }
        ]
      }
    `;

    const result = await callGemini(prepPrompt);
    setInterviewPrep(result?.questions || []);
    setLoadingInterview(false);
  };

  const copyToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  };

  // --- Real Supabase Auth Handlers ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    if (!supabase) {
      setAuthError('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.');
      setAuthLoading(false);
      return;
    }

    console.log('🔐 Starting authentication...', { mode: authMode });
    
    // Get form data
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          console.error('Signup error:', error);
          throw error;
        }
        
        console.log('Signup successful:', data);
        alert('Check your email for the confirmation link!');
        setIsLoginModalOpen(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          console.error('Sign in error:', error);
          throw error;
        }
        
        console.log('Sign in successful:', data);
        setIsLoginModalOpen(false);
      }
    } catch (error: any) {
      console.error('❌ Auth error details:', error);
      console.error('Error status:', error.status);
      console.error('Error message:', error.message);
      
      // Provide more helpful error messages
      if (error.message?.includes('Invalid login credentials')) {
        setAuthError('Invalid email or password. Please try again.');
      } else if (error.message?.includes('Email not confirmed')) {
        setAuthError('Please confirm your email address before signing in.');
      } else if (error.message?.includes('User already registered')) {
        setAuthError('This email is already registered. Please sign in instead.');
      } else if (error.status === 400 && authMode === 'signin') {
        setAuthError('Invalid credentials. Please check your email and password, or sign up if you don\'t have an account.');
      } else if (error.message?.includes('Email provider is disabled')) {
        setAuthError('Email authentication is not enabled. Please enable it in Supabase Dashboard → Authentication → Providers.');
      } else {
        setAuthError(error.message || 'Authentication failed. Please check your Supabase settings and ensure Email provider is enabled.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setAppState('landing');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 relative overflow-hidden">
      {/* Spline 3D Background */}
      <div className="fixed inset-0 z-0">
        {/* Loading placeholder - only show on client to avoid hydration mismatch */}
        {mounted && !splineLoaded && (
          <div className="absolute inset-0 bg-slate-950 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Loading 3D Scene...</p>
            </div>
          </div>
        )}
        <Spline
          scene="https://prod.spline.design/5I3CQR3aQItAsVj6/scene.splinecode"
          onLoad={() => setSplineLoaded(true)}
        />
        {/* Gradient overlay for better text readability - pointer-events-none allows interaction through */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-slate-950/80 pointer-events-none" />
      </div>

      {/* Content wrapper with higher z-index - pointer-events-none on container, auto on children */}
      <div className="relative z-10 pointer-events-none">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/30 backdrop-blur-xl sticky top-0 z-40 pointer-events-auto">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAppState('landing')}>
            <div className="w-8 h-8 bg-gradient-to-tr from-emerald-400 to-cyan-500 rounded-lg flex items-center justify-center">
              <RefreshCcw className="text-slate-950 w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">Resume<span className="text-emerald-400">Chameleon</span></span>
          </div>
          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-400">
            <span className="hover:text-emerald-400 cursor-pointer transition-colors">How it Works</span>
            <span className="hover:text-emerald-400 cursor-pointer transition-colors">Kestra Agents</span>
          </div>
          
          {/* Auth Button Logic */}
          {user ? (
             <div className="flex items-center gap-4">
               <div className="hidden sm:flex flex-col text-right">
                 <span className="text-xs font-bold text-white truncate max-w-[120px]">{user.email}</span>
                 <span className="text-[10px] text-emerald-400">Pro Plan</span>
               </div>
               <button 
                 onClick={handleLogout}
                 className="w-9 h-9 rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center transition-all border border-slate-700"
                 title="Logout"
               >
                 <LogOut className="w-4 h-4" />
               </button>
             </div>
          ) : (
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all"
            >
              Login
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 pointer-events-auto">
        {appState === 'landing' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-6">
                <Zap className="w-3 h-3" /> POWERED BY KESTRA AI AGENTS
              </div>
              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 drop-shadow-2xl">
                Don't just rewrite your resume. <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Dodge the toxic jobs.</span>
              </h1>
              <p className="text-lg text-slate-300 mb-8 leading-relaxed drop-shadow-lg">
                Resume Chameleon analyzes Job Descriptions for red flags and tailors your resume 
                to perfectly match the safe, high-quality roles you actually want.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-1 shadow-2xl">
                <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-rose-400">
                      <Briefcase className="w-4 h-4" /> Job Description
                    </label>
                  </div>
                  <textarea 
                    className="w-full bg-slate-950/50 backdrop-blur-sm border border-slate-800/50 rounded-lg px-4 py-3 focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 text-slate-200 placeholder-slate-500 resize-none flex-grow h-48 text-sm transition-all"
                    placeholder={`e.g. "We are looking for a rockstar developer..."`}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-1 shadow-2xl">
                <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-cyan-400">
                      <FileText className="w-4 h-4" /> Your Resume
                    </label>
                  </div>

                  {/* Text Input */}
                  <textarea 
                    className="w-full bg-slate-950/50 backdrop-blur-sm border border-slate-800/50 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-slate-200 placeholder-slate-500 resize-none flex-grow h-48 text-sm transition-all"
                    placeholder="Paste your resume text here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />

                  {/* PDF Upload Option */}
                  <div className="mt-4 border-t border-slate-700/50 pt-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-cyan-400 mb-3">
                      <Upload className="w-4 h-4" />
                      Or Upload PDF Resume
                    </label>
                    
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      disabled={isExtracting}
                      className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-cyan-600/20 file:text-cyan-400 hover:file:bg-cyan-600/30 disabled:opacity-50"
                    />

                    {resumeFile && (
                      <p className="text-xs text-cyan-400 mt-2">
                        ✓ Selected: {resumeFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center mt-12">
              <div className="flex flex-col items-center w-full">
                <button 
                  onClick={handleAnalyze} 
                  disabled={isExtracting}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-8 py-4 rounded-full font-bold flex items-center gap-2 transition-all shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 transform disabled:hover:scale-100 disabled:shadow-slate-700/30"
                  title={isExtracting ? 'Analysis in progress...' : 'Click to analyze job description and resume'}
                >
                  {isExtracting ? 'Analyzing...' : 'Run Analysis Agent'} <ArrowRight className="w-5 h-5" />
                </button>
                {authError && (
                  <div className="mt-4 text-rose-400 font-semibold text-sm text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                    {authError}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {appState === 'analyzing' && (
          <div className="max-w-2xl mx-auto pt-12 text-center">
             <div className="mb-8 relative inline-block">
               <Cpu className="w-16 h-16 text-emerald-400 animate-pulse" />
               <div className="absolute inset-0 bg-emerald-500/30 blur-xl animate-pulse" />
             </div>
             <h2 className="text-2xl font-bold mb-8">Analyzing with GROQ & Kestra...</h2>
             <div className="space-y-4 text-left">
              {workflowSteps.map((step, index) => (
                <div key={step.id} className={`flex items-center gap-4 p-4 rounded-xl border ${index === workflowStep ? 'bg-slate-800 border-emerald-500/50' : 'border-transparent opacity-50'}`}>
                  {index < workflowStep ? <CheckCircle className="text-emerald-500" /> : <Loader className={index === workflowStep ? "animate-spin text-emerald-400" : ""} />}
                  <span>{step.name}</span>
                </div>
              ))}
             </div>
          </div>
        )}

        {appState === 'results' && analysisData && (
          <div className="pb-20">
            <button onClick={() => setAppState('landing')} className="mb-6 text-sm text-slate-400 hover:text-white flex items-center gap-2">
              <RefreshCcw className="w-4 h-4" /> Start Over
            </button>
            
            <div className="grid lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-emerald-400 flex gap-2 items-center"><ShieldAlert/> Analysis Status</h3>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-200 capitalize">
                      {analysisData.status || 'analysis_complete'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm font-semibold text-emerald-300">
                        <span>Fit Score</span>
                        <span>{analysisData.fitScore ?? 0}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-emerald-500" style={{width: `${analysisData.fitScore ?? 0}%`}} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm font-semibold text-emerald-300">
                        <span>ATS Score</span>
                        <span>{analysisData.atsScore ?? 0}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-emerald-500" style={{width: `${analysisData.atsScore ?? 0}%`}} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm font-semibold text-rose-300">
                        <span>Toxicity Score</span>
                        <span>{analysisData.toxicityScore ?? 0}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-rose-500" style={{width: `${analysisData.toxicityScore ?? 0}%`}} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-rose-300 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Red Flags</h4>
                    {analysisData.redFlags && analysisData.redFlags.length > 0 ? (
                      analysisData.redFlags.map((flag: any, i: number) => (
                        <div key={i} className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg mb-2 text-sm text-rose-300">
                          "{flag.text}" <br/> <span className="opacity-70 text-xs">⚠️ {flag.meaning}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No red flags detected.</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-cyan-300 flex gap-2"><CheckCircle className="w-5 h-5"/> Missing Skills</h3>
                    <span className="text-xs text-slate-400">{analysisData.missingSkills?.length || 0} gaps</span>
                  </div>
                  {analysisData.missingSkills && analysisData.missingSkills.length > 0 ? (
                    <ul className="space-y-2">
                      {analysisData.missingSkills.map((skill: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2 text-sm bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span className="text-slate-100">{skill}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">No missing skills detected. Great fit!</p>
                  )}
                </div>

                {/* Extracted Text Display */}
                {analysisData.extractedText && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-blue-400 flex gap-2"><FileText className="w-5 h-5"/> Extracted Text</h3>
                      {analysisData.extractedText && (
                        <button onClick={() => copyToClipboard(analysisData.extractedText || '')} className="p-2 hover:bg-slate-800 rounded">
                          <Copy className="w-4 h-4"/>
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-800 p-4 rounded-lg max-h-[300px] overflow-y-auto text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
                      {analysisData.extractedText.substring(0, 1000)}
                      {analysisData.extractedText.length > 1000 && <span className="text-slate-500">... (truncated)</span>}
                    </div>
                  </div>
                )}

                {/* Interview Coach */}
                {analysisData.interviewQuestions && analysisData.interviewQuestions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-slate-200 font-bold flex gap-2 items-center">
                      <Sparkles className="w-5 h-5 text-emerald-400"/> Interview Coach
                    </h3>
                    <div className="space-y-2">
                      {analysisData.interviewQuestions.map((q: any, i: number) => (
                        <div
                          key={i}
                          className="border border-slate-700/50 rounded-xl p-3.5 hover:border-emerald-500/40 transition-colors bg-transparent"
                        >
                          <p className="text-slate-100 font-semibold mb-1.5 leading-relaxed">Q: {q.question || q}</p>
                          <p className="text-slate-400 text-sm leading-relaxed">💡 {q.tip || 'Share a concise, outcome-focused answer.'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 self-start">
                 <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold flex items-center gap-2"><FileText className="text-emerald-400"/> AI Summary</h3>
                   <div className="flex gap-2">
                     <button onClick={() => copyToClipboard(analysisData.summary || '')} className="p-2 hover:bg-slate-800 rounded" title="Copy summary">
                       <Copy className="w-4 h-4"/>
                     </button>
                   </div>
                 </div>

                 <div className="space-y-6">
                   <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 text-sm text-slate-200 leading-relaxed">
                     {analysisData.summary && analysisData.summary.trim() 
                       ? analysisData.summary 
                       : 'Summary not available yet.'}
                   </div>

                   <div>
                     <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400"/> Targeted Skills to Emphasize</h4>
                     {analysisData.missingSkills && analysisData.missingSkills.length > 0 ? (
                       <div className="flex flex-wrap gap-2">
                         {analysisData.missingSkills.map((skill: string, idx: number) => (
                           <span key={idx} className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-100">{skill}</span>
                         ))}
                       </div>
                     ) : (
                       <p className="text-sm text-slate-400">We did not detect missing skills. You look well-aligned.</p>
                     )}
                   </div>
                 </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200 pointer-events-auto">
          <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50 rounded-2xl w-full max-w-md p-6 relative shadow-2xl shadow-emerald-500/20 pointer-events-auto">
            <button 
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-emerald-500/20 backdrop-blur-sm rounded-xl flex items-center justify-center mx-auto mb-4 text-emerald-400 border border-emerald-500/30">
                <User className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">
                {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
              </h3>
              <p className="text-sm text-slate-400 mt-2">
                {authMode === 'signin' ? 'Sign in to access your resumes.' : 'Get started with Resume Chameleon.'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                  <Mail className="w-3 h-3"/> Email Address
                </label>
                <input 
                  name="email"
                  type="email" 
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                  <Lock className="w-3 h-3"/> Password
                </label>
                <input 
                  name="password"
                  type="password" 
                  required
                  minLength={6}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
              
              {authError && (
                <div className="text-rose-400 text-xs text-center bg-rose-500/10 p-2 rounded">
                  {authError}
                </div>
              )}

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {authLoading ? <Loader className="w-4 h-4 animate-spin"/> : (authMode === 'signin' ? 'Sign In' : 'Sign Up')}
              </button>
            </form>
            
            <div className="text-center mt-6">
              <button 
                onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                className="text-xs text-slate-500 hover:text-emerald-400 transition-colors underline"
              >
                {authMode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default App;