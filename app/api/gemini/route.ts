import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Access key securely from server environment
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API Key missing on server' }, { status: 500 });
  }

  try {
    const { prompt } = await request.json();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
      }
    );

    const data = await response.json();
    
    // Extract the text part
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Parse it if it's a stringified JSON, otherwise return as is
    let cleanData;
    try {
        cleanData = JSON.parse(textResponse);
    } catch (e) {
        cleanData = textResponse;
    }

    return NextResponse.json(cleanData);

  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}