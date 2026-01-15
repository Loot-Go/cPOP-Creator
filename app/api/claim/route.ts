import { prisma } from "@/lib/prisma";
import { getRpcUrl } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createNoopSigner,
  createSignerFromKeypair,
  signerIdentity,
  signTransaction,
  some,
  none,
} from "@metaplex-foundation/umi";
import {
  fromWeb3JsPublicKey,
  toWeb3JsTransaction,
} from "@metaplex-foundation/umi-web3js-adapters";
import { mplBubblegum, mintV2 } from "@metaplex-foundation/mpl-bubblegum";
import { mplCore } from "@metaplex-foundation/mpl-core";

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

  if (!cpop.tokenId || !cpop.tokenAddress) {
    return NextResponse.json(
      { error: "CPOP is missing compression data." },
      { status: 400 }
    );
  }

  const now = new Date();
  if (cpop.startDate && now < cpop.startDate) {
    return NextResponse.json(
      {
        error: `Claiming opens on ${cpop.startDate.toISOString()}`,
      },
      { status: 403 }
    );
  }
  if (cpop.endDate && now > cpop.endDate) {
    return NextResponse.json(
      {
        error: "Claiming period has ended for this event.",
      },
      { status: 403 }
    );
  }

  const existingClaim = await prisma.cpopClaim.findFirst({
    where: {
      cpopId: cpop.id,
      walletAddress: wallet_address,
    },
  });

  if (existingClaim) {
    return NextResponse.json(
      { error: "You have already claimed this cPOP." },
      { status: 409 }
    );
  }

  const umi = createUmi(getRpcUrl()).use(mplCore()).use(mplBubblegum());
  const secret = bs58.decode(process.env.PAYER_KEYPAIR!);
  const backendKeypair = umi.eddsa.createKeypairFromSecretKey(
    new Uint8Array(secret)
  );
  const backendSigner = createSignerFromKeypair(umi, backendKeypair);
  umi.use(signerIdentity(backendSigner, true));

  const leafOwnerPk = new PublicKey(wallet_address);
  const leafOwner = fromWeb3JsPublicKey(leafOwnerPk);
  const payerSigner = createNoopSigner(leafOwner);
  const treePk = new PublicKey(cpop.tokenId);
  const collectionPk = new PublicKey(cpop.tokenAddress);
  const metadataUri = cpop.tokenURI || cpop.website;

  if (!metadataUri) {
    return NextResponse.json(
      {
        error:
          "CPOP metadata is missing a URI. Please contact the event organizer.",
      },
      { status: 400 }
    );
  }

  const builder = mintV2(umi, {
    payer: payerSigner,
    treeCreatorOrDelegate: backendSigner,
    collectionAuthority: backendSigner,
    leafOwner,
    leafDelegate: leafOwner,
    merkleTree: fromWeb3JsPublicKey(treePk),
    coreCollection: fromWeb3JsPublicKey(collectionPk),
    metadata: {
      name: cpop.eventName.slice(0, 32),
      symbol: cpop.organizerName.slice(0, 10) || "CPOP",
      uri: metadataUri,
      sellerFeeBasisPoints: 0,
      primarySaleHappened: false,
      isMutable: true,
      tokenStandard: none(),
      creators: [
        {
          address: backendSigner.publicKey,
          verified: true,
          share: 100,
        },
      ],
      collection: some(fromWeb3JsPublicKey(collectionPk)),
    },
  }).setFeePayer(payerSigner);

  const latestBlockhash = await umi.rpc.getLatestBlockhash();
  const transaction = await builder.setBlockhash(latestBlockhash).build(umi);
  const partiallySigned = await signTransaction(transaction, [backendSigner]);
  const versionedTx = toWeb3JsTransaction(partiallySigned);
  const serialized = Buffer.from(
    versionedTx.serialize()
  ).toString("base64");

  return NextResponse.json({
    transaction: serialized,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet_address, id, signature } = body;

    if (!wallet_address || !id || !signature) {
      return NextResponse.json(
        { error: "Missing required claim fields" },
        { status: 400 }
      );
    }

    const cpop = await prisma.cpop.findFirst({
      where: { id },
    });

    if (!cpop) {
      return NextResponse.json({ error: "CPOP not found" }, { status: 404 });
    }

    const existingClaim = await prisma.cpopClaim.findFirst({
      where: {
        cpopId: id,
        walletAddress: wallet_address,
      },
    });

    if (existingClaim) {
      return NextResponse.json(
        { error: "CPOP already claimed by this wallet" },
        { status: 409 }
      );
    }

    await prisma.cpopClaim.create({
      data: {
        id: crypto.randomUUID(),
        cpopId: id,
        walletAddress: wallet_address,
        tokenAddress: cpop.tokenAddress,
      },
    });

    return NextResponse.json({ success: true, signature });
  } catch (error) {
    console.error("Error recording claim:", error);
    return NextResponse.json(
      { error: "Failed to record claim" },
      { status: 500 }
    );
  }
}
