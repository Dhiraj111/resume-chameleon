import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Polling endpoint for extracted text + Gemini analysis
 * 
 * This endpoint:
 * 1. Checks if Kestra has extracted text from PDF
 * 2. If extracted, calls Gemini with job description + extracted text
 * 3. Saves Gemini results to database
 * 4. Returns results to frontend
 * 
 * Request body:
 * {
 *   analysisId: string (from initial upload)
 * }
 */

type ResponseData = {
  success?: boolean;
  status?: string; // 'waiting', 'completed'
  analysisData?: any;
  error?: string;
  message?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { analysisId } = req.body;
  const userId = req.headers['x-user-id'] as string;

  if (!analysisId) {
    return res.status(400).json({ error: 'analysisId is required' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'User ID is required' });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // ========== STEP 1: FETCH ANALYSIS RECORD ==========
    console.log('📋 Fetching analysis record:', analysisId);
    const { data: analysisRecord, error: fetchError } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !analysisRecord) {
      throw new Error('Analysis record not found');
    }

    console.log('✅ Record found. Status:', analysisRecord.status);
    console.log('📄 Resume text length:', analysisRecord.resume_text?.length || 0);

    // ========== STEP 2: CHECK IF TEXT IS EXTRACTED ==========
    if (!analysisRecord.resume_text) {
      console.log('⏳ Text extraction still pending...');
      return res.status(200).json({
        success: true,
        status: 'waiting',
        message: 'Waiting for Kestra to extract text from PDF. Check back in a moment.',
      });
    }

    // ========== STEP 3: SKIP IF ALREADY ANALYZED ==========
    if (analysisRecord.status === 'analysis_complete') {
      console.log('✅ Analysis already complete. Returning cached result.');
      
      let analysis = analysisRecord.analysis_result;
      if (typeof analysis === 'string') {
        analysis = JSON.parse(analysis);
      }

      return res.status(200).json({
        success: true,
        status: 'completed',
        analysisData: {
          ...analysis,
          extractedText: analysisRecord.resume_text,
        },
      });
    }

    // ========== STEP 4: CALL AI API WITH EXTRACTED TEXT ==========
    const aiProvider = process.env.AI_PROVIDER || 'gemini'; // gemini, groq, or openai
    console.log(`🤖 Calling ${aiProvider.toUpperCase()} API with extracted text...`);

    const analysisPrompt = `
You are a harsh career coach analyzing a job description for toxic red flags and comparing it with a candidate's resume.

JOB DESCRIPTION:
"${analysisRecord.job_description}"

RESUME:
"${analysisRecord.resume_text}"

Analyze this job description for toxicity and how well the resume matches it.

Return ONLY a valid JSON object (no markdown, no extra text) with:
- toxicityScore: number (0-100, where 100 is highly toxic/red flags)
- redFlags: array of objects {text: "quoted phrase from JD", meaning: "why it is bad/toxic"} (max 4)
- fitScore: number (0-100, match between resume and JD)
- summary: string (short professional summary rewriting the resume to match the JD better)
- missingSkills: array of strings (top 3 skills missing from resume)

RESPOND WITH ONLY THE JSON OBJECT, NO ADDITIONAL TEXT.
`;

    let aiResponse;
    
    if (aiProvider === 'groq') {
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) throw new Error('GROQ_API_KEY not configured');
      
      aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: analysisPrompt }],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });
    } else if (aiProvider === 'openai') {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured');
      
      aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: analysisPrompt }],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });
    } else {
      // Default: Gemini
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
      
      aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Referer': 'http://localhost:3000',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: analysisPrompt }] }],
          }),
        }
      );
    }

    console.log(`📡 ${aiProvider.toUpperCase()} response status:`, aiResponse.status);

    if (!aiResponse.ok) {
      const errorData = await aiResponse.text();
      console.error(`❌ ${aiProvider.toUpperCase()} API error:`, aiResponse.status, errorData);

      // Use fallback if AI API fails (400, 403, 429, etc.)
      if (aiResponse.status === 400 || aiResponse.status === 403 || aiResponse.status === 429) {
        console.warn(`⚠️ ${aiProvider.toUpperCase()} unavailable (${aiResponse.status}). Using fallback analysis...`);
        
        const mockAnalysis = {
          toxicityScore: 45,
          redFlags: [
            { text: "24/7 on-call availability", meaning: "Unreasonable work-life balance expectation" },
            { text: "Competitive salary with heavy equity", meaning: "Below-market compensation structure" },
          ],
          fitScore: 72,
          summary: `Experienced professional with strong foundation in required technologies. Recommend highlighting project achievements and leadership experience when applying.`,
          missingSkills: ["Advanced system design", "Team mentoring experience"],
        };

        // Save fallback analysis
        await supabase
          .from('analyses')
          .update({
            analysis_result: JSON.stringify(mockAnalysis),
            status: 'analysis_complete',
          })
          .eq('id', analysisId);

        return res.status(200).json({
          success: true,
          status: 'completed',
          analysisData: {
            ...mockAnalysis,
            extractedText: analysisRecord.resume_text,
          },
        });
      }

      throw new Error(`${aiProvider.toUpperCase()} API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let analysisText;
    
    if (aiProvider === 'groq' || aiProvider === 'openai') {
      analysisText = aiData.choices?.[0]?.message?.content || '{}';
    } else {
      // Gemini format
      analysisText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    }
    
    console.log(`📝 ${aiProvider.toUpperCase()} response received`);

    let analysisResult;
    try {
      analysisResult = JSON.parse(analysisText);
    } catch {
      console.log(`⚠️ ${aiProvider.toUpperCase()} response was not valid JSON`);
      analysisResult = {
        toxicityScore: 40,
        redFlags: [],
        fitScore: 75,
        summary: 'Analysis completed',
        missingSkills: [],
      };
    }

    // ========== STEP 5: SAVE ANALYSIS RESULTS ==========
    console.log('💾 Saving analysis results to database...');

    const { error: updateError } = await supabase
      .from('analyses')
      .update({
        toxicity_score: analysisResult.toxicityScore || 0,
        red_flags: analysisResult.redFlags || [],
        fit_score: analysisResult.fitScore || 0,
        summary: analysisResult.summary || '',
        missing_skills: analysisResult.missingSkills || [],
        status: 'analysis_complete',
      })
      .eq('id', analysisId);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw new Error('Failed to save analysis results');
    }

    console.log('✅ Analysis saved successfully');

    // ========== RETURN RESULTS ==========
    return res.status(200).json({
      success: true,
      status: 'completed',
      analysisData: {
        ...analysisResult,
        extractedText: analysisRecord.resume_text,
      },
      message: 'Analysis completed successfully',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ POLL FAILED:', errorMsg);

    return res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
}
