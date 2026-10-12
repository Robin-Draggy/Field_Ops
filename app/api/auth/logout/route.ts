import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";

export async function POST() {
    try {
        await deleteSession();

        return NextResponse.json({ message: "Logged out successfully." });
    } catch (error) {
        console.error("Logout failed:", error);
        return NextResponse.json(
            { message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}