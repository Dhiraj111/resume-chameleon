import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { mapAnalysis } from '@/lib/utils';

interface ResponseData {
  success: boolean;
  analysis?: any;
  error?: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'User ID is required' });
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

    // Latest analysis for this user
    const { data: analysisRow, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!analysisRow) {
      return res
        .status(200)
        .json({ success: true, analysis: null, message: 'No analyses found' });
    }

    // Log the raw data for debugging
    console.log('📊 Raw analysis row from Supabase:', {
      status: analysisRow.status,
      toxicity_score: analysisRow.toxicity_score,
      fit_score: analysisRow.fit_score,
      red_flags: analysisRow.red_flags,
      missing_skills: analysisRow.missing_skills,
      ai_response: analysisRow.ai_response,
      summary: analysisRow.summary?.substring(0, 50),
    });

    const analysis = mapAnalysis(analysisRow);

    return res.status(200).json({ success: true, analysis });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unexpected error';
    console.error('❌ analyses fetch failed:', errorMsg);
    return res.status(500).json({ success: false, error: errorMsg });
  }
}
