import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mbmxqpzbxsmbxkqfbgwa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ibXhxcHpieHNtYnhrcWZiZ3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDE2NjksImV4cCI6MjA5NTIxNzY2OX0.SZh3dNEeda3D1U0GK7BDkG5PbAH2FUv1UtB81NqWetI'

export const supabase = createClient(supabaseUrl, supabaseKey)