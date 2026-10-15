// src/config/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxubugzeocfstuiysbmx.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_-O0ygIybdytkAp1JJomcOQ_BH3eaHlO';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const getAudioUrl = (fileName) => {
  const { data } = supabase.storage.from('audio').getPublicUrl(fileName);
  return data?.publicUrl || null;
};