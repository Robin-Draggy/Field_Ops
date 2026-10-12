import { registerUser } from "@/lib/services/auth.service";
import { registerSchema } from "@/lib/validators/auth.validator";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const input = registerSchema.parse(body);

    const result = await registerUser(input);

    return NextResponse.json(
      {
        message: "Account created successfully",
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
        },
      },
      { status: 201 },
    );
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

    if (error instanceof Error) {
      if (
        error.message === "A user with this email already exists." ||
        error.message === "This organization slug is already taken."
      ) {
        return NextResponse.json({ message: error.message }, { status: 409 });
      }
    }

    console.error("Registration failed:", error);

    return NextResponse.json(
        { message: "An unexpected error occurred." },
        { status: 500 },
    )
  }
}
