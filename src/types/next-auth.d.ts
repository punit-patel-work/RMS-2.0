import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    role: 'OWNER' | 'SUPERVISOR' | 'FLOOR_STAFF' | 'KITCHEN_STAFF';
  }

  interface Session {
    user: {
      id: string;
      name: string | null;
      role: 'OWNER' | 'SUPERVISOR' | 'FLOOR_STAFF' | 'KITCHEN_STAFF';
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: 'OWNER' | 'SUPERVISOR' | 'FLOOR_STAFF' | 'KITCHEN_STAFF';
  }
}
