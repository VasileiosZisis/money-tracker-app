import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  () => NextResponse.next(),
  {
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: [
    "/setup/:path*",
    "/dashboard/:path*",
    "/transactions/:path*",
    "/insights/:path*",
    "/categories/:path*",
    "/planned/:path*",
    "/planned-income/:path*",
    "/settings/:path*",
  ],
};
