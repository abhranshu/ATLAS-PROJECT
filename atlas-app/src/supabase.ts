import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eozbnwmloenlldmbeedm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvemJud21sb2VubGxkbWJlZWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzI0NDEsImV4cCI6MjA4ODkwODQ0MX0.swXiDxJzbfhmAD4lwbwQm2eh49n4A_G8bcF72COIKPY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
