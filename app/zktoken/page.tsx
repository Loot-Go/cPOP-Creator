'use client'
import { confirmTx, createRpc, bn, buildAndSignTx, sendAndConfirmTx, dedupeSigner } from "@lightprotocol/stateless.js";
import {
    compress,
    createTokenPool,
    CompressedTokenProgram,
    transfer,
    selectMinCompressedTokenAccountsForTransfer,
    selectTokenPoolInfosForDecompression,
    getTokenPoolInfos,
} from "@lightprotocol/compressed-token";
import { ComputeBudgetProgram } from "@solana/web3.js";

import {
    getOrCreateAssociatedTokenAccount,
    mintTo as mintToSpl,
    TOKEN_2022_PROGRAM_ID,
    createInitializeMetadataPointerInstruction,
    createInitializeMintInstruction,
    ExtensionType,
    getMintLen,
    LENGTH_SIZE,
    TYPE_SIZE,
    createAssociatedTokenAccount,
} from "@solana/spl-token";
import {
    Keypair,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
    PublicKey
} from "@solana/web3.js";
import {
    createInitializeInstruction,
    pack,
    TokenMetadata,
} from "@solana/spl-token-metadata";
import dotenv from "dotenv";
import bs58 from "bs58";
dotenv.config();

// set these values in your .env file
const payer = Keypair.fromSecretKey(bs58.decode(process.env.NEXT_PUBLIC_PAYER_KEYPAIR!));
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_CLIENT!;
const connection = createRpc(RPC_ENDPOINT);

