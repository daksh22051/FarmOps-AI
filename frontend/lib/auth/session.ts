import { createClient } from "../supabase/client";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Retrieves the current Supabase auth session.
 */
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return null;
    }
    return data.session;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current active JWT access token for Bearer authorization.
 * Never logs or prints the token.
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.access_token || null;
}

/**
 * Retrieves the currently authenticated Supabase user.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return null;
    }
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Signs out the current user and clears active sessions.
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}
