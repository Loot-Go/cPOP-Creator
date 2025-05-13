import { createNft } from "@metaplex-foundation/mpl-token-metadata";

import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, percentAmount } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { base58 } from "@metaplex-foundation/umi/serializers";

export const NFTDrop = async () => {
  const umi = createUmi(
    "https://devnet-aura.metaplex.com/18de00dc-cad1-42c4-ba30-8499bcaeb9a1"
  )
    .use(mplTokenMetadata())
    .use(irysUploader({ address: "https://devnet.irys.xyz" }));

  const nftSigner = generateSigner(umi);
  const metadataUri = "https://i.imgur.com/SxNUnRZ.jpeg";

  const tx = await createNft(umi, {
    mint: nftSigner,
    sellerFeeBasisPoints: percentAmount(5.5),
    name: "My NFT",
    uri: metadataUri,
  }).sendAndConfirm(umi);

  // finally we can deserialize the signature that we can check on chain.
  // import { base58 } from "@metaplex-foundation/umi/serializers";

  console.log(base58.deserialize(tx.signature)[0]);
};
