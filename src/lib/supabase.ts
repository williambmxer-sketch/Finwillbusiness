import { createClient } from '@supabase/supabase-js';

// We fall back to empty strings if not provided yet, so the app won't crash 
// before the user configures the .env.local file.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
