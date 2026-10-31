// src/config/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const getAudioUrl = (fileName) => {
  const { data } = supabase.storage.from('audio').getPublicUrl(fileName);
  return data?.publicUrl || null;
};