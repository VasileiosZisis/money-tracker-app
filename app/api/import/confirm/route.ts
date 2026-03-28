import { getUserIdOrThrow } from "@/lib/auth/session";
import { confirmImportForUser } from "@/lib/import/server";
import { type ConfirmImportInput } from "@/lib/validators/import";

export async function POST(request: Request) {
  try {
    const userId = await getUserIdOrThrow();
    const input = (await request.json()) as ConfirmImportInput;
    const result = await confirmImportForUser(userId, input);

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
