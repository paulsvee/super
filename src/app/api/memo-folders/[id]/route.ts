import { NextRequest, NextResponse } from "next/server";
import { updateFolder, deleteFolder } from "@/lib/memo-db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name } = await req.json();
    if (name) updateFolder(params.id, name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    deleteFolder(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
