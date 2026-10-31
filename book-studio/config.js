// Book Studio public configuration.
//
// These two values are PUBLIC by design (Supabase's "publishable"/anon key is
// meant to ship in browser code). They grant nothing on their own: every table,
// function and storage bucket in the Book Studio project denies access unless
// the caller is the listed owner with a completed 2FA sign-in.
//
// NEVER put a service_role key, database password, AI API key, or any
// manuscript text in this file — this folder is served publicly by GitHub Pages.
//
// Left blank until the dedicated Book Studio Supabase project is created
// and the owner approves going live (see _book-studio-backend/docs/SETUP.md).
window.BOOK_STUDIO_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://<book-studio-project-ref>.supabase.co'  (NOT the class project)
  supabaseAnonKey: '',  // the Book Studio project's publishable / anon key
  idleLockMinutes: 30,
};
