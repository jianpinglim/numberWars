import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://fdedumturuxtmjddxmtg.supabase.co'
// Use anon key directly for client-side code
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZWR1bXR1cnV4dG1qZGR4bXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczNDg5MDAsImV4cCI6MjA1MjkyNDkwMH0.A2PZ-vCl7XPLMZfcUKUM44r36EKDuX4yg2Rwmx0YqVM'

export const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
})

// Add error handling
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        console.log('User signed out')
    }
})