import { getSession } from "@/lib/auth/session";
import { prisma } from "../db/prisma";

type OrganizationContextResult =
  | {
      ok: true;
      organization: {
        id: string;
        name: string;
        slug: string;
        timezone: string;
        currency: string;
      };
      membership: {
        id: string;
        userId: string;
        organizationId: string;
        role: "OWNER" | "ADMIN" | "DISPATCHER" | "TECHNICIAN" | "ACCOUNTANT";
      };
    }
  | {
      ok: false;
      reason: "UNAUTHENTICATED" | "ORGANIZATION_NOT_FOUND" | "NOT_A_MEMBER";
    };


    export async function getOrganizationContext(
        organizationSlug: string,
    ): Promise<OrganizationContextResult> {
        // 1. Identifying the user from the existing session cookie
        const session = await getSession();

        if(!session) {
            return {
                ok: false,
                reason: "UNAUTHENTICATED",
            }
        }

        // 2. Find the organization by it's public slug
        const organization = await prisma.organization.findUnique({
            where: { slug: organizationSlug },
            select: {
                id: true,
                name: true,
                slug: true,
                timezone: true,
                currency: true,
            }
        })

        if(!organization) {
            return {
                ok: false,
                reason: "ORGANIZATION_NOT_FOUND",
            }
        }

        // 3. Confirm that this user belongs to this organization
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.userId,
                    organizationId: organization.id,
                }
            },
            select: {
                id: true,
                userId: true,
                organizationId: true,
                role: true,
            }
        })

        if(!membership) {
            return {
                ok: false,
                reason: "NOT_A_MEMBER",
            }
        }

        // 4. Return only the context the caller needs

        return {
            ok: true,
            organization,
            membership,
        }
    }