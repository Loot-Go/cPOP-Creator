"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@/components/solana/wallet-multi-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import {
  MapPinIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  Navigation,
  AlertCircle,
  Copy,
} from "lucide-react";

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

export default function TestPage() {
  const { connected, publicKey } = useWallet();

  // Mock event location (you can change this to test)
  const [eventLat, setEventLat] = useState("35.6762");
  const [eventLng, setEventLng] = useState("139.6503");

  // User location state
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRange, setIsWithinRange] = useState(false);

  // Test CPOP ID input
  const [testCpopId, setTestCpopId] = useState("");

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

        const dist = calculateDistance(
          userLat,
          userLng,
          parseFloat(eventLat),
          parseFloat(eventLng)
        );
        setDistance(dist);
        setIsWithinRange(dist <= CLAIM_RADIUS_METERS);

        setCheckingLocation(false);

        toast({
          title: "Location Found",
          description: `Your location: ${userLat.toFixed(6)}, ${userLng.toFixed(6)}`,
        });
      },
      (err) => {
        let errorMessage = "Unable to get your location";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage =
              "Location permission denied. Please enable location access in your browser settings.";
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

  // Set event location to current location (for testing)
  const setEventToCurrentLocation = () => {
    if (userLocation) {
      setEventLat(userLocation.lat.toString());
      setEventLng(userLocation.lng.toString());
      setDistance(0);
      setIsWithinRange(true);
      toast({
        title: "Event Location Updated",
        description: "Event location set to your current position",
      });
    }
  };

  // Recalculate distance when event location changes
  useEffect(() => {
    if (userLocation && eventLat && eventLng) {
      const dist = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        parseFloat(eventLat),
        parseFloat(eventLng)
      );
      setDistance(dist);
      setIsWithinRange(dist <= CLAIM_RADIUS_METERS);
    }
  }, [eventLat, eventLng, userLocation]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">cPOP Test Page</h1>
          <p className="text-gray-500">
            Test GPS location checking and claim flow
          </p>
        </div>

        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Wallet Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <WalletMultiButton />
              {connected && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-gray-500">
                    {publicKey?.toString().slice(0, 8)}...
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* GPS Location Test */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. GPS Location Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={checkLocation}
              disabled={checkingLocation}
              className="w-full"
            >
              {checkingLocation ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Getting Location...
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 mr-2" />
                  Get My Current Location
                </>
              )}
            </Button>

            {locationError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-700 dark:text-red-400">
                  {locationError}
                </p>
              </div>
            )}

            {userLocation && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                <p className="font-medium">Your Location:</p>
                <div className="flex items-center justify-between">
                  <code className="text-sm">
                    {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`
                      )
                    }
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Location Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Mock Event Location</CardTitle>
            <p className="text-sm text-gray-500">
              Set the event coordinates to test distance calculation
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Latitude</label>
                <Input
                  value={eventLat}
                  onChange={(e) => setEventLat(e.target.value)}
                  placeholder="Latitude"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Longitude</label>
                <Input
                  value={eventLng}
                  onChange={(e) => setEventLng(e.target.value)}
                  placeholder="Longitude"
                />
              </div>
            </div>

            {userLocation && (
              <Button
                variant="outline"
                onClick={setEventToCurrentLocation}
                className="w-full"
              >
                <MapPinIcon className="w-4 h-4 mr-2" />
                Set Event Location to My Current Position
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Distance Check Result */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">4. Distance Check Result</CardTitle>
          </CardHeader>
          <CardContent>
            {distance !== null ? (
              <div
                className={`p-4 rounded-lg ${
                  isWithinRange
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isWithinRange ? (
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-500" />
                  )}
                  <div>
                    <p
                      className={`font-semibold text-lg ${
                        isWithinRange
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {isWithinRange
                        ? "Within Range - Can Claim!"
                        : "Out of Range - Cannot Claim"}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Distance: <strong>{Math.round(distance)}m</strong>
                      {!isWithinRange && (
                        <span> (need to be within {CLAIM_RADIUS_METERS}m)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                Get your location first to check distance
              </p>
            )}
          </CardContent>
        </Card>

        {/* Test Real Claim Page */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">5. Test Real Claim Page</CardTitle>
            <p className="text-sm text-gray-500">
              Enter a cPOP ID to test the actual claim page
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={testCpopId}
              onChange={(e) => setTestCpopId(e.target.value)}
              placeholder="Enter cPOP ID (UUID)"
            />
            <Button
              className="w-full"
              disabled={!testCpopId}
              onClick={() => {
                window.open(`/claim/${testCpopId}`, "_blank");
              }}
            >
              Open Claim Page
            </Button>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => (window.location.href = "/")}
            >
              Go to Creator Form
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() =>
                window.open(
                  "https://explorer.solana.com/?cluster=devnet",
                  "_blank"
                )
              }
            >
              Open Solana Explorer (Devnet)
            </Button>
          </CardContent>
        </Card>

        {/* Debug Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Debug Info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-auto">
              {JSON.stringify(
                {
                  walletConnected: connected,
                  publicKey: publicKey?.toString(),
                  userLocation,
                  eventLocation: { lat: eventLat, lng: eventLng },
                  distance: distance ? `${Math.round(distance)}m` : null,
                  isWithinRange,
                  claimRadiusMeters: CLAIM_RADIUS_METERS,
                },
                null,
                2
              )}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
