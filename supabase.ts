import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jzaooaphvihbsmzztqma.supabase.co';
const SUPABASE_ANON = 'sb_publishable___vvRhAzQc54RBUbOGFHyA_V3KckDw3';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);