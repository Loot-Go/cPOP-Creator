import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const wallet_address = searchParams.get("wallet_address");

    const cpop = await prisma.cpop.findUnique({
      where: { id },
      select: {
        id: true,
        eventName: true,
        organizerName: true,
        description: true,
        website: true,
        location: true,
        startDate: true,
        endDate: true,
        amount: true,
        imageUrl: true,
        lat: true,
        long: true,
        tokenAddress: true,
      },
    });

    if (!cpop) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    let claimed = false;
    if (wallet_address) {
      const existingClaim = await prisma.cpopClaim.findFirst({
        where: {
          cpopId: cpop.id,
          walletAddress: wallet_address,
        },
        select: {
          id: true,
        },
      });

      if (existingClaim) {
        claimed = true;
      }
    }

    return NextResponse.json({ ...cpop, claimed });
  } catch (error) {
    console.error("Error fetching CPOP:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
