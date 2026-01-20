"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@/components/solana/wallet-multi-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import {
  MapPinIcon,
  CalendarIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  Navigation,
  AlertCircle,
  Clock,
} from "lucide-react";

interface CpopDetails {
  id: string;
  eventName: string;
  organizerName: string;
  description: string;
  website: string;
  location: string;
  startDate: string;
  endDate: string;
  amount: number;
  imageUrl?: string;
  lat: number;
  long: number;
  tokenAddress: string;
}

interface ClaimPageClientProps {
  cpopId: string;
}

// Calculate distance between two coordinates in meters using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const CLAIM_RADIUS_METERS = 200;

export default function ClaimPageClient({ cpopId }: ClaimPageClientProps) {
  const { connected, publicKey } = useWallet();
  const [cpop, setCpop] = useState<CpopDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Location state
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRange, setIsWithinRange] = useState(false);

  // Claim state
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [defaultClaim, setDefaultClaim] = useState(false);
  const [claimTxId, setClaimTxId] = useState<string | null>(null);

  // Time validation
  const now = new Date();
  const startDate = cpop ? new Date(cpop.startDate) : null;
  const endDate = cpop ? new Date(cpop.endDate) : null;

  const isBeforeStart = startDate ? now < startDate : false;
  const isAfterEnd = endDate ? now > endDate : false;
  const isWithinTimeWindow = !isBeforeStart && !isAfterEnd;

  // Fetch CPOP details
  useEffect(() => {
    async function fetchCpop() {
      try {
        const response = await fetch(
          `/api/cpop/${cpopId}?wallet_address=${publicKey?.toString() || ""}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch event details");
        }
        const data = await response.json();
        setCpop(data);
        setDefaultClaim(data.claimed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        setLoading(false);
      }
    }

    fetchCpop();
  }, [cpopId, publicKey]);

  // Check user's location
  const checkLocation = () => {
    setCheckingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setCheckingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        setUserLocation({ lat: userLat, lng: userLng });

        if (cpop) {
          const dist = calculateDistance(userLat, userLng, cpop.lat, cpop.long);
          setDistance(dist);
          setIsWithinRange(dist <= CLAIM_RADIUS_METERS);
        }

        setCheckingLocation(false);
      },
      (err) => {
        let errorMessage = "Unable to get your location";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage =
              "Location permission denied. Please enable location access.";
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case err.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }
        setLocationError(errorMessage);
        setCheckingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Claim the token
  const handleClaim = async () => {
    if (!connected || !publicKey || !cpop) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!isWithinRange) {
      toast({
        title: "Error",
        description: "You must be within 200m of the event location to claim",
        variant: "destructive",
      });
      return;
    }

    setClaiming(true);

    try {
      const locationParams =
        userLocation && isWithinRange
          ? `&lat=${userLocation.lat}&lng=${userLocation.lng}`
          : "";
      const response = await fetch(
        `/api/claim?wallet_address=${publicKey.toString()}&id=${cpopId}${locationParams}`,
        {
          method: "GET",
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to claim token.");
      }

      setClaimed(true);
      setClaimTxId(data.signature);
      toast({
        title: "Success!",
        description: "You have successfully claimed your cPOP token!",
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to claim token",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !cpop) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Event Not Found</h2>
            <p className="text-gray-500">
              {error || "This event does not exist"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-green-600">Claimed!</h2>
            <p className="text-gray-600">
              You have successfully claimed your cPOP token for{" "}
              <span className="font-semibold">{cpop.eventName}</span>
            </p>
            {claimTxId && (
              <a
                href={`https://explorer.solana.com/tx/${claimTxId}?cluster=${
                  process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet"
                }`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-blue-500 hover:text-blue-600 underline"
              >
                View Transaction
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Event Details */}
        <Card>
          <CardHeader className="text-center pb-2">
            {cpop.imageUrl && (
              <img
                src={cpop.imageUrl}
                alt={cpop.eventName}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
              />
            )}
            <CardTitle className="text-xl">{cpop.eventName}</CardTitle>
            <p className="text-sm text-gray-500">{cpop.organizerName}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {cpop.description}
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <CalendarIcon className="w-4 h-4" />
                <span>
                  {format(new Date(cpop.startDate), "MMM d, yyyy 'at' h:mm a")}{" "}
                  - {format(new Date(cpop.endDate), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <MapPinIcon className="w-4 h-4" />
                <span>{cpop.location}</span>
              </div>
            </div>

            {/* Time window status */}
            {!isWithinTimeWindow && (
              <div
                className={`p-3 rounded-lg flex items-center gap-2 ${
                  isBeforeStart
                    ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                }`}
              >
                <Clock
                  className={`w-5 h-5 ${
                    isBeforeStart ? "text-blue-500" : "text-gray-500"
                  }`}
                />
                <div>
                  {isBeforeStart ? (
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      Claiming opens on{" "}
                      <span className="font-medium">
                        {format(
                          new Date(cpop.startDate),
                          "MMM d, yyyy 'at' h:mm a"
                        )}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This event has ended. Claiming closed on{" "}
                      <span className="font-medium">
                        {format(
                          new Date(cpop.endDate),
                          "MMM d, yyyy 'at' h:mm a"
                        )}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 1: Connect Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <WalletMultiButton />
              {connected && <CheckCircle2 className="w-6 h-6 text-green-500" />}
            </div>
          </CardContent>
        </Card>

        {/* Location Check */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 2: Verify Location</CardTitle>
            <p className="text-sm text-gray-500">
              You must be within {CLAIM_RADIUS_METERS}m of the event location
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!userLocation ? (
              <Button
                onClick={checkLocation}
                disabled={checkingLocation}
                className="w-full"
                variant="outline"
              >
                {checkingLocation ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking Location...
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4 mr-2" />
                    Check My Location
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div
                  className={`p-4 rounded-lg ${
                    isWithinRange
                      ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                      : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isWithinRange ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                    <div>
                      <p
                        className={`font-medium ${
                          isWithinRange
                            ? "text-green-700 dark:text-green-400"
                            : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {isWithinRange
                          ? "You're at the location!"
                          : "Too far away"}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Distance:{" "}
                        {distance ? `${Math.round(distance)}m` : "Unknown"}
                        {!isWithinRange &&
                          ` (need to be within ${CLAIM_RADIUS_METERS}m)`}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={checkLocation}
                  variant="ghost"
                  size="sm"
                  className="w-full"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Recheck Location
                </Button>
              </div>
            )}

            {locationError && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  {locationError}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Claim Button */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 3: Claim Token</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleClaim}
              disabled={
                !connected ||
                !isWithinRange ||
                claiming ||
                // !isWithinTimeWindow ||
                defaultClaim
              }
              className="w-full"
              size="lg"
            >
              {defaultClaim ? (
                "Claimed"
              ) : claiming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Claiming...
                </>
              ) : isBeforeStart ? (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Claiming opens{" "}
                  {format(new Date(cpop.startDate), "MMM d 'at' h:mm a")}
                </>
              ) : isAfterEnd ? (
                "Claiming period has ended"
              ) : (
                "Claim cPOP Token"
              )}
            </Button>

            {!connected && isWithinTimeWindow && (
              <p className="text-sm text-gray-500 text-center mt-2">
                Connect your wallet to claim
              </p>
            )}
            {connected &&
              !isWithinRange &&
              userLocation &&
              isWithinTimeWindow && (
                <p className="text-sm text-red-500 text-center mt-2">
                  Move closer to the event location to claim
                </p>
              )}
            {isAfterEnd && !defaultClaim && (
              <p className="text-sm text-gray-500 text-center mt-2">
                This event&apos;s claiming period is over
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
