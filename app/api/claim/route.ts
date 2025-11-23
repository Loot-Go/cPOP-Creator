import { prisma } from "@/lib/prisma";
import { PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { claim } from "../../actions";

// Calculate distance between two coordinates in meters using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const CLAIM_RADIUS_METERS = 200;

export const GET = async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const wallet_address = searchParams.get("wallet_address");
  const id = searchParams.get("id");
  const userLat = searchParams.get("lat");
  const userLng = searchParams.get("lng");

  if (!wallet_address || !id) {
    return NextResponse.json(
      { error: "Missing required query parameters" },
      { status: 400 }
    );
  }

  const cpop = await prisma.cpop.findFirst({
    where: {
      id,
    },
  });

  if (!cpop) {
    return NextResponse.json({ error: "CPOP not found" }, { status: 404 });
  }

  // Server-side location validation (optional but recommended)
  if (userLat && userLng && cpop.lat && cpop.long) {
    const distance = calculateDistance(
      parseFloat(userLat),
      parseFloat(userLng),
      cpop.lat,
      cpop.long
    );

    if (distance > CLAIM_RADIUS_METERS) {
      return NextResponse.json(
        {
          error: `You must be within ${CLAIM_RADIUS_METERS}m of the event location. Current distance: ${Math.round(distance)}m`
        },
        { status: 403 }
      );
    }
  }

  const mint_address = cpop.tokenId!;

  try {
    const claimStatus = await claim(
      new PublicKey(wallet_address),
      new PublicKey(mint_address)
    );
    return NextResponse.json(claimStatus);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to claim";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
};

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the token against the environment variable
  if (token !== process.env.API_TOKEN) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { wallet_address, mint_address } = body;

    if (!wallet_address || !mint_address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const claimStatus = await claim(
      new PublicKey(wallet_address),
      new PublicKey(mint_address)
    );

    return NextResponse.json(claimStatus);
  } catch (error) {
    console.error("Error processing claim:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
