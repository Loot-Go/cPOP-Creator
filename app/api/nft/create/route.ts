import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  createSignerFromKeypair,
  signerIdentity,
  sol,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { NextResponse } from "next/server";

export const GET = async () => {
  const secretKeyString = process.env.SOLANA_WALLET_SECRET_KEY!;

  const secretKeyArray = secretKeyString
    .split(",")
    .map((s) => parseInt(s.trim(), 10));
  const secretKey = new Uint8Array(secretKeyArray);

  const umi = createUmi(
    "https://devnet-aura.metaplex.com/18de00dc-cad1-42c4-ba30-8499bcaeb9a1"
  )
    .use(mplTokenMetadata())
    .use(
      irysUploader({
        // mainnet address: "https://node1.irys.xyz"
        // devnet address: "https://devnet.irys.xyz"
        address: "https://devnet.irys.xyz",
      })
    );

  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);

  console.log(umi.payer.publicKey);

  const signer = createSignerFromKeypair(umi, keypair);

  // Tell umit to use the new signer.
  umi.use(signerIdentity(signer));

  // This will airdrop SOL on devnet only for testing.
  await umi.rpc.airdrop(umi.identity.publicKey, sol(0.001));

  const metadata = {
    name: "Test NFT",
    description: "Test NFT for Test NFT",
    image: "https://i.imgur.com/SxNUnRZ.jpeg",
    external_url: "https://example.com/my-nft.json",
    attributes: [
      {
        trait_type: "trait1",
        value: "1",
      },
    ],
    properties: {
      files: [
        {
          uri: "https://i.imgur.com/SxNUnRZ.jpeg",
          type: "image/png",
        },
      ],
      category: "image",
    },
  };

  const metadataUri = await umi.uploader.uploadJson(metadata).catch((err) => {
    throw new Error(err);
  });

  return NextResponse.json({
    metadataUri,
  });
};
