import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://cvdzsijdrrwfmufhigpe.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_Q0--F1B26kpn3MC7-cDbSA_HSIsoIWr';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
