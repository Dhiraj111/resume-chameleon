import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { file } = req.query;

  if (!file || typeof file !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid file parameter' });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ 
        error: 'Supabase is not configured' 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to download extracted text file from storage
    // File should be named: file_path.txt (e.g., user_id/timestamp-filename.pdf.txt)
    const textFilePath = `${file}.txt`;

    const { data, error } = await supabase.storage
      .from('resumes')
      .download(textFilePath);

    if (error) {
      // File may not be ready yet
      console.log(`File not ready yet: ${textFilePath}`, error.message);
      return res.status(202).json({
        extracted_text: null,
        status: 'processing',
        message: 'Extraction in progress...',
      });
    }

    // Convert blob to text
    const text = await data.text();

    res.status(200).json({
      extracted_text: text,
      status: 'completed',
      file: textFilePath,
    });
  } catch (error) {
    console.error('Error fetching resume text:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
