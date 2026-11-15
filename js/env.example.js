/**
 * Copy to js/env.js (git-ignored) for local use. On GitHub Pages the deploy
 * workflow writes js/env.js from repository secrets.
 *
 * Only the anon / publishable key goes here. The service-role key must never
 * appear anywhere in this folder.
 */
export const ENV = {
  supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  supabaseAnonKey: 'YOUR-ANON-PUBLIC-KEY'
};
