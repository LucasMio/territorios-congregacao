import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chavePublica = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** false quando o .env.local ainda não tem as chaves do Supabase. */
export const configurado = Boolean(url && chavePublica);

export const supabase = configurado ? createClient(url, chavePublica) : null;
