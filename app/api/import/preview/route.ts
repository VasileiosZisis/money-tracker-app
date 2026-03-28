import { getUserIdOrThrow } from "@/lib/auth/session";
import { previewImportForUser } from "@/lib/import/server";

export async function POST(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const formData = await request.formData();
    const result = await previewImportForUser(userId, formData);

    return Response.json(result, {
      status: result.ok ? 200 : 400,
    });
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }
}
