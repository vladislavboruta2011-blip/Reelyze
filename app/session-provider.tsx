"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toSessionUser, type SessionUser } from "../lib/session-user";
import { supabaseBrowser } from "../lib/supabase/browser";

export type { SessionUser } from "../lib/session-user";

type SessionContextValue = {
  user: SessionUser | null;
  isSessionReady: boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);

  // The server already resolved the session before this ever rendered, so
  // there is no client-side loading flash to represent here — this stays
  // true for the lifetime of the provider.
  const isSessionReady = true;

  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setUser(toSessionUser(session?.user ?? null));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ user, isSessionReady }),
    [user, isSessionReady]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (context === null) {
    throw new Error("useSession must be used within SessionProvider");
  }

  return context;
}
