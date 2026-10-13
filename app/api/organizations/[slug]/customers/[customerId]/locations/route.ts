import { getOrganizationContext } from "@/lib/auth/organization";
import { prisma } from "@/lib/db/prisma";
import { createLocationSchema } from "@/lib/validators/location.validator";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

type RouteContext = {
  params: Promise<{
    slug: string;
    customerId: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { slug, customerId } = await params;
 
    const context = await getOrganizationContext(slug);

    if (!context.ok) {
      const status =
        context.reason === "UNAUTHENTICATED"
          ? 401
          : context.reason === "ORGANIZATION_NOT_FOUND"
            ? 404
            : 403;
      return NextResponse.json(
        { ok: false, reason: context.reason },
        { status },
      );
    }

    // only allow access to the active customer in this organization
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId: context.organization.id,
        isArchived: false,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { ok: false, reason: "CUSTOMER_NOT_FOUND" },
        { status: 404 },
      );
    }

    const locations = await prisma.customerLocation.findMany({
      where: { customerId: customer.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
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

    return NextResponse.json({
      success: true,
      data: locations,
    });
  } catch (error) {
    console.error("GET customer locations error: ", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}


export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { slug, customerId } = await params;

    const context = await getOrganizationContext(slug);

    if (!context.ok) {
      const status =
        context.reason === "UNAUTHENTICATED"
          ? 401
          : context.reason === "ORGANIZATION_NOT_FOUND"
            ? 404
            : 403;

      return NextResponse.json(
        { success: false, message: context.reason },
        { status },
      );
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId: context.organization.id,
        isArchived: false,
      },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "CUSTOMER_NOT_FOUND" },
        { status: 404 },
      );
    }

    const body: unknown = await request.json();
    const input = createLocationSchema.parse(body);

    const location = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.customerLocation.count({
        where: { customerId: customer.id },
      });

      // The first location becomes the default unless explicitly overridden.
      const shouldBeDefault =
        input.isDefault ?? existingCount === 0;

      // A customer should have only one default location.
      if (shouldBeDefault) {
        await tx.customerLocation.updateMany({
          where: {
            customerId: customer.id,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      return tx.customerLocation.create({
        data: {
          customerId: customer.id,
          name: input.name,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          city: input.city,
          postalCode: input.postalCode ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          isDefault: shouldBeDefault,
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
    });

    return NextResponse.json(
      {
        success: true,
        message: "Customer location created successfully.",
        data: location,
      },
      { status: 201 },
    );
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

    console.error("POST customer location error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 },
    );
  }
}