import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vatzhkiggebkhyltcyst.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SPFMC92ZAKFR1wmIUPpLNw_fXRNDK-D";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Explicites plutôt qu'implicites : la session survit à la fermeture de
    // l'application, et se renouvelle d'elle-même sans redemander les
    // identifiants tant que le membre ne s'est pas déconnecté lui-même.
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "mephda-auth",
  },
});