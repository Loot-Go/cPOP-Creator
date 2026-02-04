import { NextRequest, NextResponse } from "next/server";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { createSignerFromKeypair, signerIdentity } from "@metaplex-foundation/umi";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metadata } = body;

    if (!metadata) {
      return NextResponse.json(
        { error: "Metadata is required" },
        { status: 400 }
      );
    }

    // Get payer keypair from environment
    const payerKeypair = process.env.PAYER_KEYPAIR;
    if (!payerKeypair) {
      return NextResponse.json(
        { error: "Server configuration error: PAYER_KEYPAIR not set" },
        { status: 500 }
      );
    }

    // Get RPC endpoint
    const rpcEndpoint =
      process.env.RPC_CLIENT_DEFAULT ||
      "https://api.mainnet-beta.solana.com";

    // Create UMI instance with server-side signer
    const keypair = Keypair.fromSecretKey(bs58.decode(payerKeypair));
    const umi = createUmi(rpcEndpoint);

    // Create UMI keypair from Solana keypair
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(keypair.secretKey);
    const signer = createSignerFromKeypair(umi, umiKeypair);

    // Configure UMI with signer and Irys uploader
    umi.use(signerIdentity(signer)).use(irysUploader());

    // Upload metadata
    const uri = await umi.uploader.uploadJson(metadata);

    return NextResponse.json({ uri });
  } catch (error) {
    console.error("Error uploading metadata:", error);
    return NextResponse.json(
      { error: "Failed to upload metadata", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
