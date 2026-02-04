"use client";

import { UploadButton } from "@/lib/uploadthing";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { WalletMultiButton } from "@/components/solana/wallet-multi-button";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  generateSigner,
  publicKey as umiPublicKey,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import bs58 from "bs58";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys/web";
import { createTreeV2, mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import {
  createCollection as createUmiCollection,
  fetchCollection,
  mplCore,
} from "@metaplex-foundation/mpl-core";
import Link from "next/link";
import LocationAutocomplete from "@/components/location-autocomplete";
import MintSuccess from "@/components/mint-success";
import CpopList from "@/components/cpop-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { treeSizeOptions, type TreeSizeOption } from "@/lib/tree-config";
import createToken from "@/app/actions";

const PLATFORM_TREE_THRESHOLD = Number(
  process.env.NEXT_PUBLIC_PLATFORM_TREE_THRESHOLD ?? 100
);
const DEFAULT_PLATFORM_TREE_ADDRESS =
  process.env.NEXT_PUBLIC_DEFAULT_TREE_ADDRESS || "";
const PLATFORM_TREE_OPTION_VALUE =
  process.env.NEXT_PUBLIC_PLATFORM_TREE_OPTION || treeSizeOptions[0].value;
const CREATOR_FEE_WALLET =
  process.env.NEXT_PUBLIC_CREATOR_FEE_WALLET || "";
const BACKEND_COLLECTION_DELEGATE =
  process.env.NEXT_PUBLIC_BACKEND_COLLECTION_DELEGATE || "";

const formSchema = z
  .object({
    eventName: z.string().min(2, {
      message: "Event name must be at least 2 characters.",
    }),
    organizerName: z.string().min(2, {
      message: "Organizer name must be at least 2 characters.",
    }),
    imageUrl: z.string().optional(),
    description: z.string().min(10, {
      message: "Description must be at least 10 characters.",
    }),
    website: z.string().url({
      message: "Please enter a valid URL.",
    }),
    startDate: z.date({
      required_error: "Please select a start date.",
    }),
    latitude: z.string().min(1, {
      message: "Latitude is required.",
    }),
    longitude: z.string().min(1, {
      message: "Longitude is required.",
    }),
    endDate: z
      .date({
        required_error: "Please select an end date.",
      })
      .refine((date) => date > new Date(), {
        message: "End date must be in the future.",
      }),
    amount: z.coerce.number().int().positive({
      message: "Amount must be a positive number.",
    }),
    location: z.string().min(2, {
      message: "Location must be at least 2 characters.",
    }),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
  });

export default function CPOPCreatorForm() {
  const { connected, publicKey, wallet, connecting, sendTransaction } =
    useWallet();
  const [cpop, setCpop] = useState<string | null>(null);
  const [transactionUrl, setTransactionUrl] = useState<string | null>(null);
  const [successEventDetails, setSuccessEventDetails] = useState<{
    eventName: string;
    organizerName: string;
    description: string;
    website: string;
    location: string;
    startDate: Date;
    endDate: Date;
    amount: number;
    imageUrl?: string;
  } | null>(null);
  const { connection } = useConnection();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [treeInput, setTreeInput] = useState("");
  const [treeAddress, setTreeAddress] = useState<string | null>(null);
  const [treeStatusMessage, setTreeStatusMessage] = useState<string | null>(
    null
  );
  const [isFetchingTree, setIsFetchingTree] = useState(false);
  const [isCreatingTree, setIsCreatingTree] = useState(false);
  const [treeSize, setTreeSize] = useState(treeSizeOptions[0].value);
  const [isTreePublic, setIsTreePublic] = useState(false);
  const [collectionAddress, setCollectionAddress] = useState<string | null>(
    null
  );
  const [collectionStatusMessage, setCollectionStatusMessage] = useState<
    string | null
  >(null);
  const selectedTreeSize: TreeSizeOption =
    treeSizeOptions.find((option) => option.value === treeSize) ??
    treeSizeOptions[0];
  const resolveRpcEndpoint = () =>
    connection?.rpcEndpoint ||
    (connection as unknown as { _rpcEndpoint?: string })._rpcEndpoint ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT ||
    clusterApiUrl("mainnet-beta");
  const initializeUmi = () => {
    if (!wallet?.adapter) {
      throw new Error("Wallet adapter not available");
    }
    return createUmi(resolveRpcEndpoint())
      .use(walletAdapterIdentity(wallet.adapter))
      .use(mplCore())
      .use(mplBubblegum())
      .use(irysUploader());
  };

  // Add effect to log wallet state changes
  useEffect(() => {
    console.log("Wallet state changed:", {
      connected,
      connecting,
      publicKey: publicKey?.toString(),
      wallet: wallet?.adapter.name,
    });
  }, [connected, connecting, publicKey, wallet]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eventName: "",
      organizerName: "",
      imageUrl: "",
      description: "",
      website: "",
      amount: 100,
      location: "",
      latitude: "",
      longitude: "",
    },
  });
  const platformTreeSize =
    treeSizeOptions.find(
      (option) => option.value === PLATFORM_TREE_OPTION_VALUE
    ) ?? treeSizeOptions[0];
  const amountValue = Number(form.watch("amount") || 0);
  const isPlatformTreeConfigured = Boolean(DEFAULT_PLATFORM_TREE_ADDRESS);
  const usePlatformTree =
    isPlatformTreeConfigured &&
    amountValue > 0 &&
    amountValue <= PLATFORM_TREE_THRESHOLD;
  const activeTreeSize = usePlatformTree ? platformTreeSize : selectedTreeSize;
  const treeSizeDetails = `Depth ${activeTreeSize.treeDepth} · Canopy ${
    activeTreeSize.canopyDepth
  } · Buffer ${activeTreeSize.concurrencyBuffer} · ~${activeTreeSize.costPerCNFT.toFixed(
    8
  )} SOL per cNFT.`;
  const totalCreationCostSol = 0.000095 * (amountValue || 0);
  const totalCreationCostLamports = Math.ceil(
    totalCreationCostSol * LAMPORTS_PER_SOL
  );

  // Log form errors for debugging
  useEffect(() => {
    const subscription = form.watch(() => {
      if (Object.keys(form.formState.errors).length > 0) {
        console.log("Form validation errors:", form.formState.errors);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (usePlatformTree && DEFAULT_PLATFORM_TREE_ADDRESS) {
      setTreeAddress(DEFAULT_PLATFORM_TREE_ADDRESS);
      setTreeStatusMessage(
        "Using platform-managed compression tree for this drop."
      );
    } else if (usePlatformTree && !DEFAULT_PLATFORM_TREE_ADDRESS) {
      setTreeStatusMessage(
        "Platform tree not configured. Please create or supply your own tree."
      );
      setTreeAddress(null);
    } else if (!usePlatformTree && treeAddress === DEFAULT_PLATFORM_TREE_ADDRESS) {
      setTreeAddress(null);
      setTreeStatusMessage(null);
    }
  }, [usePlatformTree, treeAddress]);

  async function fetchTree() {
    if (!treeInput.trim()) {
      toast({
        title: "Enter a tree address",
        description: "Paste an existing compression tree address to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsFetchingTree(true);
      const normalizedAddress = new PublicKey(treeInput.trim()).toBase58();
      setTreeAddress(normalizedAddress);
      setTreeInput(normalizedAddress);
      setTreeStatusMessage(
        "Using your existing compression tree. Save this address for future cPOP mints."
      );
      toast({
        title: "Tree ready",
        description: "We will use the provided tree for compression.",
      });
    } catch (error) {
      console.error("Invalid tree address:", error);
      toast({
        title: "Invalid tree address",
        description: "Please provide a valid Solana address.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingTree(false);
    }
  }

  async function createTree() {
    if (!connected || !publicKey || !wallet?.adapter) {
      toast({
        title: "Connect wallet",
        description: "A connected wallet is required to create a tree.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreatingTree(true);
      setTreeStatusMessage("Creating Bubblegum tree on Solana...");

      const umi = initializeUmi();

      const newMerkleTree = generateSigner(umi);
      const treeBuilder = await createTreeV2(umi, {
        merkleTree: newMerkleTree,
        maxDepth: selectedTreeSize.treeDepth,
        maxBufferSize: selectedTreeSize.concurrencyBuffer,
        canopyDepth: selectedTreeSize.canopyDepth,
      });

      const response = await treeBuilder.sendAndConfirm(umi, {
        send: { skipPreflight: false },
        confirm: { strategy: { type: "polling" }, commitment: "finalized" },
      });

      console.log("Tree creation transaction:", response);
      if ("signature" in response && response.signature) {
        console.log("✅ Merkle Tree created:", bs58.encode(response.signature));
      }

      // brief delay to allow tree to finalize
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const newTreeAddress = newMerkleTree.publicKey.toString();
      setTreeAddress(newTreeAddress);
      setTreeInput(newTreeAddress);
      setTreeStatusMessage(
        `Tree created (${isTreePublic ? "public" : "private"}) with depth ${
          selectedTreeSize.treeDepth
        } and canopy ${
          selectedTreeSize.canopyDepth
        }. Save this address for future use.`
      );

      toast({
        title: "Tree created",
        description: "Copy and store this address safely.",
      });
    } catch (error) {
      console.error("Error creating tree:", error);
      setTreeStatusMessage("Failed to create tree. Please try again.");
      toast({
        title: "Unable to create tree",
        description:
          error instanceof Error
            ? error.message
            : "Please try again after checking your wallet approval.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingTree(false);
    }
  }

  const collectCreationFee = async (lamports: number) => {
    console.log("=== collectCreationFee called ===", { lamports, CREATOR_FEE_WALLET });
    if (lamports <= 0) {
      console.log("Fee collection skipped: lamports <= 0");
      return null;
    }
    if (!connected || !publicKey) {
      throw new Error("Connect your wallet to pay the creation fee.");
    }
    if (!CREATOR_FEE_WALLET) {
      throw new Error("Creator fee wallet not configured.");
    }
    if (!sendTransaction) {
      throw new Error("Wallet is not ready to send transactions.");
    }

    console.log("Creating fee transfer transaction...", {
      from: publicKey.toString(),
      to: CREATOR_FEE_WALLET,
      lamports,
    });

    const transferTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(CREATOR_FEE_WALLET),
        lamports,
      })
    );

    console.log("Sending fee transaction...");
    const signature = await sendTransaction(transferTx, connection);
    console.log("Fee transaction sent, awaiting confirmation:", signature);
    await connection.confirmTransaction(signature, "confirmed");
    console.log("Fee transaction confirmed:", signature);
    return signature;
  };

  async function createCollectionOnChain(
    values: z.infer<typeof formSchema>,
    feeLamports?: number
  ) {
    if (!connected || !publicKey || !wallet?.adapter) {
      throw new Error("Connect wallet before creating a collection.");
    }

    try {
      setCollectionStatusMessage("Creating cPOP collection via Metaplex...");
      setCollectionAddress(null);

      const umi = initializeUmi();
      const collectionSigner = generateSigner(umi);
      const collectionName =
        values.eventName.trim().slice(0, 32) || "cPOP Collection";
      const fallbackMetadataUri =
        values.website?.trim() || "https://example.com";
      let metadataUri = fallbackMetadataUri;

      try {
        metadataUri = await umi.uploader.uploadJson({
          name: collectionName,
          description: values.description,
          image: values.imageUrl,
          external_url: values.website,
        });
      } catch (metadataError) {
        console.error("Error uploading collection metadata:", metadataError);
      }

      const collectionPlugins = [
        { type: "BubblegumV2" },
        ...(BACKEND_COLLECTION_DELEGATE
          ? [
              {
                type: "UpdateDelegate" as const,
                data: {
                  additionalDelegates: [
                    umiPublicKey(BACKEND_COLLECTION_DELEGATE),
                  ],
                },
                authority: { type: "UpdateAuthority" as const },
              },
            ]
          : []),
      ];

      const collectionBuilder = createUmiCollection(umi, {
        collection: collectionSigner,
        name: collectionName,
        uri: metadataUri,
        plugins: [
          { type: "BubblegumV2" },
          {
          type: "UpdateDelegate" as const,
          // data: {
            additionalDelegates: [
              umiPublicKey(BACKEND_COLLECTION_DELEGATE),
            ],
          // },
          authority: { type: "UpdateAuthority" as const },
        }],
      });

      // Bundle fee transfer with collection creation if fee is provided
      let finalBuilder = collectionBuilder;
      if (feeLamports && feeLamports > 0 && CREATOR_FEE_WALLET) {
        console.log("Bundling fee transfer with collection creation:", {
          feeLamports,
          feeWallet: CREATOR_FEE_WALLET,
        });

        // Create manual system transfer instruction in UMI format
        const systemProgramId = umiPublicKey('11111111111111111111111111111111');

        // Encode the transfer instruction data (instruction index 2 = transfer, followed by lamports as u64)
        const transferData = new Uint8Array(12);
        transferData[0] = 2; // Transfer instruction
        transferData[1] = 0;
        transferData[2] = 0;
        transferData[3] = 0;
        // Write lamports as little-endian u64
        const lamportsView = new DataView(transferData.buffer);
        lamportsView.setBigUint64(4, BigInt(feeLamports), true);

        const transferInstruction = {
          programId: systemProgramId,
          keys: [
            { pubkey: umi.identity.publicKey, isSigner: true, isWritable: true },
            { pubkey: umiPublicKey(CREATOR_FEE_WALLET), isSigner: false, isWritable: true },
          ],
          data: transferData,
        };

        // Bundle the fee transfer with collection creation
        finalBuilder = transactionBuilder()
          .add({ instruction: transferInstruction, signers: [umi.identity], bytesCreatedOnChain: 0 })
          .add(collectionBuilder);
      }

      // Send transaction without WebSocket subscription (use polling instead)
      const { signature } = await finalBuilder.sendAndConfirm(umi, {
        send: { skipPreflight: false },
        confirm: { strategy: { type: "polling" }, commitment: "finalized" },
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));
      await fetchCollection(umi, collectionSigner.publicKey);

      const newCollectionAddress = collectionSigner.publicKey.toString();
      setCollectionAddress(newCollectionAddress);
      setCollectionStatusMessage(
        `Collection created for "${values.eventName}". Save this address for future drops.`
      );

      toast({
        title: "Collection created",
        description: "Copy and store the collection address safely.",
      });

      return {
        address: newCollectionAddress,
        signature: signature ? bs58.encode(signature) : undefined,
      };
    } catch (error) {
      console.error("Error creating collection:", error);
      setCollectionStatusMessage(
        "Failed to create collection. Please try again."
      );
      throw error;
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("=== FORM SUBMITTED SUCCESSFULLY ===");
    console.log("Form values:", values);
    console.log("Wallet state:", {
      connected,
      connecting,
      publicKey: publicKey?.toString(),
      wallet: wallet?.adapter.name,
    });

    // Wait for wallet to finish connecting if it's in the process
    if (connecting) {
      toast({
        title: "Connecting wallet...",
        description: "Please wait while we connect your wallet.",
      });
      return;
    }

    if (!connected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your Solana wallet to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!publicKey) {
      toast({
        title: "No public key",
        description:
          "Unable to get your wallet's public key. Please try reconnecting your wallet.",
        variant: "destructive",
      });
      return;
    }

    if (!wallet) {
      toast({
        title: "No wallet instance",
        description:
          "Unable to access wallet instance. Please try reconnecting your wallet.",
        variant: "destructive",
      });
      return;
    }

    const resolvedTreeAddress = usePlatformTree
      ? DEFAULT_PLATFORM_TREE_ADDRESS
      : treeAddress;

    if (!resolvedTreeAddress) {
      toast({
        title: "Compression tree required",
        description:
          "Please provide a compression tree address before minting tokens.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      console.log("=== STARTING cPOP CREATION ===");
      console.log("Fee calculation:", {
        amountValue,
        totalCreationCostSol,
        totalCreationCostLamports,
        CREATOR_FEE_WALLET,
      });

      // Bundle fee collection with collection creation (saves 1 transaction!)
      const collectionResult = await createCollectionOnChain(
        values,
        totalCreationCostLamports > 0 ? totalCreationCostLamports : undefined
      );
      console.log("=== createCollection RESPONSE ===", collectionResult);

      const { cpop, error, message } = await createToken({
        name: values.eventName,
        symbol: values.organizerName,
        uri: values.website,
        additionalMetadata: [
          ["description", values.description],
          ["location", values.location],
          ["startDate", values.startDate.toISOString()],
          ["endDate", values.endDate.toISOString()],
        ],
        eventName: values.eventName,
        organizerName: values.organizerName,
        description: values.description,
        website: values.website,
        startDate: values.startDate,
        imageUrl: values.imageUrl,
        endDate: values.endDate,
        amount: values.amount,
        location: values.location,
        latitude: parseFloat(values.latitude),
        longitude: parseFloat(values.longitude),
        creator_address: publicKey.toString(),
        treeAddress: resolvedTreeAddress || undefined,
        collectionAddress: collectionResult?.address,
        collectionSignature: collectionResult?.signature,
      });

      console.log("=== createToken RESPONSE ===", {
        cpop,
        error,
        message,
      });

      if (error || !cpop) {
        console.log("createToken returned error:", message);
        toast({
          title: "Error",
          description:
            typeof message === "string"
              ? message
              : "Failed to save cPOP metadata.",
          variant: "destructive",
        });
        return;
      }

      setCpop(cpop.id);
      const explorerCluster =
        process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta";
      if (collectionResult?.signature) {
        setTransactionUrl(
          `https://explorer.solana.com/tx/${collectionResult.signature}?cluster=${explorerCluster}`
        );
      } else {
        setTransactionUrl(null);
      }

      setSuccessEventDetails({
        eventName: values.eventName,
        organizerName: values.organizerName,
        description: values.description,
        website: values.website,
        location: values.location,
        startDate: values.startDate,
        endDate: values.endDate,
        amount: values.amount,
        imageUrl: values.imageUrl,
      });

      toast({
        title: "cPOP created!",
        description: `Successfully created ${values.amount} cPOP tokens for "${values.eventName}"`,
      });

      form.reset();
    } catch (error) {
      console.error("Error creating cPOP:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create cPOP tokens. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Show success page if cpop was created
  if (cpop && successEventDetails) {
    return (
      <MintSuccess
        cpopId={cpop}
        eventDetails={successEventDetails}
        transactionUrl={transactionUrl || undefined}
        onCreateAnother={() => {
          setCpop(null);
          setTransactionUrl(null);
          setSuccessEventDetails(null);
        }}
      />
    );
  }

  return (
    <div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end mb-6 gap-4 items-center">
            {publicKey ? (
              <Link
                href={`/view/${publicKey?.toString()}`}
                className="mr-4 text-gray-400 hover:text-gray-200"
              >
                View Events
              </Link>
            ) : null}

            <WalletMultiButton />
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit, (errors) => {
                console.log("Form validation failed:", errors);
                // Show toast for validation errors
                const errorMessages = Object.entries(errors)
                  .map(([field, error]) => `${field}: ${error?.message}`)
                  .join(", ");
                toast({
                  title: "Validation Error",
                  description:
                    errorMessages || "Please fill all required fields",
                  variant: "destructive",
                });
              })}
              className="space-y-6"
            >
              <div className="grid grid-cols-3 gap-6">
                <div className="grid place-items-center">
                  <div>
                    {form.watch("imageUrl") ? (
                      <div className="w-full grid place-items-center">
                        <img
                          src={form.watch("imageUrl")}
                          alt=""
                          className="w-40 h-40 rounded-full"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-400 mb-2 text-center text-xs">
                          Upload an image for your cPOP
                        </p>
                        <UploadButton
                          endpoint="imageUploader"
                          onClientUploadComplete={(res) => {
                            console.log("Files: ", res);
                            form.setValue("imageUrl", res[0].ufsUrl);
                          }}
                          onUploadError={(error: Error) => {
                            alert(`ERROR! ${error.message}`);
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className="col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="eventName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Solana Hackathon 2025"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="organizerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organizer Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Solana Foundation" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your event and what participants will receive"
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://yourevent.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Event Start Date & Time</FormLabel>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "flex-1 pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "MMM d, yyyy")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                if (date) {
                                  const currentTime = field.value || new Date();
                                  date.setHours(currentTime.getHours());
                                  date.setMinutes(currentTime.getMinutes());
                                  field.onChange(date);
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Input
                          type="time"
                          className="w-[120px]"
                          value={
                            field.value ? format(field.value, "HH:mm") : ""
                          }
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value
                              .split(":")
                              .map(Number);
                            const newDate = field.value
                              ? new Date(field.value)
                              : new Date();
                            newDate.setHours(hours || 0);
                            newDate.setMinutes(minutes || 0);
                            field.onChange(newDate);
                          }}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Event End Date & Time</FormLabel>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "flex-1 pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "MMM d, yyyy")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                if (date) {
                                  const currentTime = field.value || new Date();
                                  date.setHours(currentTime.getHours());
                                  date.setMinutes(currentTime.getMinutes());
                                  field.onChange(date);
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Input
                          type="time"
                          className="w-[120px]"
                          value={
                            field.value ? format(field.value, "HH:mm") : ""
                          }
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value
                              .split(":")
                              .map(Number);
                            const newDate = field.value
                              ? new Date(field.value)
                              : new Date();
                            newDate.setHours(hours || 0);
                            newDate.setMinutes(minutes || 0);
                            field.onChange(newDate);
                          }}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount of cPOP</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormDescription>
                      Number of tokens to create. Drops with{" "}
                      {`\u2264 ${PLATFORM_TREE_THRESHOLD}`} cNFTs automatically use
                      our managed compression tree.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location Autocomplete with Map */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <LocationAutocomplete
                        defaultValue={field.value}
                        onLocationSelect={(location) => {
                          form.setValue("location", location.address);
                          form.setValue("latitude", location.lat.toString());
                          form.setValue("longitude", location.lng.toString());
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Search for a location to auto-fill coordinates
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Hidden fields for lat/lng - still validated but auto-filled */}
              <input type="hidden" {...form.register("latitude")} />
              <input type="hidden" {...form.register("longitude")} />

              {/* Show error if location not selected from autocomplete */}
              {(form.formState.errors.latitude ||
                form.formState.errors.longitude) && (
                <p className="text-sm font-medium text-destructive">
                  Please select a location from the dropdown to set coordinates
                </p>
              )}

              {usePlatformTree ? (
                <div className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-muted/30 p-4">
                  <p className="text-sm font-medium">Platform compression tree</p>
                  <p className="text-sm text-muted-foreground">
                    This drop mints fewer than {PLATFORM_TREE_THRESHOLD} cNFTs, so it will
                    use the platform-managed tree automatically.
                  </p>
                  {DEFAULT_PLATFORM_TREE_ADDRESS ? (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                      <p className="font-medium">Tree address</p>
                      <p className="font-mono text-xs break-all">
                        {DEFAULT_PLATFORM_TREE_ADDRESS}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Keep this handy if you need to reference the tree.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-destructive">
                      Platform tree address is not configured. Please contact the team.
                    </p>
                  )}
                </div>
              ) : (
              <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">Compression tree</p>
                  <p className="text-sm text-muted-foreground">
                    Configure or reference the Bubblegum state tree required for
                    this cPOP drop. You can reuse an existing tree or define a
                    new one with the specs below.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">
                    Use an existing tree
                  </p>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <Input
                      placeholder="Enter existing tree address"
                      value={treeInput}
                      onChange={(event) => setTreeInput(event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={fetchTree}
                      disabled={isFetchingTree}
                    >
                      {isFetchingTree ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        "Use Tree"
                      )}
                    </Button>
                  </div>
                </div>

                <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground">
                  or
                </p>

                <div className="space-y-2">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">
                    Create a new tree
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-muted-foreground tracking-widest">
                        Tree size
                      </p>
                      <Select value={treeSize} onValueChange={setTreeSize}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose tree size" />
                        </SelectTrigger>
                        <SelectContent>
                          {treeSizeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.leaves.toLocaleString()} cNFTs —{" "}
                              {option.treeCost.toFixed(4)} SOL
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {treeSizeDetails}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-muted-foreground tracking-widest">
                        Public availability
                      </p>
                      <div className="flex items-center gap-3">
                        <Switch
                          id="tree-public-toggle"
                          checked={isTreePublic}
                          onCheckedChange={setIsTreePublic}
                        />
                        <label
                          htmlFor="tree-public-toggle"
                          className="text-sm font-medium leading-none"
                        >
                          {isTreePublic ? "Public tree" : "Private tree"}
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isTreePublic
                          ? "Public: anyone can append to this tree, so partners may reuse it."
                          : "Private: only you (or delegated authorities) should write to it."}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 md:flex-row md:items-center mt-6">
                    <Button
                      type="button"
                      onClick={createTree}
                      disabled={isCreatingTree || !connected}
                    >
                      {isCreatingTree ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating tree...
                        </>
                      ) : (
                        "Create New Tree"
                      )}
                    </Button>
                    {!connected && (
                      <p className="text-sm text-muted-foreground">
                        Connect your wallet to create a tree.
                      </p>
                    )}
                  </div>
                </div>

              </div>
              )}

              <div className="space-y-3">
                {treeStatusMessage && (
                  <p className="text-xs text-muted-foreground">
                    {treeStatusMessage}
                  </p>
                )}

                {treeAddress && (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                    <p className="font-medium">Tree address</p>
                    <p className="font-mono text-xs break-all">{treeAddress}</p>
                    <p className="text-xs text-muted-foreground">
                      Save this for future use.
                    </p>
                  </div>
                )}
                {collectionStatusMessage && (
                  <p className="text-xs text-muted-foreground">
                    {collectionStatusMessage}
                  </p>
                )}
                {collectionAddress && (
                  <div className="rounded-md border border-indigo-500/40 bg-indigo-500/5 p-3 text-sm">
                    <p className="font-medium">Collection address</p>
                    <p className="font-mono text-xs break-all">
                      {collectionAddress}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Save this for future use.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-dashed border-primary/30 bg-muted/20 p-4 space-y-1">
                <p className="text-sm font-medium">Total Mint Fee</p>
                <p className="text-xl font-semibold">
                  {totalCreationCostSol.toFixed(4)} SOL
                </p>
                <p className="text-xs text-muted-foreground">
                  Calculated as {amountValue || 0} NFTs ×{" "}
                  0.000095 SOL per NFT.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={
                  isSubmitting || !connected || (!usePlatformTree && !treeAddress)
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Collection...
                  </>
                ) : (
                  "Create cPOP Collection"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Show list of created cPOPs when wallet is connected */}
      {connected && publicKey && (
        <div className="mt-8">
          <CpopList creatorAddress={publicKey.toString()} />
        </div>
      )}
    </div>
  );
}
