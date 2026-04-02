import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://tjqshwzelrqfzplubgps.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_WR30mxi261lXGCqQ9ksCvw_0qJu7GTM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);