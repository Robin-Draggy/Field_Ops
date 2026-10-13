
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { getOrganizationContext } from "@/lib/auth/organization";
import { prisma } from "@/lib/db/prisma";
import { updateLocationSchema } from "@/lib/validators/location.validator";

type RouteContext = {
  params: Promise<{
    slug: string;
    customerId: string;
    locationId: string;
  }>;
};



function authorizationError(reason: string) {
  const status =
    reason === "UNAUTHENTICATED"
      ? 401
      : reason === "ORGANIZATION_NOT_FOUND"
        ? 404
        : 403;

  return NextResponse.json(
    { success: false, message: reason },
    { status },
  );
}

function handleUnexpectedError(error: unknown, operation: string) {
  console.error(`${operation} customer location error:`, error);

  return NextResponse.json(
    { success: false, message: "Internal server error." },
    { status: 500 },
  );
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { slug, customerId, locationId } = await params;
    const context = await getOrganizationContext(slug);

    if (!context.ok) {
      return authorizationError(context.reason);
    }

    const location = await prisma.customerLocation.findFirst({
      where: {
        id: locationId,
        customerId,
        customer: {
          organizationId: context.organization.id,
          isArchived: false,
        },
      },
      select: {
        id: true,
        customerId: true,
        name: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!location) {
      return NextResponse.json(
        { success: false, message: "LOCATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: location,
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { slug, customerId, locationId } = await params;
    const context = await getOrganizationContext(slug);

    if (!context.ok) {
      return authorizationError(context.reason);
    }

    const body: unknown = await request.json();
    const input = updateLocationSchema.parse(body);

    // Verify both the active customer and the location relationship.
    const location = await prisma.customerLocation.findFirst({
      where: {
        id: locationId,
        customerId,
        customer: {
          organizationId: context.organization.id,
          isArchived: false,
        },
      },
      select: {
        id: true,
        isDefault: true,
      },
    });

    if (!location) {
      return NextResponse.json(
        { success: false, message: "LOCATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    const updatedLocation = await prisma.$transaction(async (tx) => {
      // When selecting a new default, unset the previous default.
      if (input.isDefault === true) {
        await tx.customerLocation.updateMany({
          where: {
            customerId,
            id: { not: locationId },
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      // Don't leave a customer without a default when unsetting
      // the only current default location.
      if (input.isDefault === false && location.isDefault) {
        const replacement = await tx.customerLocation.findFirst({
          where: {
            customerId,
            id: { not: locationId },
          },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });

        if (!replacement) {
          throw new Error("CANNOT_UNSET_ONLY_DEFAULT");
        }

        await tx.customerLocation.update({
          where: { id: replacement.id },
          data: { isDefault: true },
        });
      }

      return tx.customerLocation.update({
        where: { id: locationId },
        data: input,
        select: {
          id: true,
          customerId: true,
          name: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postalCode: true,
          latitude: true,
          longitude: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Customer location updated successfully.",
      data: updatedLocation,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed.",
          errors: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body." },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "CANNOT_UNSET_ONLY_DEFAULT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This is the customer's only location. It must remain the default.",
        },
        { status: 400 },
      );
    }

    return handleUnexpectedError(error, "PATCH");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { slug, customerId, locationId } = await params;
    const context = await getOrganizationContext(slug);

    if (!context.ok) {
      return authorizationError(context.reason);
    }

    const location = await prisma.customerLocation.findFirst({
      where: {
        id: locationId,
        customerId,
        customer: {
          organizationId: context.organization.id,
          isArchived: false,
        },
      },
      select: {
        id: true,
        isDefault: true,
      },
    });

    if (!location) {
      return NextResponse.json(
        { success: false, message: "LOCATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Job records must keep their referenced service location.
      const jobCount = await tx.job.count({
        where: { locationId },
      });

      if (jobCount > 0) {
        return { blockedByJobs: true };
      }

      // If deleting the default, promote another location first.
      if (location.isDefault) {
        const replacement = await tx.customerLocation.findFirst({
          where: {
            customerId,
            id: { not: locationId },
          },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });

        if (replacement) {
          await tx.customerLocation.update({
            where: { id: replacement.id },
            data: { isDefault: true },
          });
        }
      }

      await tx.customerLocation.delete({
        where: { id: locationId },
      });

      return { blockedByJobs: false };
    });

    if (result.blockedByJobs) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This location cannot be deleted because jobs reference it.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer location deleted successfully.",
    });
  } catch (error) {
    return handleUnexpectedError(error, "DELETE");
  }
}