import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://vamjnhyqolespeubjsuv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhbWpuaHlxb2xlc3BldWJqc3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDQ5NDAsImV4cCI6MjA5NzMyMDk0MH0.eYek86j3KUhxWY94p9rsYtfTOckeS0jrgn0zYy6cSsA';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
