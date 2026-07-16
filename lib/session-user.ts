import type { User } from "@supabase/supabase-js";

// Deliberately narrow — only what the UI needs to render a signed-in
// state, never the full Supabase User object. Shared by the server-side
// initial fetch (app/layout.tsx) and the client-side auth-state listener
// (app/session-provider.tsx) so both agree on the same shape.
export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export function toSessionUser(user: User | null): SessionUser | null {
  if (!user) {
    return null;
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  const name =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : null;

  const avatarUrl =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : null;

  return {
    id: user.id,
    email: user.email ?? null,
    name,
    avatarUrl,
  };
}
