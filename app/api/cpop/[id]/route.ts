import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(cpop);
  } catch (error) {
    console.error("Error fetching CPOP:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
