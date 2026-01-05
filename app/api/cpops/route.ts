import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const creator_address = searchParams.get("creator_address");

  if (!creator_address) {
    return NextResponse.json(
      { error: "Missing creator_address parameter" },
      { status: 400 }
    );
  }

  try {
    const cpops = await prisma.cpop.findMany({
      where: {
        creator_address,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        eventName: true,
        organizerName: true,
        location: true,
        startDate: true,
        endDate: true,
        amount: true,
        imageUrl: true,
        createdAt: true,
        tokenAddress: true,
        _count: {
          select: {
            claims: true,
          },
        },
      },
    });

    return NextResponse.json(cpops);
  } catch (error) {
    console.error("Error fetching CPOPs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
