import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
if (!supabaseUrl) throw new Error('Set VITE_SUPABASE_URL in .env')

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!supabaseAnonKey) throw new Error('Set VITE_SUPABASE_ANON_KEY in .env')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
