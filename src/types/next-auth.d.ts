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
    id: string;
    role: Role;
    teamId: string | null;
  }
}
