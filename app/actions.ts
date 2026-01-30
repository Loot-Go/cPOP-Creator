"use server";

import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";


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
        id: randomUUID(),
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

export default createToken;
