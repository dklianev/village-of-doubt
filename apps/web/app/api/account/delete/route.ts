import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type DeleteUserApi = {
  deleteUser?: (input: { headers: Headers; body?: { callbackURL?: string } }) => Promise<unknown>;
};

export async function POST() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не си влязъл." }, { status: 401 });
  }

  const deleteUser = (auth.api as DeleteUserApi).deleteUser;
  if (!deleteUser) {
    return NextResponse.json({ error: "Изтриването на профил не е налично." }, { status: 501 });
  }

  try {
    await deleteUser({ headers: requestHeaders, body: { callbackURL: "/" } });
  } catch (error) {
    console.error("[account-delete]", error);
    return NextResponse.json({ error: "Не успяхме да изтрием профила." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
