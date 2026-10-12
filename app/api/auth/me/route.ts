
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { message: "Not authenticated." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    });
  } catch (error) {
    console.error("Session lookup failed:", error);

    return NextResponse.json(
      { message: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}