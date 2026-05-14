import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Create client only if env vars are available, otherwise create a dummy client
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

export function getSessionId(): string {
  let id = sessionStorage.getItem('veyron_session_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('veyron_session_id', id);
  }
  return id;
}
