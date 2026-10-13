
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { getOrganizationContext } from "@/lib/auth/organization";
import { prisma } from "@/lib/db/prisma";
import { createServiceSchema } from "@/lib/validators/service.validator";

type RouteContext = {
  params: Promise<{ slug: string }>;
};


function authorizationError(reason: string) {
  const status =
    reason === "UNAUTHENTICATED"
      ? 401
      : reason === "ORGANIZATION_NOT_FOUND"
        ? 404
        : 403;

  const message =
    reason === "UNAUTHENTICATED"
      ? "Authentication required."
      : reason === "ORGANIZATION_NOT_FOUND"
        ? "Organization not found."
        : "You are not a member of this organization.";

  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

function handleUnexpectedError(error: unknown, operation: string) {
  console.error(`Service ${operation} error:`, error);

  return NextResponse.json(
    { success: false, message: "An unexpected error occurred." },
    { status: 500 }
  );
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { slug } = await params;

    const context = await getOrganizationContext(slug);

    if (!context.ok) {
      return authorizationError(context.reason);
    }

    const services = await prisma.service.findMany({
      where: {
        organizationId: context.organization.id,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        basePrice: true,
        estimatedDuration: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: services,
    });
  } catch (error) {
    return handleUnexpectedError(error, "list");
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { slug } = await params;

    const context = await getOrganizationContext(slug);

    if (!context.ok) {
      return authorizationError(context.reason);
    }

    const body: unknown = await request.json();
    const input = createServiceSchema.parse(body);

    const service = await prisma.service.create({
      data: {
        organizationId: context.organization.id,
        name: input.name,
        description: input.description ?? null,
        basePrice: input.basePrice,
        estimatedDuration: input.estimatedDuration,
      },
      select: {
        id: true,
        name: true,
        description: true,
        basePrice: true,
        estimatedDuration: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Service created successfully.",
        data: service,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed.",
          errors: error.issues,
        },
        { status: 400 }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body." },
        { status: 400 }
      );
    }

    // Prisma P2002 means a unique constraint was violated.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A service with this name already exists.",
        },
        { status: 409 }
      );
    }

    return handleUnexpectedError(error, "create");
  }
}