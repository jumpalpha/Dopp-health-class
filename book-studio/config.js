// Book Studio public configuration.
//
// These two values are PUBLIC by design (Supabase's anon key is meant to ship in
// browser code). They grant nothing on their own: every bs_* table, function and
// storage bucket denies access unless the caller is the signed-in listed owner.
//
// NEVER put a service_role key, database password, AI API key, or any
// manuscript text in this file — this folder is served publicly by GitHub Pages.
//
// Backend: the worst-songs Supabase project (shared; Book Studio objects are
// all bs_-prefixed). Never the dopp-health-class (student) project.
window.BOOK_STUDIO_CONFIG = {
  supabaseUrl: 'https://vvjgriwldvnqnlgzvnvs.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2amdyaXdsZHZucW5sZ3p2bnZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwOTg2NDQsImV4cCI6MjEwNzY3NDY0NH0.gz4UPTSQ7Ybn0YkqsY6lkRapLReQPJAk3E3ym71QsA8',
  idleLockMinutes: 30,
};
