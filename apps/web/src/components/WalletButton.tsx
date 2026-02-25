"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

export function WalletButton() {
  const { connected, publicKey } = useWallet();
  const short = publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : null;

  return (
    <WalletMultiButton className="!bg-siren-primary !text-siren-bg !rounded !font-heading !font-semibold hover:!opacity-90 !transition-opacity" />
  );
}
