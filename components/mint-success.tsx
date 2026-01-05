"use client";

import { useState, useEffect } from "react";
import { QRCode } from "react-qrcode-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { CalendarIcon, MapPinIcon, ExternalLinkIcon, ArrowLeftIcon, DownloadIcon, GlobeIcon, UserIcon, Copy, LinkIcon } from "lucide-react";

interface MintSuccessProps {
  cpopId: string;
  eventDetails: {
    eventName: string;
    organizerName: string;
    description: string;
    website: string;
    location: string;
    startDate: Date;
    endDate: Date;
    amount: number;
    imageUrl?: string;
  };
  transactionUrl?: string;
  onCreateAnother: () => void;
}

export default function MintSuccess({
  cpopId,
  eventDetails,
  transactionUrl,
  onCreateAnother,
}: MintSuccessProps) {
  const [claimUrl, setClaimUrl] = useState("");

  // Set claim URL on client side to avoid hydration mismatch
  useEffect(() => {
    setClaimUrl(`${window.location.origin}/claim/${cpopId}`);
  }, [cpopId]);

  const handleDownloadQR = async () => {
    try {
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        claimUrl
      )}`;

      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${eventDetails.eventName.replace(/\s+/g, "-")}-cpop-qr.png`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "QR code downloaded successfully",
      });
    } catch (error) {
      console.error("Error downloading QR code:", error);
      toast({
        title: "Error",
        description: "Failed to download QR code",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Success Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <svg
              className="w-8 h-8 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            cPOP Created Successfully!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your compressed Proof of Participation tokens are ready
          </p>
        </div>

        {/* QR Code Card */}
        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Scan to Claim</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Share this QR code with your event attendees
            </p>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-white rounded-lg">
              {claimUrl ? (
                <QRCode
                  value={claimUrl}
                  qrStyle="fluid"
                  size={200}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                />
              ) : (
                <div className="w-[200px] h-[200px] bg-gray-100 animate-pulse rounded" />
              )}
            </div>

            {/* Claim URL Display */}
            {claimUrl && (
              <div className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Claim Link:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs flex-1 truncate text-gray-700 dark:text-gray-300">
                    {claimUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(claimUrl);
                      toast({
                        title: "Copied!",
                        description: "Claim link copied to clipboard",
                      });
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleDownloadQR} variant="outline" className="gap-2">
                <DownloadIcon className="w-4 h-4" />
                Download QR
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => window.open(claimUrl, "_blank")}
              >
                <LinkIcon className="w-4 h-4" />
                Open Claim Page
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Event Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              {eventDetails.imageUrl && (
                <img
                  src={eventDetails.imageUrl}
                  alt={eventDetails.eventName}
                  className="w-20 h-20 rounded-lg object-cover"
                />
              )}
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                  {eventDetails.eventName}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <UserIcon className="w-4 h-4" />
                  <span>{eventDetails.organizerName}</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              {eventDetails.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CalendarIcon className="w-4 h-4 shrink-0" />
                <span>
                  {format(eventDetails.startDate, "MMM d, yyyy")} -{" "}
                  {format(eventDetails.endDate, "MMM d, yyyy")}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <MapPinIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{eventDetails.location}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <GlobeIcon className="w-4 h-4 shrink-0" />
                <a
                  href={eventDetails.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate hover:text-blue-500 transition-colors"
                >
                  {eventDetails.website}
                </a>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {eventDetails.amount} tokens
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Link */}
        {transactionUrl && (
          <Card>
            <CardContent className="py-4">
              <a
                href={transactionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  View Transaction on Solana Explorer
                </span>
                <ExternalLinkIcon className="w-4 h-4 text-gray-500" />
              </a>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-center pt-4">
          <Button onClick={onCreateAnother} variant="outline" className="gap-2">
            <ArrowLeftIcon className="w-4 h-4" />
            Create Another cPOP
          </Button>
        </div>
      </div>
    </div>
  );
}
