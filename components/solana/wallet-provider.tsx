"use client";

import type React from "react";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = WalletAdapterNetwork.Mainnet;

  // You can also provide a custom RPC endpoint
  const endpoint = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || clusterApiUrl(network);
    console.log("Using Solana endpoint:", url);
    return url;
  }, [network]);

  const wallets = useMemo(() => {
    const adapters = [new PhantomWalletAdapter()];
    console.log(
      "Initialized wallet adapters:",
      adapters.map((w) => w.name)
    );
    return adapters;
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider
        wallets={wallets}
        autoConnect={true}
        onError={(error) => {
          console.error("Wallet provider error:", error);
        }}
        localStorageKey="walletAdapter"
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
