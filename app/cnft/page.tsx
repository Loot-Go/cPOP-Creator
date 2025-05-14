'use client'
import {
    generateSigner,
    keypairIdentity,
    some,
    none,
    percentAmount
} from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import bs58 from 'bs58'
import * as web3 from "@solana/web3.js"
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters'
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum'
import { mplTokenMetadata, createNft } from '@metaplex-foundation/mpl-token-metadata'

import { createTreeV2, mintV2, getAssetWithProof, parseLeafFromMintV2Transaction } from '@metaplex-foundation/mpl-bubblegum'
import { publicKey} from '@metaplex-foundation/umi'
const payer = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.NEXT_PUBLIC_PAYER_KEYPAIR!)
  );

const connection = 'https://api.devnet.solana.com'
const umi = createUmi(connection).use(mplBubblegum()).use(mplTokenMetadata()).use(keypairIdentity(fromWeb3JsKeypair(payer)))


export default function Cnft() {

    const _createNft = async () => {
        try {
            // Check account balance first
            // const balance = await umi.rpc.getBalance(umi.identity.publicKey);
            // const requiredBalance = BigInt(15115600); // 0.015 SOL in lamports
            
            // if (balance.basisPoints < requiredBalance) {
            //     console.error(`Insufficient balance. Required: ${Number(requiredBalance) / 1e9} SOL, Available: ${Number(balance.basisPoints) / 1e9} SOL`);
            //     alert(`Insufficient balance. Please add more SOL to your account. Required: ${Number(requiredBalance) / 1e9} SOL`);
            //     return;
            // }

            const nftMint = generateSigner(umi)
            const create = await createNft(umi, {
                mint: nftMint,
                name: "test",
                uri: "",
                isCollection: true,
                sellerFeeBasisPoints: percentAmount(5),
            }).sendAndConfirm(umi)
            console.log('NFT created successfully:', create)
        } catch (error: any) {
            console.error('Error creating NFT:', error);
            if (error.logs) {
                console.error('Transaction logs:', error.logs);
            }
            alert('Failed to create NFT. Check console for details.');
        }
    }

    const createTree = async () => {

    }

    const mintNft = async () => {

    }

    const checkTree = async () => {

    }



    return (
        <div>
            <button onClick={_createNft}>
                Create NFT
            </button>
            <button onClick={createTree}>
                Create Tree
            </button>
            <button onClick={mintNft}>
                Mint NFT
            </button>
            <button onClick={checkTree}>
                Check 
            </button>
        </div>
    )
}