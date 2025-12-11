-- Create analyses table to store job description + resume + analysis results
CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Input data
  job_description TEXT NOT NULL,
  resume_text TEXT NOT NULL,
  resume_file_path VARCHAR(500),
  
  -- Analysis results (from groq)
  toxicity_score INTEGER,
  red_flags JSONB,
  fit_score INTEGER,
  summary TEXT,
  missing_skills TEXT[],
  ai_response JSONB
  
  -- Interview prep (optional)
  interview_questions JSONB,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, error
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Users can view their own analyses"
  ON analyses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analyses"
  ON analyses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses"
  ON analyses FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses"
  ON analyses FOR DELETE USING (auth.uid() = user_id);

-- RLS Policy for service role (Kestra backend updates)
CREATE POLICY "Service role can update all analyses"
  ON analyses FOR UPDATE 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can select all analyses"
  ON analyses FOR SELECT 
  USING (auth.role() = 'service_role');

-- Create index for faster queries
CREATE INDEX analyses_user_id_idx ON analyses(user_id);
CREATE INDEX analyses_created_at_idx ON analyses(created_at DESC);
