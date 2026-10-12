import { loginUser } from "@/lib/services/auth.service";
import { loginSchema } from "@/lib/validators/auth.validator";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const input = loginSchema.parse(body);

    const result = await loginUser(input);

    return NextResponse.json({
      message: "Logged in successful",
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "Validation failed.",
          errors: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          message: "Invalid JSON body.",
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Invalid email or password."
    ) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 },
      );
    }

    console.error("Login failed:", error);

    return NextResponse.json(
      { message: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}



