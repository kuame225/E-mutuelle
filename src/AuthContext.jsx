import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [roles, setRoles] = useState([]);
  const [isExploitant, setIsExploitant] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setRoles([]);
      setIsExploitant(false);
      return;
    }

    supabase
      .from("roles_admin")
      .select("role")
      .eq("user_id", session.user.id)
      .then(({ data, error }) => {
        if (!error && data) setRoles(data.map((r) => r.role));
      });

    // Un exploitant n'appartient à aucune organisation : c'est une table à
    // part, distincte de roles_admin, qui reste toujours scopée à une
    // mutuelle précise.
    supabase
      .from("exploitants")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error) setIsExploitant(Boolean(data));
      });
  }, [session]);

  async function signInWithEmail(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signUpWithEmail(email, password) {
    return supabase.auth.signUp({ email, password });
  }

  async function signInWithPhone(phone) {
    return supabase.auth.signInWithOtp({ phone });
  }

  async function verifyPhoneOtp(phone, token) {
    return supabase.auth.verifyOtp({ phone, token, type: "sms" });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const hasRole = (role) => roles.includes(role);
  const isAdmin = roles.length > 0;

  return (
    <AuthContext.Provider
      value={{
        session, roles, loading, hasRole, isAdmin, isExploitant,
        signInWithEmail, signUpWithEmail, signInWithPhone, verifyPhoneOtp, signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}