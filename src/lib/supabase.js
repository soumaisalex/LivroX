import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://yixaqvvdoedjjsmlpzui.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_Km9FNh0Y-I9A-X7cZhWmeA_RH1B3eJg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
