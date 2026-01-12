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
