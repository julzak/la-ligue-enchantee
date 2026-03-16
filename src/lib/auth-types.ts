import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      userId: number;
      name: string;
      email: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: number;
  }
}
