import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  organizationSlug: string;
};

type LoginInput = {
  email: string;
  password: string;
};

export async function registerUser(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const organizationSlug = input.organizationSlug.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    throw new Error("A user with this email already exists.");
  }

  const existingOrganization = await prisma.organization.findUnique({
    where: {
      slug: organizationSlug,
    },
  });

  if (existingOrganization) {
    throw new Error("This organization slug is already taken.");
  }

  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
      },
    });

    const organization = await tx.organization.create({
      data: {
        name: input.organizationName.trim(),
        slug: organizationSlug,
        timezone: "Asia/Dhaka",
        currency: "USD",
      },
    });

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "OWNER",
      },
    });

    return {
      user,
      organization,
      membership,
    };
  });

  await createSession(result.user.id);

  return {
    user: result.user,
    organization: result.organization,
    membership: result.membership,
  };
}

export async function loginUser(input: LoginInput) {
  const email = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user || !user.passwordHash) {
    throw new Error("Invalid email or password.");
  }

  const passwordIsValid = await verifyPassword(
    input.password,
    user.passwordHash,
  );

  if (!passwordIsValid) {
    throw new Error("Invalid email or password.");
  }

  await createSession(user.id);

  return {
    user,
  };
}