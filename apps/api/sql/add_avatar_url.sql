    -- Supabase SQL editor: profile photos for Settings
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
