"use client";

import { UploadButton } from "@/lib/uploadthing";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import createToken from "@/app/actions";
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
import Link from "next/link";
import LocationAutocomplete from "@/components/location-autocomplete";
import MintSuccess from "@/components/mint-success";

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
  const { connected, publicKey, wallet, connecting } = useWallet();
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

  // Log form errors for debugging
  useEffect(() => {
    const subscription = form.watch(() => {
      if (Object.keys(form.formState.errors).length > 0) {
        console.log("Form validation errors:", form.formState.errors);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

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

    try {
      setIsSubmitting(true);
      console.log("=== CALLING createToken ===");

      const { logs, cpop, error, message } = await createToken({
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
      });

      console.log("=== createToken RESPONSE ===", { logs, cpop, error, message });

      if (error) {
        console.log("createToken returned error:", message);
        toast({
          title: "Error",
          description: message as string,
          variant: "destructive",
        });
        return;
      } else {
        if (logs) {
          setCpop(cpop.id);

          // Find the last transaction (compress tokens) for the main transaction link
          const compressTx = logs.find((log: { type: string }) => log.type === "Compress Tokens");
          if (compressTx) {
            setTransactionUrl(compressTx.tx);
          } else if (logs.length > 0) {
            setTransactionUrl(logs[logs.length - 1].tx);
          }

          // Store event details for success page
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

          // Reset the form
          form.reset();
        }
      }
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
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.log("Form validation failed:", errors);
              // Show toast for validation errors
              const errorMessages = Object.entries(errors)
                .map(([field, error]) => `${field}: ${error?.message}`)
                .join(", ");
              toast({
                title: "Validation Error",
                description: errorMessages || "Please fill all required fields",
                variant: "destructive",
              });
            })} className="space-y-6">
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
                      <FormLabel>Event Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
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
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Event End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
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
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
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
                      Number of tokens to create
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
              {(form.formState.errors.latitude || form.formState.errors.longitude) && (
                <p className="text-sm font-medium text-destructive">
                  Please select a location from the dropdown to set coordinates
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !connected}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating cPOP...
                  </>
                ) : (
                  "Create cPOP Tokens"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

    </div>
  );
}
