"use server";

import { prisma } from "@/lib/prisma";
import { getRpcUrl } from "@/lib/utils";
import { transfer } from "@lightprotocol/compressed-token";
import { createRpc } from "@lightprotocol/stateless.js";
// import {
//   createInitializeMetadataPointerInstruction,
//   createInitializeMintInstruction,
//   ExtensionType,
//   getMintLen,
//   getOrCreateAssociatedTokenAccount,
//   LENGTH_SIZE,
//   mintTo as mintToSpl,
//   TOKEN_2022_PROGRAM_ID,
//   TYPE_SIZE,
// } from "@solana/spl-token";
// import {
//   createInitializeInstruction,
//   pack,
//   TokenMetadata,
// } from "@solana/spl-token-metadata";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// const createToken = async ({
//   name,
//   symbol,
//   uri,
//   additionalMetadata,
//   eventName,
//   organizerName,
//   description,
//   website,
//   startDate,
//   endDate,
//   amount,
//   location,
//   imageUrl,
//   creator_address,
//   latitude,
//   longitude,
// }: {
//   name: string;
//   symbol: string;
//   uri: string;
//   additionalMetadata: [string, string][];
//   eventName: string;
//   organizerName: string;
//   description: string;
//   website: string;
//   startDate: Date;
//   endDate: Date;
//   amount: number;
//   location: string;
//   imageUrl?: string;
//   creator_address: string;
//   latitude: number;
//   longitude: number;
// }) => {
//   {
//     try {
//       const logs = [];

//       const payer = Keypair.fromSecretKey(
//         bs58.decode(process.env.PAYER_KEYPAIR!)
//       );
//       const RPC_ENDPOINT = getRpcUrl();
//       const connection = createRpc(RPC_ENDPOINT);
//       // @ jijin mint address (token address) -- save in backend for airdrops
//       const mint = Keypair.generate();
//       const decimals = 9;
//       // @jijin enter the name of the token
//       const metadata: TokenMetadata = {
//         mint: mint.publicKey,
//         name,
//         symbol,
//         uri,
//         additionalMetadata,
//       };

//       const mintLen = getMintLen([ExtensionType.MetadataPointer]);

//       const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

//       // @jijin this is just to get devnet tokens to make txs
//       // airdrop to pay gas
//       // await confirmTx(
//       //   connection,
//       //   await connection.requestAirdrop(payer.publicKey, 1e7)
//       // );

//       const mintLamports = await connection.getMinimumBalanceForRentExemption(
//         mintLen + metadataLen
//       );
//       const mintTransaction = new Transaction().add(
//         SystemProgram.createAccount({
//           fromPubkey: payer.publicKey,
//           newAccountPubkey: mint.publicKey,
//           space: mintLen,
//           lamports: mintLamports,
//           programId: TOKEN_2022_PROGRAM_ID,
//         }),
//         createInitializeMetadataPointerInstruction(
//           mint.publicKey,
//           payer.publicKey,
//           mint.publicKey,
//           TOKEN_2022_PROGRAM_ID
//         ),
//         createInitializeMintInstruction(
//           mint.publicKey,
//           decimals,
//           payer.publicKey,
//           null,
//           TOKEN_2022_PROGRAM_ID
//         ),
//         createInitializeInstruction({
//           programId: TOKEN_2022_PROGRAM_ID,
//           mint: mint.publicKey,
//           metadata: mint.publicKey,
//           name: metadata.name,
//           symbol: metadata.symbol,
//           uri: metadata.uri,
//           mintAuthority: payer.publicKey,
//           updateAuthority: payer.publicKey,
//         })
//       );
//       const txId = await sendAndConfirmTransaction(
//         connection,
//         mintTransaction,
//         [payer, mint]
//       );

//       console.log(`txId: ${txId}`);

//       logs.push({
//         type: "Tx id:",
//         txId: txId,
//         tx: `https://explorer.solana.com/tx/${txId}?cluster=devnet`,
//       });

//       // register the mint with the Compressed-Token program
//       const txId2 = await createTokenPool(
//         connection,
//         payer,
//         mint.publicKey,
//         undefined,
//         TOKEN_2022_PROGRAM_ID
//       );
//       console.log(`register-mint success! txId: ${txId2}`);

//       logs.push({
//         type: "Register mint:",
//         txId: txId2,
//         tx: `https://explorer.solana.com/tx/${txId2}?cluster=devnet`,
//       });

//       const ata = await getOrCreateAssociatedTokenAccount(
//         connection,
//         payer,
//         mint.publicKey,
//         payer.publicKey,
//         undefined,
//         undefined,
//         undefined,
//         TOKEN_2022_PROGRAM_ID
//       );

//       console.log(`ATA: ${ata.address}`);

//       logs.push({
//         type: "ATA:",
//         txId: ata.address.toString(),
//         tx: `https://explorer.solana.com/address/${ata.address}?cluster=devnet`,
//       });

//       // Mint SPL
//       const mintTxId = await mintToSpl(
//         connection,
//         payer,
//         mint.publicKey,
//         ata.address,
//         payer.publicKey,
//         // @jijin enter total number of tokens to mint multiplied by 10^decimals
//         amount * Math.pow(10, decimals),
//         undefined,
//         undefined,
//         TOKEN_2022_PROGRAM_ID
//       );
//       console.log(`mint-spl success! txId: ${mintTxId}`);

