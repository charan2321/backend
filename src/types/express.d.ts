declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      role: "user" | "admin";
      email: string;
    };
  }
}
