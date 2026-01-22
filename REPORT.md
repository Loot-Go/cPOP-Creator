# Metaplex Grant Progress Report – cPOP Creator

## Project Overview

The cPOP Creator initiative delivers a self-service toolkit for brands and community organisers to create geo-gated, compressed Proof-of-Presence campaigns on Solana. By integrating Metaplex Bubblegum tooling, Umi helpers, and location-aware claim flows, we enable “check-in to earn” experiences without exposing end-users to gas fees or complex token minting steps.

This report summarises what has been built to date, how Metaplex technology is being used, outstanding work, and recommendations for the next phase.

---

## Objectives & Deliverables

| Goal | Status | Notes |
| --- | --- | --- |
| Build a creator portal for configuring cPOP campaigns | ✅ Delivered via `/components/cpop-creator-form.tsx`; integrates compression tree controls, fee collection, and collection minting. |
| Support Bubblegum tree creation + reuse flows | ✅ Users can create dedicated trees or leverage a platform-managed tree; tree sizes follow Metaplex docs. |
| Automate collection creation & delegate authority to backend signer | ✅ Uses `createCollection` (mpl-core) with `BubblegumV2` plugin plus `UpdateDelegate` assigned to backend signer. |
| Implement walletless claiming with backend signer | ✅ `/api/claim` handles location checks, mints via backend key, and records attendance. |
| Publish open-source documentation | ✅ Comprehensive README added; this report summarises grant progress. |

---

## Technical Summary

1. **Creator Workflow**
   - Built with Next.js and React Hook Form.
   - Uploader: `@metaplex-foundation/umi-uploader-irys`.
   - Tree creation: `createTreeV2` (Bubblegum) with configurable depth, canopy, concurrency.
   - Fee model: `0.000095 SOL * NFTs` collected upfront; funds routed to `NEXT_PUBLIC_CREATOR_FEE_WALLET`.
   - Collection creation: `createCollection` (mpl-core) with `BubblegumV2` plugin and optional `UpdateDelegate` plugin pointing to backend signer.

2. **Claim Flow**
   - Users connect wallet + share location.
   - Server validates radius/time, checks duplicates (Prisma).
   - Backend signer runs `mintV2` with delegated collection authority; no cost to claimant.
   - Transactions logged and exposed via explorer links.

3. **Compression Strategy**
   - Platform tree for drops ≤ threshold ensures operators can run many campaigns without repeated tree costs.
   - For larger drops, UI scaffolds tree creation and ensures size/cost align with Metaplex recommendations (table in `lib/tree-config.ts`).

4. **Security**
   - Wallet pop-ups only occur when necessary (tree creation, fee transfer).
   - Backend signer secret kept server-side; collection delegation assures future mints remain authorised even if creators churn.
   - Location verification uses Haversine checks (200m radius) to prevent remote claiming.

---

## Key Challenges & Resolutions

| Challenge | Resolution |
| --- | --- |
| **Multiple wallet prompts** during earlier compression flow | Eliminated legacy SPL transaction pipeline, adopted server-driven Bubblegum minting. |
| **Authority mismatch** between collection creator (user) and backend signer | Added `UpdateDelegate` plugin at collection creation, ensuring backend rights. |
| **Missing `pino-pretty` warning** via WalletConnect dependencies | Added webpack alias to mark `pino-pretty`/`lokijs` as externals. |
| **Tree configuration UX** | Introduced platform-tree fallback, detailed sizing table, and automatic default address injection. |

---

## Remaining Work / Future Enhancements

1. **Analytics & dashboarding** – Provide creators visibility into claim counts, unique wallets, and time-based activity.
2. **Advanced access control** – Support multi-signature backend signer or sponsor programs.
3. **Rate limiting / CAPTCHA** – Hardening claim endpoints against automated replay once network grows.
4. **Mobile-first UX** – Optimise for need-to-scan QR flows on mobile devices (claim page is responsive but can be enhanced).
5. **IAM for organiser teams** – Allow multiple organisers per campaign with viewing/edit roles.

---

## Budget & Resource Use

Metaplex funding supported:

- Engineering time dedicated to integrating Bubblegum + Umi primitives.
- RPC and infrastructure costs for devnet testing.
- UX/design iterations to make tree/fee flows understandable to non-technical organisers.

No grant funds were spent on paid media or unrelated features.

---

## Next Steps & Support Needed

1. **Audit** – A review of the claim smart interactions and backend key management by Metaplex engineers would be valuable before scaling.
2. **SDK alignment** – Guidance on upcoming Bubblegum updates (tree pooling, new metadata fields) so we can plan UI enhancements.
3. **Ecosystem integrations** – Explore how this tool can be listed or showcased within Metaplex documentation to help other teams adopt it.

---

## Contact

- **Project Lead:** LootGO / cPOP Creator Team
- **Repository:** https://github.com/lootgo/cpop-creator
- **Support:** Please open an issue or reach out directly for deeper collaboration.

Thank you to the Metaplex Foundation for supporting this work—your grant allowed us to ship a production-ready cPOP experience that demonstrates a practical, real-world use case for Bubblegum-based compression.
