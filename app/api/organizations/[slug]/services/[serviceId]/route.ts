
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { getOrganizationContext } from "@/lib/auth/organization";
import { prisma } from "@/lib/db/prisma";
import { updateServiceSchema } from "@/lib/validators/service.validator";

type RouteContext = {
  params: Promise<{
    slug: string;
    serviceId: string;
  }>;
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

const serviceSelect = {
  id: true,
  name: true,
  description: true,
  basePrice: true,
  estimatedDuration: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { slug, serviceId } = await params;

    const context = await getOrganizationContext(slug);

    if (!context.ok) {
      return authorizationError(context.reason);
    }

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        organizationId: context.organization.id,
      },
      select: serviceSelect,
    });

    if (!service) {
      return NextResponse.json(
        { success: false, message: "Service not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: service,
    });
  } catch (error) {
    return handleUnexpectedError(error, "get");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { slug, serviceId } = await params;

    const context = await getOrganizationContext(slug);

    if (!context.ok) {
      return authorizationError(context.reason);
    }

    const body: unknown = await request.json();
    const input = updateServiceSchema.parse(body);

    const existingService = await prisma.service.findFirst({
      where: {
        id: serviceId,
        organizationId: context.organization.id,
      },
      select: { id: true },
    });

    if (!existingService) {
      return NextResponse.json(
        { success: false, message: "Service not found." },
        { status: 404 }
      );
    }

    const service = await prisma.service.update({
      where: { id: existingService.id },
      data: input,
      select: serviceSelect,
    });

    return NextResponse.json({
      success: true,
      message: "Service updated successfully.",
      data: service,
    });
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

    return handleUnexpectedError(error, "update");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { slug, serviceId } = await params;

    const context = await getOrganizationContext(slug);

    if (!context.ok) {
      return authorizationError(context.reason);
    }

    const existingService = await prisma.service.findFirst({
      where: {
        id: serviceId,
        organizationId: context.organization.id,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!existingService) {
      return NextResponse.json(
        { success: false, message: "Service not found." },
        { status: 404 }
      );
    }

    if (!existingService.isActive) {
      return NextResponse.json({
        success: true,
        message: "Service is already deactivated.",
      });
    }

    await prisma.service.update({
      where: { id: existingService.id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Service deactivated successfully.",
    });
  } catch (error) {
    return handleUnexpectedError(error, "deactivate");
  }
}