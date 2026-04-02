import { createClient } from '@supabase/supabase-js'
import { getEnv } from './env.js'

const supabaseUrl = getEnv('VITE_SUPABASE_URL').replace(/\/$/, '')
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY')

export const SUPABASE_CONFIG_ERROR =
  !supabaseUrl || !supabaseAnonKey
    ? 'Не настроены переменные окружения VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY в окружении деплоя.'
    : ''

function createStubResultBuilder(error) {
  const result = { data: [], error }
  const singleResult = { data: null, error }
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    delete: () => builder,
    upsert: () => builder,
    insert: () => builder,
    maybeSingle: () => ({
      then: (resolve) => Promise.resolve(resolve(singleResult)),
    }),
    then: (resolve) => Promise.resolve(resolve(result)),
  }
  return builder
}

function createStubClient(message) {
  const error = new Error(message)
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      setSession: async () => ({ data: null, error }),
      signOut: async () => ({ error }),
    },
    from: () => createStubResultBuilder(error),
  }
}

export const supabase = SUPABASE_CONFIG_ERROR
  ? createStubClient(SUPABASE_CONFIG_ERROR)
  : createClient(supabaseUrl, supabaseAnonKey)
