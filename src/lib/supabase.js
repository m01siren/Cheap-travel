import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ixlwzdjmyydazkqeveav.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_fiXbZ7aEQMFlZKk2Yug0-g_FFgxoCLK'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