//       logs.push({
//         type: "Mint SPL:",
//         txId: mintTxId,
//         tx: `https://explorer.solana.com/tx/${mintTxId}?cluster=devnet`,
//       });

//       const compressedTokenTxId = await compress(
//         connection,
//         payer,
//         mint.publicKey,
//         // @jijin enter total number of tokens to mint multiplied by 10^decimals
//         amount * Math.pow(10, decimals),
//         payer,
//         ata.address,
//         payer.publicKey
//       );
//       console.log(`compressed-token success! txId: ${compressedTokenTxId}`);

//       logs.push({
//         type: "Compressed token:",
//         txId: compressedTokenTxId,
//         tx: `https://explorer.solana.com/tx/${compressedTokenTxId}?cluster=devnet`,
//       });

//       // Store the event details in the database
//       const cpop = await prisma.cpop.create({
//         data: {
//           eventName,
//           organizerName,
//           description,
//           website,
//           startDate,
//           endDate,
//           amount,
//           location,
//           imageUrl,
//           tokenAddress: mint.publicKey.toString(),
//           tokenId: mint.publicKey.toString(),
//           tokenType: "compressed",
//           tokenURI: uri,
//           lat: latitude,
//           long: longitude,
//           // tokenMetadata: metadata,
//           creator_address,
//         },
//       });

//       try {
//         const response = await fetch(
//           `https://white-art-c8ed.devzstudio.workers.dev/`,
//           {
//             method: "POST",
//             body: JSON.stringify({
//               lat: parseFloat(latitude.toString()),
//               lng: parseFloat(longitude.toString()),
//               image: imageUrl,
//               token_value: {
//                 id: cpop.id,
//                 title: eventName,
//                 sub_title: organizerName,
//                 description: description,
//                 location,
//               },
//             }),
//             headers: {
//               "Content-Type": "application/json",
//             },
//           }
//         );

//         console.log(response);
//       } catch (error) {
//         console.log(error);
//       }

//       return { logs, cpop };
//     } catch (error) {
//       return { error: true, message: error };
//     }
//   }
// };

export const createToken = async ({
  name,
  symbol,
  uri,
  additionalMetadata,
  eventName,
  organizerName,
  description,
  website,
  startDate,
  endDate,
  amount,
  location,
  imageUrl,
  creator_address,
  latitude,
  longitude,
  treeAddress,
  collectionAddress,
  collectionSignature,
}: {
  name: string;
  symbol: string;
  uri: string;
  additionalMetadata: [string, string][];
  eventName: string;
  organizerName: string;
  description: string;
  website: string;
  startDate: Date;
  endDate: Date;
  amount: number;
  location: string;
  imageUrl?: string;
  creator_address: string;
  latitude: number;
  longitude: number;
  treeAddress?: string;
  collectionAddress?: string;
  collectionSignature?: string;
}) => {
  try {
    const cpop = await prisma.cpop.create({
      data: {
        eventName,
        organizerName,
        description,
        website,
        startDate,
        endDate,
        amount,
        location,
        imageUrl,
        tokenAddress: collectionAddress,
        tokenId: treeAddress,
        tokenType: "metaplex",
        tokenURI: uri,
        lat: latitude,
        long: longitude,
        creator_address,
        tokenMetadata: {
          name,
          symbol,
          additionalMetadata,
          treeAddress,
          collectionAddress,
          collectionSignature,
        },
      },
    });

    try {
      await fetch(`https://white-art-c8ed.devzstudio.workers.dev/`, {
        method: "POST",
        body: JSON.stringify({
          lat: parseFloat(latitude.toString()),
          lng: parseFloat(longitude.toString()),
          image: imageUrl,
          token_value: {
            id: cpop.id,
            title: eventName,
            sub_title: organizerName,
            description: description,
            location,
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.log(error);
    }

    return { logs: [], cpop };
  } catch (error) {
    console.error("Error persisting cPOP:", error);
    return {
      error: true,
      message:
        error instanceof Error
          ? error.message
          : "Failed to save cPOP metadata.",
    };
  }
};

export const claim = async (
  wallet_address: PublicKey,
  mint_address: PublicKey
) => {
  const payer = Keypair.fromSecretKey(bs58.decode(process.env.PAYER_KEYPAIR!));

  const RPC_ENDPOINT = getRpcUrl();
  const connection = createRpc(RPC_ENDPOINT);

  // Find the CPOP record by token address
  const cpop = await prisma.cpop.findFirst({
    where: {
      tokenAddress: mint_address.toString(),
    },
  });

  if (!cpop) {
    throw new Error("CPOP not found");
  }

  // Check if claim already exists
  const existingClaim = await prisma.cpopClaim.findFirst({
    where: {
      cpopId: cpop.id,
      walletAddress: wallet_address.toString(),
    },
  });

  if (existingClaim) {
    throw new Error("CPOP already claimed by this wallet");
  }

  const to = new PublicKey(wallet_address);
  const mint = new PublicKey(mint_address);
  const transferCompressedTxId = await transfer(
    connection,
    payer,
    mint,
    1e9,
    payer,
    to
  );
  console.log(`transfer-compressed success! txId: ${transferCompressedTxId}`);

  // Store the claim record
  await prisma.cpopClaim.create({
    data: {
      cpopId: cpop.id,
      walletAddress: wallet_address.toString(),
      tokenAddress: mint_address.toString(),
    },
  });

  return {
    success: true,
    txId: transferCompressedTxId,
    message: "CPOP claimed successfully",
  };
};

export default createToken;
