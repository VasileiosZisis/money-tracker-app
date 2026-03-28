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
    "/categories/:path*",
    "/planned/:path*",
    "/import/:path*",
    "/export/:path*",
  ],
};
