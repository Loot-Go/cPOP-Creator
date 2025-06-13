'use client'
import {
    generateSigner,
    keypairIdentity,
    some,
    Signer,
    PublicKey,
} from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import bs58 from 'bs58'
import * as web3 from "@solana/web3.js"
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters'
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum'
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata'
import { createTreeV2, mintV2 } from '@metaplex-foundation/mpl-bubblegum'
import { createCollection, mplCore, fetchCollection } from '@metaplex-foundation/mpl-core';
import { useState } from 'react'

const payer = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.NEXT_PUBLIC_PAYER_KEYPAIR!)
);

const connection = 'https://api.devnet.solana.com'
const umi = createUmi(connection).use(mplBubblegum()).use(mplTokenMetadata()).use(keypairIdentity(fromWeb3JsKeypair(payer))).use(mplCore());


export default function Cnft() {
    const [merkleTree, setMerkleTree] = useState<Signer | null>(null);
    const [recipientAddress, setRecipientAddress] = useState<string>('');
    const [collectionSigner, setCollectionSigner] = useState<Signer | null>(null);


    const _createCollection = async () => {
        try {
            const _collectionSigner = generateSigner(umi);
            setCollectionSigner(_collectionSigner)
            console.log("collection signer: ", collectionSigner)
            console.log("starting to create collection")

            const builder = createCollection(umi, {
                collection: _collectionSigner,
                name: 'test',
                uri: 'https://example.com/my-nft.json',
                plugins: [{ type: 'BubblegumV2' }],
            });

            console.log("built collection tx")


            const { signature } = await builder.sendAndConfirm(umi, {
                confirm: { commitment: 'finalized' },
            });

            console.log(signature.toString());

            const collection = await fetchCollection(umi, _collectionSigner.publicKey);
            console.log('on-chain collection', collection);
        } catch (error) {
            console.error(error)
        }
    };



    // @jijin only needed once for around 16k nfts -- can save this on db?
    const createTree = async () => {
        try {
            const newMerkleTree = generateSigner(umi);
            console.log('Merkle Tree Public Key:', newMerkleTree.publicKey);
            setMerkleTree(newMerkleTree);

            const tree = await createTreeV2(umi, {
                merkleTree: newMerkleTree,
                maxDepth: 14,
                maxBufferSize: 64,
                canopyDepth: 8,
            });
            const send = await tree.sendAndConfirm(umi, { confirm: { commitment: 'finalized' }});
            console.log('Tree creation transaction:', send);
            console.log("✅ Merkle Tree created:", send.signature.toString());

            // Wait for a moment to ensure the tree is fully initialized
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error: any) {
            console.error('Error creating tree:', error);
            if (error.logs) {
                console.error('Transaction logs:', error.logs);
            }
            alert('Failed to create tree. Check console for details.');
        }
    }



    const mintNft = async () => {
        try {
            if (!merkleTree) {
                alert('Please create a merkle tree first');
                return;
            }

            // First create the collection if it hasn't been created
            if (!collectionSigner!.publicKey) {
                alert('Please create a collection first');
                return;
            }

            console.log('Minting NFT with tree:', merkleTree.publicKey);
            console.log('Using collection:', collectionSigner!.publicKey);
            console.log(umi.identity.publicKey)
            const { signature } = await mintV2(umi, {
                collectionAuthority: umi.identity,
                leafOwner: umi.identity.publicKey,
                merkleTree: merkleTree.publicKey,
                treeCreatorOrDelegate: umi.identity,
                coreCollection: collectionSigner!.publicKey,
                metadata: {
                    name: 'My NFT',
                    uri: 'https://example.com/my-nft.json',
                    sellerFeeBasisPoints: 550, // 5.5%
                    collection: some(collectionSigner!.publicKey),
                    creators: [],
                },
            }).sendAndConfirm(umi);

            console.log('Mint transaction:', signature);
            console.log("✅ Minted cNFT successfully");
        } catch (error: any) {
            console.error('Error minting NFT:', error);
            if (error.logs) {
                console.error('Transaction logs:', error.logs);
            }
            alert('Failed to mint NFT. Check console for details.');
        }
    }


    return (
        <div>
            <button onClick={_createCollection}>
                Create Collection
            </button>
            <button onClick={createTree}>
                Create Tree
            </button>
            <div style={{ margin: '20px 0' }}>
                <input
                    type="text"
                    placeholder="Enter recipient's Solana address"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    style={{ padding: '8px', width: '400px' }}
                />
            </div>
            <button onClick={mintNft}>
                Mint NFT
            </button>


        </div>
    )
}





// @jijin not required/doesn't work
// const createCollection = async () => {
//     try {
//         const nftMint = generateSigner(umi);
//         console.log('Collection NFT Mint Address:', nftMint.publicKey);

//         // Create the collection NFT with proper metadata
//         const create = await createNft(umi, {
//             mint: nftMint,
//             name: "Testing metaplex",
//             uri: "https://example.com/collection.json",
//             isCollection: true,
//             sellerFeeBasisPoints: percentAmount(5),
//         }).sendAndConfirm(umi);

//         console.log('Collection NFT created successfully:', create);
//         setCollectionMint(nftMint.publicKey);


//     } catch (error: any) {
//         console.error('Error creating collection:', error);
//         if (error.logs) {
//             console.error('Transaction logs:', error.logs);
//         }
//         alert('Failed to create collection. Check console for details.');
//     }
// }





// const mintNft = async () => {
//     if (!merkleTree) {
//         alert('Please create a merkle tree first');
//         return;
//     }


//     if (!recipientAddress) {
//         alert('Please enter a recipient address');
//         return;
//     }

//     try {
//         // First check if the tree authority exists
//         const treeAuthority = await umi.rpc.getAccount(merkleTree.publicKey);
//         if (!treeAuthority.exists) {
//             alert('Tree authority not initialized. Please create the tree first.');
//             return;
//         }

//         // Convert the recipient address string to a PublicKey
//         const recipientPubkey = publicKey(recipientAddress);

//         console.log('Minting NFT with tree:', merkleTree.publicKey);
//         console.log('Minting to recipient:', recipientPubkey);

//         const { signature } = await mintV2(umi, {
//             collectionAuthority: umi.identity,
//             leafOwner: recipientPubkey, // Use the recipient's address
//             merkleTree: merkleTree.publicKey,
//             // @jijin the metadata
//             metadata: {
//                 name: 'My NFT',
//                 uri: 'https://example.com/my-nft.json',
//                 sellerFeeBasisPoints: 550, // 5.5%
//                 collection: none(),
//                 creators: [],
//             },
//         }).sendAndConfirm(umi)

//         const leaf = await parseLeafFromMintV2Transaction(umi, signature);
//         const assetId = leaf.id;
//         console.log('Mint transaction:', signature);
//         console.log("✅ Minted cNFT #1. Asset ID:", assetId);
//         console.log("Recipient:", recipientAddress);
//     } catch (error: any) {
//         console.error('Error minting NFT:', error);
//         if (error.logs) {
//             console.error('Transaction logs:', error.logs);
//         }
//         alert('Failed to mint NFT. Check console for details.');
//     }
// }
