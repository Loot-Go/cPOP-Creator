'use client'
import {
    generateSigner,
    keypairIdentity,
    some,
    none,
    percentAmount,
    Signer
} from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import bs58 from 'bs58'
import * as web3 from "@solana/web3.js"
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters'
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum'
import { mplTokenMetadata, createNft } from '@metaplex-foundation/mpl-token-metadata'

import { createTreeV2, mintV2, getAssetWithProof, parseLeafFromMintV2Transaction } from '@metaplex-foundation/mpl-bubblegum'
import { publicKey} from '@metaplex-foundation/umi'
import { useState } from 'react'
import { verifyCollectionV1 } from '@metaplex-foundation/mpl-token-metadata'
const payer = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.NEXT_PUBLIC_PAYER_KEYPAIR!)
  );

const connection = 'https://api.devnet.solana.com'
const umi = createUmi(connection).use(mplBubblegum()).use(mplTokenMetadata()).use(keypairIdentity(fromWeb3JsKeypair(payer)))


export default function Cnft() {
    const [merkleTree, setMerkleTree] = useState<Signer | null>(null);
    const collectionMint = publicKey('CQJyvumRwdLDEg7CNxxoatTio11Jwpw7p3wuH6eBqToA');

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
            console.log(nftMint.publicKey)
            const create = await createNft(umi, {
                mint: nftMint,
                name: "test kyoto",
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
        const newMerkleTree = generateSigner(umi);
        console.log(newMerkleTree.publicKey)
        setMerkleTree(newMerkleTree);

        const tree = await createTreeV2(umi, {
            merkleTree: newMerkleTree,
            maxDepth: 14,
            maxBufferSize: 64,
            canopyDepth: 8,
            treeCreator: umi.identity,
            public: false,
        });
        const send = await tree.sendAndConfirm(umi)
        console.log(send)
        console.log("✅ Merkle Tree created:", send.signature.toString());
    }

    const mintNft = async () => {
        if (!merkleTree) {
            alert('Please create a merkle tree first');
            return;
        }

        const tx1 = await mintV2(umi, {
            merkleTree: merkleTree.publicKey,
            leafOwner: publicKey(""),   // who will own the NFT
            metadata: {
              name: "Golden Ticket #1",
              uri: "https://example.com/nft1.json",
              sellerFeeBasisPoints: 500,         // 5% royalty (if using royalties)
              creators: [],                      // e.g. no creators array in this case
              collection: none(),                // no collection
            },
          }).sendAndConfirm(umi);
        console.log(tx1)
        const leaf1 = await parseLeafFromMintV2Transaction(umi, tx1.signature);
        console.log("✅ Minted cNFT #1 with collection. Asset ID:", leaf1.id);
    }

    const checkTree = async () => {

    }

    const verifyCollection = async () => {
        try {
            const verify = await verifyCollectionV1(umi, {
                collectionMint: collectionMint,
                authority: umi.identity,
                metadata: publicKey("2boWwPuvo7vAB13DSKZb17NYNs5yvjKpuiPiEErP2G1t")
            }).sendAndConfirm(umi);
            console.log('Collection verified:', verify);
        } catch (error: any) {
            console.error('Error verifying collection:', error);
            if (error.logs) {
                console.error('Transaction logs:', error.logs);
            }
        }
    };

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
            <button onClick={verifyCollection}>
                Verify Collection
            </button>
        </div>
    )
}