import CPOPCreatorForm from "@/components/cpop-creator-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "cPOP Creator : Prove you were there, on Solana",
  description:
    "Create geo-gated NFT campaigns for real-world events. Attendees claim compressed NFTs at your location—no gas fees, no friction.",
};

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-2">
        Prove you were there, on Solana.
      </h1>
      <p className="text-center text-muted-foreground mb-8">
        Create geo-gated NFT campaigns for real-world events. Attendees claim
        compressed NFTs at your location—no gas fees, no friction.
      </p>
      <CPOPCreatorForm />
    </main>
  );
}
