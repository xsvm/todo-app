import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : (null as unknown as ReturnType<typeof createClient>)

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY)
} 