export default function zktoken() {

    const createAToken = async () => {
        const mint = Keypair.generate();
        const decimals = 9;

        const metadata: TokenMetadata = {
            mint: mint.publicKey,
            name: "Testing",
            symbol: "Testing",
            uri: "uri",
            additionalMetadata: [["key", "value"]],
        };

        const mintLen = getMintLen([ExtensionType.MetadataPointer]);

        const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

        // airdrop to pay gas
        // await confirmTx(
        //     connection,
        //     await connection.requestAirdrop(payer.publicKey, 1e7)
        // );

        const mintLamports = await connection.getMinimumBalanceForRentExemption(
            mintLen + metadataLen
        );
        const mintTransaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: payer.publicKey,
                newAccountPubkey: mint.publicKey,
                space: mintLen,
                lamports: mintLamports,
                programId: TOKEN_2022_PROGRAM_ID,
            }),
            createInitializeMetadataPointerInstruction(
                mint.publicKey,
                payer.publicKey,
                mint.publicKey,
                TOKEN_2022_PROGRAM_ID
            ),
            createInitializeMintInstruction(
                mint.publicKey,
                decimals,
                payer.publicKey,
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
                mintAuthority: payer.publicKey,
                updateAuthority: payer.publicKey,
            })
        );
        const txId = await sendAndConfirmTransaction(connection, mintTransaction, [
            payer,
            mint,
        ]);

        console.log(`txId: ${txId}`);

        // register the mint with the Compressed-Token program
        const txId2 = await createTokenPool(
            connection,
            payer,
            mint.publicKey,
            undefined,
            TOKEN_2022_PROGRAM_ID
        );
        console.log(`register-mint success! txId: ${txId2}`);

        const ata = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mint.publicKey,
            payer.publicKey,
            undefined,
            undefined,
            undefined,
            TOKEN_2022_PROGRAM_ID
        );

        console.log(`ATA: ${ata.address}`);
        // Mint SPL
        const mintTxId = await mintToSpl(
            connection,
            payer,
            mint.publicKey,
            ata.address,
            payer.publicKey,
            100000 * Math.pow(10, decimals),
            undefined,
            undefined,
            TOKEN_2022_PROGRAM_ID
        );
        console.log(`mint-spl success! txId: ${mintTxId}`);

        const compressedTokenTxId = await compress(
            connection,
            payer,
            mint.publicKey,
            100000 * Math.pow(10, decimals),
            payer,
            ata.address,
            payer.publicKey
        );
        console.log(`compressed-token success! txId: ${compressedTokenTxId}`);


    }

    const transferTokens = async () => {
        const mint = new PublicKey("8qWuGVfGe9drBiL47GHjySnAa8tEhkNQ6ACm9Rmw6yk3")
        const to = new PublicKey("9ynAU3rnmsocfstoDPaDxx9wVxf7kHEXzNbU4L55UcZ3")
        const transferCompressedTxId = await transfer(
            connection,
            payer,
            mint,
            1e9,
            payer,
            to
        );
        console.log(`transfer-compressed success! txId: ${transferCompressedTxId}`);
    }

    const display = async () => {
        const publicKey = new PublicKey("9ynAU3rnmsocfstoDPaDxx9wVxf7kHEXzNbU4L55UcZ3")

        const balances = await connection.getCompressedTokenBalancesByOwnerV2(publicKey);
        console.log(balances)
        console.log(balances.value.items[0].mint.toBase58());
        console.log(balances.value.items[0].balance.toString());


        const balances2 = await connection.getCompressedTokenBalancesByOwnerV2(payer.publicKey);
        console.log(balances2)
        for (let i = 0; i < 13; i++) {
            console.log(balances2.value.items[i].mint.toBase58());
            console.log(balances2.value.items[i].balance.toString());
        }
        console.log(1e9)
    }


    const decompress = async () => {
        // 1. Fetch compressed token accounts
        const mint = new PublicKey("8qWuGVfGe9drBiL47GHjySnAa8tEhkNQ6ACm9Rmw6yk3")
        const publicKey = new PublicKey("9kW2yZk3aex7oC2zvb4oxd6uAHurcMhi4d1QLhZUcRJB")
        const amount = 1e9

        const ata = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mint,
            publicKey,
            undefined,
            undefined,
            undefined,
            TOKEN_2022_PROGRAM_ID
        );
        console.log(ata.address.toBase58())

        const compressedTokenAccounts =
            await connection.getCompressedTokenAccountsByOwner(publicKey, {
                mint,
            });

        console.log(compressedTokenAccounts)

        // 2. Select
        const [inputAccounts] = selectMinCompressedTokenAccountsForTransfer(
            compressedTokenAccounts.items,
            bn(1e9)
        );
        console.log(inputAccounts)

        // 3. Fetch validity proof
        const proof = await connection.getValidityProof(
            inputAccounts.map((account) => account.compressedAccount.hash)
        );
        console.log(proof)

        // 4. Fetch & Select tokenPoolInfos
        const tokenPoolInfos = await getTokenPoolInfos(connection, mint);
        const selectedTokenPoolInfos = selectTokenPoolInfosForDecompression(
            tokenPoolInfos,
            1e9
        );
        console.log(tokenPoolInfos)
        console.log(selectedTokenPoolInfos)

        // 5. Build instruction
        const ix = await CompressedTokenProgram.decompress({
            payer: payer.publicKey,
            inputCompressedTokenAccounts: inputAccounts,
            toAddress: ata.address,
            amount,
            tokenPoolInfos: selectedTokenPoolInfos,
            recentInputStateRootIndices: proof.rootIndices,
            recentValidityProof: proof.compressedProof,
        });
        console.log(ix)


        // 6. Sign, send, and confirm.
        // Example with keypair:
        const { blockhash } = await connection.getLatestBlockhash();
        const signedTx = buildAndSignTx(
            [ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }), ix],
            payer,
            blockhash,
        );
        console.log(signedTx)

        
        try {
        return await sendAndConfirmTx(connection, signedTx);
        } catch (error) {
            console.log(error)
        }
    }
    return (
        <div>
            <button onClick={createAToken}>Create a Token</button>
            <button onClick={transferTokens}>Transfer Tokens</button>
            <button onClick={display}>Display</button>
            <button onClick={decompress}>Decompress</button>
        </div>
    )
}








