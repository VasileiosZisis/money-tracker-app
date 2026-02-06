import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/setup/:path*",
    "/dashboard/:path*",
    "/transactions/:path*",
    "/categories/:path*",
    "/export/:path*",
  ],
};
