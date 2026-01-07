"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Copy,
  ExternalLink,
  QrCode,
  Users,
  Calendar,
  MapPin,
  Loader2,
  RefreshCw,
  Download,
} from "lucide-react";
import { QRCode } from "react-qrcode-logo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Cpop {
  id: string;
  eventName: string;
  organizerName: string;
  location: string;
  startDate: string;
  endDate: string;
  amount: number;
  imageUrl?: string;
  createdAt: string;
  tokenAddress?: string;
  _count: {
    claims: number;
  };
}

interface CpopListProps {
  creatorAddress: string;
}

export default function CpopList({ creatorAddress }: CpopListProps) {
  const [cpops, setCpops] = useState<Cpop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCpops = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/cpops?creator_address=${creatorAddress}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      const data = await response.json();
      setCpops(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (creatorAddress) {
      fetchCpops();
    }
  }, [creatorAddress]);

  const getClaimUrl = (cpopId: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/claim/${cpopId}`;
    }
    return `/claim/${cpopId}`;
  };

  const copyClaimLink = (cpopId: string) => {
    const url = getClaimUrl(cpopId);
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: "Claim link copied to clipboard",
    });
  };

  const handleDownloadQR = async (cpopId: string, eventName: string) => {
    try {
      const claimUrl = getClaimUrl(cpopId);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        claimUrl
      )}`;

      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${eventName.replace(/\s+/g, "-")}-cpop-qr.png`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Downloaded!",
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button variant="outline" onClick={fetchCpops}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (cpops.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-gray-500">No events created yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Create your first cPOP above
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Your Events ({cpops.length})</CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchCpops}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {cpops.map((cpop) => (
            <div
              key={cpop.id}
              className="p-4 border rounded-lg dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Image */}
                {cpop.imageUrl ? (
                  <img
                    src={cpop.imageUrl}
                    alt={cpop.eventName}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <QrCode className="w-6 h-6 text-gray-400" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{cpop.eventName}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(cpop.startDate), "MMM d, yyyy")}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {cpop.location.length > 20
                        ? cpop.location.slice(0, 20) + "..."
                        : cpop.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {cpop._count.claims} / {cpop.amount} claimed
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* QR Code Dialog */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <QrCode className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[340px] overflow-hidden flex flex-col items-center">
                      <DialogHeader>
                        <DialogTitle className="text-center">
                          {cpop.eventName}
                        </DialogTitle>
                      </DialogHeader>

                      <div className="flex flex-col items-center gap-4">
                        {/* QR Code */}
                        <div className="p-3 bg-white rounded-lg border">
                          <QRCode
                            value={getClaimUrl(cpop.id)}
                            qrStyle="fluid"
                            size={160}
                            bgColor="#FFFFFF"
                            fgColor="#000000"
                          />
                        </div>

                        {/* Download Button */}
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleDownloadQR(cpop.id, cpop.eventName)
                          }
                          className="gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download QR Code
                        </Button>

                        {/* Claim Link */}
                        <div className="max-w-[300px] p-3 bg-muted rounded-md">
                          <p className="text-xs text-muted-foreground mb-1">
                            Claim Link:
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs flex-1 min-w-0 truncate">
                              {getClaimUrl(cpop.id)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-8 w-8 p-0"
                              onClick={() => copyClaimLink(cpop.id)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Copy Link */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyClaimLink(cpop.id)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>

                  {/* Open Claim Page */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(getClaimUrl(cpop.id), "_blank")}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
