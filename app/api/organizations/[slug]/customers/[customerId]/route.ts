import { getOrganizationContext } from "@/lib/auth/organization";
import { prisma } from "@/lib/db/prisma";
import { updateCustomerSchema } from "@/lib/validators/customer.validator";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";


type RouteContext = {
    params: Promise<{
        slug: string;
        customerId: string; 
    }>
}

export async function GET(
    _request: NextRequest,
    { params }: RouteContext,
) {
    try {
        const { slug, customerId } = await params;

        // 1. Authenticate the user and verify organization membership
        const context = await getOrganizationContext(slug);

        if (!context.ok) {
            const status = 
            context.reason === "UNAUTHENTICATED" ? 401 :
            context.reason === "ORGANIZATION_NOT_FOUND" ? 404 :
            403;

            return NextResponse.json(
                { success: false, message: context.reason },
                { status },
            );
        }

        // 2. Find the customer inside the authorized organization
        const customer = await prisma.customer.findFirst({
            where: {
                id: customerId,
                organizationId: context.organization.id,
                isArchived: false,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                companyName: true,
                notes: true,
                createdAt: true,
                updatedAt: true,
                locations: {
                    select: {
                        id: true,
                        name: true,
                        addressLine1: true,
                        addressLine2: true,
                        city: true,
                        postalCode: true,
                        isDefault: true,
                    }
                }
            }
        })

        if (!customer) {
            return NextResponse.json(
                { success: false, message: "CUSTOMER_NOT_FOUND" },
                { status: 404 },
            );
        }

        // 3. Return the customer and it's location
        return NextResponse.json({
            success: true,
            data: customer,
        });
    }catch (error) {
        console.error("GET customer error:", error);
        
        return NextResponse.json(
            { success: false, message: "Internal server error." },
            { status: 500 },
        );
    }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { slug, customerId } = await params;

    // 1. Authenticate and verify organization membership.
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

    // 2. Validate the request body.
    const body: unknown = await request.json();
    const input = updateCustomerSchema.parse(body);

    // 3. Confirm the customer belongs to this organization.
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId: context.organization.id,
        isArchived: false,
      },
      select: { id: true },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { success: false, message: "CUSTOMER_NOT_FOUND" },
        { status: 404 },
      );
    }

    // 4. Update only the supplied fields.
    const customer = await prisma.customer.update({
      where: { id: existingCustomer.id },
      data: input,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Customer updated successfully.",
      data: customer,
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

    console.error("PATCH customer error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 },
    );
  }
}


export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { slug, customerId } = await params;

    // 1. Verify authentication and organization membership.
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

    // 2. Find an active customer within this organization.
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

    // 3. Archive instead of permanently deleting the record.
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Customer archived successfully.",
    });
  } catch (error) {
    console.error("DELETE customer error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 },
    );
  }
}