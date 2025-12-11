import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Upload and storage endpoint (fast return)
 * 
 * Flow:
 * 1. Validate inputs (job description, resume file or text, user auth)
 * 2. Upload resume PDF to Supabase Storage (if provided)
 * 3. Extract text from PDF and groq analysis via Kestra  (if file provided)
 * 4. Store job description + resume text in analyses table with status='processing'
 * 5. Return analysisId to frontend for polling
 * 
 * NOTE: groq analysis happens in /api/analyze-poll when text is extracted
 * 
 * Request body:
 * {
 *   jobDescription: string (required)
 *   resumeFile?: string (base64 encoded PDF)
 *   resumeText?: string (direct text input)
 *   resumeFileName?: string (original filename for storage)
 * }
 * 
 * Response:
 * {
 *   success: boolean
 *   analysisId: string (UUID, used for polling)
 *   message: string
 * }
 */

type ResponseData = {
  success?: boolean;
  analysisId?: string;
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

  const { jobDescription, resumeFile, resumeText, resumeFileName } = req.body;
  const userId = req.headers['x-user-id'] as string;
  const userEmail = req.headers['x-user-email'] as string;

  // ========== VALIDATION ==========
  if (!jobDescription?.trim()) {
    return res.status(400).json({ error: 'Job description is required' });
  }

  if (!resumeFile && !resumeText) {
    return res.status(400).json({ error: 'Either resumeFile or resumeText is required' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'User ID is required. User must be logged in.' });
  }

  if (!userEmail) {
    return res.status(400).json({ error: 'User email is required.' });
  }

  try {
    // ========== SUPABASE SETUP ==========
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // ========== STEP 0: ENSURE USER PROFILE EXISTS ==========
    // Using the service role key bypasses RLS, so we can safely upsert the profile.
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({ id: userId, email: userEmail }, { onConflict: 'id' });

    if (profileError) {
      throw new Error(`Failed to upsert user profile: ${profileError.message}`);
    }

    // ========== STEP 1: HANDLE RESUME (FILE OR TEXT) ==========
    let finalResumeText = resumeText || '';
    let resumeFilePath: string | null = null;

    if (resumeFile) {
      try {
        console.log('📄 Starting PDF upload...');
        
        // Decode base64 file
        const buffer = Buffer.from(resumeFile, 'base64');
        const fileName = `${userId}/${Date.now()}-${resumeFileName || 'resume.pdf'}`;

        console.log(`Uploading to: resumes/${fileName}`);

        // Upload to Storage with retry logic
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, buffer, { 
            contentType: 'application/pdf',
            upsert: false 
          });

        if (uploadError) {
          console.error('❌ Upload error:', uploadError);
          
          // Check if bucket doesn't exist
          if (uploadError.message?.includes('Bucket not found')) {
            throw new Error('Storage bucket "resumes" not configured. Please go to Supabase Storage and create a bucket named "resumes". Instructions: https://supabase.com/docs/guides/storage/buckets/create');
          }
          
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        console.log('✅ PDF uploaded successfully:', uploadData);
        resumeFilePath = fileName;

        // Try Kestra extraction if configured
        const kestraApiUrl = process.env.KESTRA_API_URL || 'http://localhost:8080';
        const kestraToken = process.env.KESTRA_API_TOKEN;

        if (kestraToken && kestraToken !== 'your-token') {
          try {
            console.log('🔄 Triggering Kestra extraction...');
            const kestraResponse = await fetch(`${kestraApiUrl}/api/v1/executions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${kestraToken}`,
              },
              body: JSON.stringify({
                namespace: 'resume',
                flowId: 'extract-pdf-text',
                inputs: { file_path: fileName, user_id: userId },
              }),
            });

            if (kestraResponse.ok) {
              console.log('✅ Kestra workflow started');
              
              // Poll for extraction (max 2 minutes)
              let extractedText = '';
              let attempts = 0;
              const maxAttempts = 60;

              while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                attempts++;

                try {
                  const statusResponse = await fetch(
                    `${supabaseUrl}/storage/v1/object/public/resumes/${fileName.replace('.pdf', '.txt')}`,
                    {
                      headers: {
                        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                      },
                    }
                  );

                  if (statusResponse.ok) {
                    extractedText = await statusResponse.text();
                    finalResumeText = extractedText;
                    console.log('✅ PDF text extracted');
                    break;
                  }
                } catch (pollError) {
                  console.log(`⏳ Polling attempt ${attempts}/${maxAttempts}...`);
                }
              }

              if (!finalResumeText && extractedText) {
                finalResumeText = extractedText;
              }
            } else {
              console.log('⚠️ Kestra not available, using PDF as-is');
            }
          } catch (kestraError) {
            console.log('⚠️ Kestra extraction skipped:', kestraError instanceof Error ? kestraError.message : 'Unknown error');
          }
        } else {
          console.log('⚠️ Kestra not configured, PDF uploaded but text extraction skipped');
        }
      } catch (fileError) {
        console.error('❌ File processing error:', fileError);
        throw fileError;
      }
    }

    // ========== STEP 2: SAVE TO ANALYSES TABLE ==========
    console.log('💾 Saving analysis record to database...');
    
    const insertPayload = {
      user_id: userId,
      job_description: jobDescription.trim(),
      resume_text: finalResumeText.trim(),
      resume_file_path: resumeFilePath,
      status: 'processing',
    };

    console.log('Insert payload:', { ...insertPayload, resume_text: `[${insertPayload.resume_text.length} chars]` });

    const { data: analysisRecord, error: insertError } = await supabase
      .from('analyses')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    const analysisId = analysisRecord?.id;
    console.log('✅ Record created:', analysisId);

    // ========== STEP 3: TRIGGER KESTRA WORKFLOW ==========
    const kestraApiUrl = process.env.KESTRA_API_URL || 'http://localhost:8080';
    const kestraToken = process.env.KESTRA_API_TOKEN;

    if (kestraToken && kestraToken !== 'temp_placeholder_for_now' && kestraToken !== 'your-token') {
      try {
        console.log('🚀 Triggering Kestra workflow...');
        const kestraResponse = await fetch(`${kestraApiUrl}/api/v1/executions/resume/analyze-resume`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${kestraToken}`,
          },
          body: JSON.stringify({
            inputs: {
              analysis_id: analysisId,
            },
          }),
        });

        if (!kestraResponse.ok) {
          const errorText = await kestraResponse.text();
          console.error('❌ Kestra trigger failed:', kestraResponse.status, errorText);
          throw new Error(`Kestra workflow trigger failed: ${kestraResponse.status}`);
        }

        const kestraData = await kestraResponse.json();
        console.log('✅ Kestra workflow triggered:', kestraData.id);
      } catch (kestraError) {
        console.error('⚠️ Kestra trigger error:', kestraError);
        // Don't fail the whole request - frontend can still poll
      }
    } else {
      console.log('⚠️ Kestra not configured (missing or placeholder token), skipping workflow trigger');
    }

    // ========== STEP 4: RETURN ANALYSIS ID ==========
    // Frontend polls Supabase to fetch results once Kestra completes
    console.log('🎉 SUCCESS: Record created, Kestra will process it');
    return res.status(200).json({
      success: true,
      analysisId,
      message: 'Resume and job description saved. Kestra is processing...',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ ANALYSIS FAILED:', errorMsg);

    return res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
}
