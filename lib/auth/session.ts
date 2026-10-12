import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

const SESSION_COOKIE_NAME = 'fieldops_session';

function hashSessionToken(token: string): string {
    return crypto 
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

function generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId: string): Promise<void> {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    await prisma.session.create({
        data: {
            userId,
            tokenHash,
            expiresAt,
        }
    });

    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
    });
}

export async function getSession(): Promise<{ userId: string } | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
        return null;
    }

    const tokenHash = hashSessionToken(token);

    const session = await prisma.session.findUnique({
        where: { tokenHash },
        include: { user: true },
    });

    if (!session) {
        return null;
    }

    if(session.expiresAt <= new Date()){
        await prisma.session.delete({
            where: {
                id: session.id,
            },

        })
        return null;
    }

    return session;
}

export async function deleteSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if(token) {
        const tokenHash = hashSessionToken(token);
        await prisma.session.delete({
            where: { tokenHash },
        });
        cookieStore.delete(SESSION_COOKIE_NAME);
    }
}

export async function deleteAllUserSessions(userId: string) {
    await prisma.session.deleteMany({
        where: { userId },
    });
}