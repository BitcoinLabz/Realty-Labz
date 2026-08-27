import type { Role } from "@/generated/prisma/enums";

declare module "@auth/core/types" {
  interface User {
    id: string;
    role: Role;
    teamId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      teamId: string | null;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    // Millisecond timestamp of the last database re-read of role/teamId.
    // See the jwt callback in src/auth.ts.
    refreshedAt?: number;
    id: string;
    role: Role;
    teamId: string | null;
  }
}
