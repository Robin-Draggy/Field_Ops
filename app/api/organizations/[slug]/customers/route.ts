
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { getOrganizationContext } from "@/lib/auth/organization";
import { prisma } from "@/lib/db/prisma";
import { createCustomerSchema } from "@/lib/validators/customer.validator";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { slug } = await params;
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

    const customers = await prisma.customer.findMany({
      where: {
        organizationId: context.organization.id,
        isArchived: false,
      },
      orderBy: { createdAt: "desc" },
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
      data: customers,
    });
  } catch (error) {
    console.error("GET customers error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { slug } = await params;
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

    const body: unknown = await request.json();
    const input = createCustomerSchema.parse(body);

    const customer = await prisma.customer.create({
      data: {
        organizationId: context.organization.id,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        companyName: input.companyName || null,
        notes: input.notes || null,
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
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Customer created successfully.",
        data: customer,
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

    console.error("POST customers error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 },
    );
  }
}