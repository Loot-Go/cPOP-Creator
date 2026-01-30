# cPOP Creator

cPOP Creator is an open‑source toolkit for launching geo‑gated, compressed Proof‑of‑Presence (cPOP) campaigns on Solana. Organisers can mint collections, configure compression trees, pay campaign fees, and distribute rewards to attendees directly from a modern Next.js UI. Attendees claim rewards by checking into a physical location; the backend signer finalises the mint so the claimant never pays gas.

This document explains how to install, configure, operate, and extend the project.

---

## Table of Contents

1. [Project Highlights](#project-highlights)
2. [Architecture Overview](#architecture-overview)
3. [Prerequisites](#prerequisites)
4. [Environment Configuration](#environment-configuration)
5. [Installing & Running](#installing--running)
6. [Creating Campaigns](#creating-campaigns)
7. [Claim Flow](#claim-flow)
8. [Compression Trees & Fees](#compression-trees--fees)
9. [Backend Signer Responsibilities](#backend-signer-responsibilities)
10. [Key Files & Directories](#key-files--directories)
11. [Testing & Linting](#testing--linting)
12. [Deployment Guidelines](#deployment-guidelines)
13. [Security Considerations](#security-considerations)
14. [Contributing](#contributing)

---

## Project Highlights

- **End‑to‑end campaign tooling** – Organisers describe an event, upload art, set dates, and the app mints both the Bubblegum collection and the compressed drop.
- **Automated tree management** – Small drops can reuse a platform tree, larger drops are guided through custom tree creation.
- **Transparent fees** – Creators pay a flat `0.000095 SOL` per NFT before minting; funds are forwarded to a fee wallet to subsidise on‑chain claims later.
- **Walletless claiming** – Attendees sign in with any Solana wallet, but the backend signer covers mint fees and writes the compressed leaf when they check in.
- **Pluggable storage** – Metadata is uploaded via Umi’s Irys uploader; you can swap the uploader plugin if you prefer another storage layer.

---

## Architecture Overview

```
┌──────────────┐        ┌────────────────┐        ┌────────────────────┐
│ Next.js UI   │ <────> │ /api endpoints │ <────> │ Prisma + Umi stack │
└──────────────┘        └────────────────┘        └────────────────────┘
       ▲                        ▲                           ▲
       │                        │                           │
       │                Claim + Campaign APIs       Solana RPC (UmI)
       │                        │                           │
       ▼                        ▼                           ▼
┌──────────────┐        ┌────────────────┐        ┌────────────────────┐
│ Wallet users │        │ Backend signer │        │ Solana programs    │
└──────────────┘        └────────────────┘        └────────────────────┘
```

- **Frontend** – `/components/cpop-creator-form.tsx` contains the entire creator workflow; `/app/claim/[id]` handles player claims.
- **APIs** – `/api/claim` prepares or executes claim mints and logs attendance. Additional REST endpoints expose campaign metadata.
- **Backend signer** – The server holds a single keypair (`PAYER_KEYPAIR`). It mints cNFT leaves, delegates authority on collections, and pays all claim gas.
- **Compression** – Uses `@metaplex-foundation/mpl-bubblegum` for both tree creation (`createTreeV2`) and minting (`mintV2`).
- **Storage** – Metadata and art are pinned using `@metaplex-foundation/umi-uploader-irys`.

---

## Prerequisites

- **Node.js** v20+ (LTS recommended)
- **pnpm** v8+ or npm / yarn (pnpm lockfile provided)
- **PostgreSQL** (Prisma schema expects Postgres)
- **Solana CLI** (optional but useful for troubleshooting)
- **Access to a Solana RPC** (public RPC or a custom URL)
- **Backend signer keypair** exported as a Base58 string

---

## Environment Configuration

Create a `.env` (and `.env.local` for Next.js) containing:

### Core

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string for Prisma. |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet`, `testnet`, or `mainnet-beta` (used for explorer links). |
| `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT` | RPC URL the frontend should use when not provided by wallet adapter. |
| `PAYER_KEYPAIR` | Base58 secret key for the backend signer (never commit). |

### Compression Trees & Fees

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_PLATFORM_TREE_THRESHOLD` | Max NFT count that can reuse the platform tree (default `100`). |
| `NEXT_PUBLIC_DEFAULT_TREE_ADDRESS` | Public key of the platform‑managed compression tree (required if threshold > 0). |
| `NEXT_PUBLIC_PLATFORM_TREE_OPTION` | Tree option from `lib/tree-config.ts` to use for platform mints (e.g. `"16384"`). |
| `NEXT_PUBLIC_CREATOR_FEE_WALLET` | Address receiving creator fees (`0.000095 * amount`). |
| `NEXT_PUBLIC_BACKEND_COLLECTION_DELEGATE` | Address of the backend signer that should be granted collection update rights. |

### Metadata & UX

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Base URL for claim links / QR codes (optional). |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Example for any 3rd‑party map autocomplete (if used). |

> **Tip:** Use `dotenv-cli` or Next.js built‑in env handling to provide server-only vars. Client-side vars must start with `NEXT_PUBLIC_`.

---

## Installing & Running

```bash
# install dependencies (pnpm preferred)
pnpm install

# generate prisma client
pnpm prisma generate

# run migrations
pnpm prisma migrate deploy

# start dev server
pnpm dev

# build for prod
pnpm build && pnpm start
```

The default app runs at `http://localhost:3000`.

---

## Creating Campaigns

1. **Connect wallet** using the Solana wallet adapter component.
2. **Fill event data** – name, organiser, description, website, amount, dates, location.
3. **Upload cover art** – stored on Irys via the Umi uploader.
4. **Compression tree setup**:
   - If `amount <= NEXT_PUBLIC_PLATFORM_TREE_THRESHOLD`, the form auto-selects the platform tree.
   - Otherwise, either paste an existing tree address or click “Create New Tree” to build one on-chain (wallet pays for creation).
5. **Review creation fee** – the UI displays `0.000095 * amount` SOL. On submit this fee is transferred to `NEXT_PUBLIC_CREATOR_FEE_WALLET`.
6. **Submit** – the app:
   - Collects the SOL fee.
   - Creates a collection via `mpl-core`, uploading metadata and (if configured) adding an `UpdateDelegate` plugin with the backend signer.
   - Persists the campaign in Prisma.
7. **Success view** – shows claim instructions, campaign metadata, and the transaction used for collection creation.

---

## Claim Flow

1. Players open `/claim/[id]` (usually via QR).
2. They connect a wallet and authorise geolocation.
3. When within 200m of the drop, the client calls `/api/claim?id=...&wallet_address=...`.
4. The server:
   - Rechecks radius/time windows.
   - Confirms the player hasn’t claimed before.
   - Uses the backend signer + delegated authority to run `mintV2` with the campaign’s tree/collection data.
   - Records the claim in Prisma.
5. The API returns the on-chain signature; the client displays a “Claimed” view with an explorer link.

No SOL leaves the player’s wallet during claim – the backend signer creates the leaf and pays all fees.

---

## Compression Trees & Fees

- **Platform tree** – For small drops, pass `NEXT_PUBLIC_DEFAULT_TREE_ADDRESS` so creators can leverage your shared tree. They won’t see the manual tree UI in this case.
- **Custom tree** – For bigger drops, the UI exposes the tree builder powered by `createTreeV2`. Users specify canopy, depth, concurrency from `lib/tree-config.ts`.
- **Fee model** – Creators always pay `0.000095 SOL * amount`, regardless of tree selection. Adjust the constant in the form if your economics change.

---

## Backend Signer Responsibilities

The signer (loaded from `PAYER_KEYPAIR`) must:

1. Have enough SOL to mint all attendee leaves.
2. Be set as an update delegate on every collection (handled during creation).
3. Stay online or operate via a serverless function (API routes depend on it).

Rotate this key carefully and never expose it to the client.

---

## Key Files & Directories

| Path | Description |
| --- | --- |
| `components/cpop-creator-form.tsx` | Main campaign form, compression controls, fee collection logic. |
| `app/api/claim/route.ts` | Claim API: location checks, minting via backend signer, attendance recording. |
| `app/claim/[id]/claim-page-client.tsx` | Player claim UI. |
| `lib/tree-config.ts` | Canonical list of tree sizes (depth/cost). |
| `next.config.mjs` | Webpack tweaks (e.g., aliasing `pino-pretty`) and Next.js build config. |
| `prisma/schema.prisma` | Database models (`Cpop`, `CpopClaim`). |

---

## Testing & Linting

```bash
# type check
pnpm lint

# run tests (if you add Vitest/Jest)
pnpm test

# format with Prettier
pnpm format
```

> Automated tests are not bundled by default. Consider adding claim flow unit tests and integration tests for `/api/claim`.

---

## Deployment Guidelines

1. **Environment secrets** – Set all variables mentioned above in your deployment platform (Vercel, Render, etc.). `PAYER_KEYPAIR` should be stored as an encrypted secret.
2. **Database** – Deploy Postgres and point `DATABASE_URL` at the production instance.
3. **RPC throughput** – Use a reliable Solana RPC (e.g., Helius, Triton) for stable tree creation and mint confirmations.
4. **Webhooks/Monitoring** – Add alerts on the claim API to catch failures (e.g., due to drained backend signer balances).
5. **Static assets** – The app uses standard Next.js static hosting; no extra storage required besides whatever uploader plugin is configured.

---

## Security Considerations

- **Backend signer** – Treat `PAYER_KEYPAIR` like any hot wallet: restrict access, rotate periodically, and monitor outgoing signatures.
- **Creator fee wallet** – Funds collected are meant to subsidise claims; keep accounting records if sharing this repo with external organisers.
- **Rate limiting** – The claim endpoint relies on location checks but has no rate limiting by default. Consider adding middleware to thwart abuse.
- **Input validation** – The frontend uses Zod, but backend APIs should revalidate event metadata before saving (extend as needed).

---

## Contributing

1. Fork the repo and create a new branch.
2. Make your changes with clear commit messages.
3. Ensure lint/tests pass.
4. Open a pull request with a detailed description and screenshots if UI changes were made.

Feature ideas, bug reports, and documentation improvements are welcome. Join discussions via GitHub Issues to coordinate major changes.

---

Happy building! If you launch something with cPOP Creator, let the community know – cross-collaboration is encouraged. Reach out via Issues for support or share enhancements you think everyone should benefit from. 🎉
