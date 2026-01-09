import { createTokenPool } from "@lightprotocol/compressed-token";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Wallet } from "@solana/wallet-adapter-react";
import { prisma } from "@/lib/prisma";
import {
  createRpc,
  buildTx,
  Rpc,
  selectStateTreeInfo,
} from "@lightprotocol/stateless.js";
import {
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  ExtensionType,
  getMintLen,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

interface MintResult {
  mintAddress: string;
  poolTxId: string;
  ataAddress: string;
  mintToTxId: string;
}

// Minimum SOL required for the transaction (in SOL)
const MIN_REQUIRED_SOL = 0.1;

export async function mintCPOPToken(
  connection: Rpc,
  wallet: Wallet
): Promise<MintResult> {
  if (!wallet.adapter.publicKey) {
    throw new Error("Wallet not connected");
  }

  try {
    // Check wallet balance
    const balance = await connection.getBalance(wallet.adapter.publicKey);
    const balanceInSol = balance / LAMPORTS_PER_SOL;

    if (balanceInSol < MIN_REQUIRED_SOL) {
      throw new Error(
        `Insufficient SOL balance. Required: ${MIN_REQUIRED_SOL} SOL, Current: ${balanceInSol.toFixed(
          4
        )} SOL. ` + `Please add some SOL to your wallet and try again.`
      );
    }

    // Create a temporary keypair for the mint
    const mintKeypair = Keypair.generate();

    /// Create an SPL mint
    const mint = await createMint(
      connection,
      mintKeypair,
      wallet.adapter.publicKey,
      null,
      9
    );
    console.log(`create-mint success! address: ${mint}`);

    /// Register mint for compression
    const poolTxId = await createTokenPool(connection, mintKeypair, mint);
    console.log(`createTokenPool success: ${poolTxId}`);

    /// Create an associated SPL token account for the sender
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      mintKeypair,
      mint,
      wallet.adapter.publicKey
    );
    console.log(`ATA: ${ata.address.toBase58()}`);

    /// Mint SPL tokens to the sender
    const mintToTxId = await mintTo(
      connection,
      mintKeypair,
      mint,
      ata.address,
      wallet.adapter.publicKey,
      1e9 * 1e9 // 1b * decimals
    );
    console.log(`mint-to success! txId: ${mintToTxId}`);

    return {
      mintAddress: mint.toBase58(),
      poolTxId,
      ataAddress: ata.address.toBase58(),
      mintToTxId,
    };
  } catch (error) {
    console.error("Error minting CPOP token:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to mint CPOP token: ${error.message}`);
    }
    throw error;
  }
}

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
  wallet, // from useWallet()
  sendTransaction, // from useWallet()
  connection: dj,
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
  wallet: any; // WalletContextState
  sendTransaction: any; // sendTransaction from useWallet
  connection: any;
}) => {
  try {
    if (!wallet) throw new Error("Wallet not connected");

    const logs = [];
    const payer = wallet.publicKey;

    /// Get Connection with compatibility to Compression API
    const connection: Rpc = dj;

    // @ jijin mint address (token address) -- save in backend for airdrops
    const mint = Keypair.generate();
    const decimals = 9;

    // @jijin enter the name of the token
    const metadata: TokenMetadata = {
      mint: mint.publicKey,
      name,
      symbol,
      uri,
      additionalMetadata,
    };

    const mintLen = getMintLen([ExtensionType.MetadataPointer]);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
    const mintLamports = await connection.getMinimumBalanceForRentExemption(
      mintLen + metadataLen
    );

    // TRANSACTION 1: Create mint and initialize metadata
    const mintInstructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: mintLamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        payer,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        payer,
        null,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        mint: mint.publicKey,
        metadata: mint.publicKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        mintAuthority: payer,
        updateAuthority: payer,
      }),
    ];

    const {
      context: { slot: minContextSlot },
      value: blockhashCtx,
    } = await connection.getLatestBlockhashAndContext();

    const mintTx = buildTx(mintInstructions, payer, blockhashCtx.blockhash);

    // IMPORTANT: Sign with mint keypair before sending
    mintTx.sign([mint]);

    const txId = await sendTransaction(mintTx, connection, {
      minContextSlot,
    });

    await connection.confirmTransaction({
      blockhash: blockhashCtx.blockhash,
      lastValidBlockHeight: blockhashCtx.lastValidBlockHeight,
      signature: txId,
    });

    console.log(`txId: ${txId}`);
    logs.push({
      type: "Tx id:",
      txId: txId,
      tx: `https://explorer.solana.com/tx/${txId}?cluster=devnet`,
    });

    // TRANSACTION 2: Register the mint with the Compressed-Token program
    // You'll need to import the actual compressed token functions
    const { CompressedTokenProgram } = await import(
      "@lightprotocol/compressed-token"
    );

    const registerMintIx = await CompressedTokenProgram.createTokenPool({
      feePayer: payer,
      mint: mint.publicKey,
      tokenProgramId: TOKEN_2022_PROGRAM_ID,
    });

    const registerInstructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      registerMintIx,
    ];

    const {
      context: { slot: minContextSlot2 },
      value: blockhashCtx2,
    } = await connection.getLatestBlockhashAndContext();

    const registerTx = buildTx(
      registerInstructions,
      payer,
      blockhashCtx2.blockhash
    );

    const txId2 = await sendTransaction(registerTx, connection, {
      minContextSlot: minContextSlot2,
    });

    await connection.confirmTransaction({
      blockhash: blockhashCtx2.blockhash,
      lastValidBlockHeight: blockhashCtx2.lastValidBlockHeight,
      signature: txId2,
    });

    console.log(`register-mint success! txId: ${txId2}`);
    logs.push({
      type: "Register mint:",
      txId: txId2,
      tx: `https://explorer.solana.com/tx/${txId2}?cluster=devnet`,
    });

    // TRANSACTION 3: Create ATA
    const ata = await getAssociatedTokenAddress(
      mint.publicKey,
      payer,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const ataInfo = await connection.getAccountInfo(ata);

    if (!ataInfo) {
      const createAtaInstructions = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        createAssociatedTokenAccountInstruction(
          payer,
          ata,
          payer,
          mint.publicKey,
          TOKEN_2022_PROGRAM_ID
        ),
      ];

      const {
        context: { slot: minContextSlot3 },
        value: blockhashCtx3,
      } = await connection.getLatestBlockhashAndContext();

      const createAtaTx = buildTx(
        createAtaInstructions,
        payer,
        blockhashCtx3.blockhash
      );

      const ataTxId = await sendTransaction(createAtaTx, connection, {
        minContextSlot: minContextSlot3,
      });

      await connection.confirmTransaction({
        blockhash: blockhashCtx3.blockhash,
        lastValidBlockHeight: blockhashCtx3.lastValidBlockHeight,
        signature: ataTxId,
      });
    }

    console.log(`ATA: ${ata}`);
    logs.push({
      type: "ATA:",
      txId: ata.toString(),
      tx: `https://explorer.solana.com/address/${ata}?cluster=devnet`,
    });

    // TRANSACTION 4: Mint SPL tokens
    const mintToInstructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      createMintToInstruction(
        mint.publicKey,
        ata,
        payer,
        // @jijin enter total number of tokens to mint multiplied by 10^decimals
        amount * Math.pow(10, decimals),
        [],
        TOKEN_2022_PROGRAM_ID
      ),
    ];

    const {
      context: { slot: minContextSlot4 },
      value: blockhashCtx4,
    } = await connection.getLatestBlockhashAndContext();

    const mintToTx = buildTx(
      mintToInstructions,
      payer,
      blockhashCtx4.blockhash
    );

    const mintTxId = await sendTransaction(mintToTx, connection, {
      minContextSlot: minContextSlot4,
    });

    await connection.confirmTransaction({
      blockhash: blockhashCtx4.blockhash,
      lastValidBlockHeight: blockhashCtx4.lastValidBlockHeight,
      signature: mintTxId,
    });

    console.log(`mint-spl success! txId: ${mintTxId}`);
    logs.push({
      type: "Mint SPL:",
      txId: mintTxId,
      tx: `https://explorer.solana.com/tx/${mintTxId}?cluster=devnet`,
    });

    // First, get the state tree info (needed for compression)
    // const stateTreeInfos = await connection.getStateTreeInfos();
    // const treeInfo = selectStateTreeInfo(stateTreeInfos);

    // TRANSACTION 5: Compress tokens
    //@ts-ignore
    const compressIx = await CompressedTokenProgram.compress({
      payer: payer,
      owner: payer,
      source: ata,
      mint: mint.publicKey,
      // @jijin enter total number of tokens to mint multiplied by 10^decimals
      amount: amount * Math.pow(10, decimals),
      toAddress: payer,
      // outputStateTreeInfo: treeInfo,
      // tokenPoolInfo: undefined,
    });

    const compressInstructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      compressIx,
    ];

    const {
      context: { slot: minContextSlot5 },
      value: blockhashCtx5,
    } = await connection.getLatestBlockhashAndContext();

    const compressTx = buildTx(
      compressInstructions,
      payer,
      blockhashCtx5.blockhash
    );

    const compressedTokenTxId = await sendTransaction(compressTx, connection, {
      minContextSlot: minContextSlot5,
    });

    await connection.confirmTransaction({
      blockhash: blockhashCtx5.blockhash,
      lastValidBlockHeight: blockhashCtx5.lastValidBlockHeight,
      signature: compressedTokenTxId,
    });

    console.log(`compressed-token success! txId: ${compressedTokenTxId}`);
    logs.push({
      type: "Compressed token:",
      txId: compressedTokenTxId,
      tx: `https://explorer.solana.com/tx/${compressedTokenTxId}?cluster=devnet`,
    });

    // Store the event details in the database
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
        tokenAddress: mint.publicKey.toString(),
        tokenId: mint.publicKey.toString(),
        tokenType: "compressed",
        tokenURI: uri,
        lat: latitude,
        long: longitude,
        creator_address,
      },
    });

    try {
      const response = await fetch(
        `https://white-art-c8ed.devzstudio.workers.dev/`,
        {
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
        }
      );

      console.log(response);
    } catch (error) {
      console.log(error);
    }

    return { logs, cpop };
  } catch (error) {
    return { error: true, message: error };
  }
};

export default createToken;
