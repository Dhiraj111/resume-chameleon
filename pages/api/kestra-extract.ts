import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { file_path, user_id } = req.body;

  if (!file_path || !user_id) {
    return res.status(400).json({ error: 'Missing required fields: file_path, user_id' });
  }

  try {
    // TODO: Update with your actual Kestra API URL and token
    const kestraApiUrl = process.env.KESTRA_API_URL || 'http://localhost:8080';
    const kestraToken = process.env.KESTRA_API_TOKEN;

    if (!kestraToken) {
      console.error('KESTRA_API_TOKEN is not set in environment variables');
      return res.status(500).json({ 
        error: 'Kestra is not configured. Set KESTRA_API_TOKEN in .env.local' 
      });
    }

    // Call Kestra API to start workflow
    const kestraResponse = await fetch(
      `${kestraApiUrl}/api/v1/executions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kestraToken}`,
        },
        body: JSON.stringify({
          namespace: 'resume',
          flowId: 'extract-pdf-text',
          inputs: {
            file_path,
            user_id,
          },
        }),
      }
    );

    if (!kestraResponse.ok) {
      const errorData = await kestraResponse.text();
      console.error('Kestra API error:', errorData);
      throw new Error(`Kestra API error: ${kestraResponse.statusText}`);
    }

    const kestraData = await kestraResponse.json();

    res.status(200).json({
      success: true,
      job_id: kestraData.id,
      message: 'PDF extraction job started',
    });
  } catch (error) {
    console.error('Kestra error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
