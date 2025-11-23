"use client";

import { useEffect, useRef, useState } from "react";
import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const libraries: ("places")[] = ["places"];

interface LocationAutocompleteProps {
  onLocationSelect: (location: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  defaultValue?: string;
  defaultLat?: number;
  defaultLng?: number;
}

export default function LocationAutocomplete({
  onLocationSelect,
  defaultValue = "",
  defaultLat,
  defaultLng,
}: LocationAutocompleteProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(
    defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : null
  );

  // Prevent hydration mismatch by only rendering on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Show loading skeleton during SSR and initial mount
  if (!isMounted) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
        <div className="h-[200px] bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
      </div>
    );
  }

  return (
    <LocationAutocompleteClient
      onLocationSelect={(location) => {
        setSelectedLocation({ lat: location.lat, lng: location.lng });
        onLocationSelect(location);
      }}
      selectedLocation={selectedLocation}
      defaultValue={defaultValue}
    />
  );
}

interface LocationAutocompleteClientProps {
  onLocationSelect: (location: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  selectedLocation: { lat: number; lng: number } | null;
  defaultValue: string;
}

function LocationAutocompleteClient({
  onLocationSelect,
  selectedLocation,
  defaultValue,
}: LocationAutocompleteClientProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  if (loadError) {
    return (
      <div className="text-red-500 text-sm p-4 border border-red-300 rounded-md">
        Error loading Google Maps. Please check your API key configuration.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
        <div className="h-[200px] bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
      </div>
    );
  }

  return (
    <PlacesAutocompleteInput
      onLocationSelect={onLocationSelect}
      selectedLocation={selectedLocation}
      defaultValue={defaultValue}
    />
  );
}

interface PlacesAutocompleteInputProps {
  onLocationSelect: (location: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  selectedLocation: { lat: number; lng: number } | null;
  defaultValue: string;
}

function PlacesAutocompleteInput({
  onLocationSelect,
  selectedLocation,
  defaultValue,
}: PlacesAutocompleteInputProps) {
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      types: ["geocode", "establishment"],
    },
    debounce: 300,
    defaultValue,
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = async (description: string) => {
    setValue(description, false);
    clearSuggestions();
    setShowSuggestions(false);

    try {
      const results = await getGeocode({ address: description });
      const { lat, lng } = await getLatLng(results[0]);
      onLocationSelect({
        address: description,
        lat,
        lng,
      });
    } catch (error) {
      console.error("Error getting geocode:", error);
    }
  };

  const mapContainerStyle = {
    width: "100%",
    height: "200px",
    borderRadius: "8px",
  };

  const defaultCenter = {
    lat: 37.7749,
    lng: -122.4194,
  };

  return (
    <div className="space-y-3">
      <div ref={wrapperRef} className="relative">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          disabled={!ready}
          placeholder="Search for a location..."
          className="w-full"
        />

        {showSuggestions && status === "OK" && (
          <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
            {data.map(({ place_id, description }) => (
              <li
                key={place_id}
                onClick={() => handleSelect(description)}
                className={cn(
                  "px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700",
                  "text-sm text-gray-700 dark:text-gray-200"
                )}
              >
                {description}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map Preview */}
      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={selectedLocation || defaultCenter}
          zoom={selectedLocation ? 15 : 2}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          {selectedLocation && <MarkerF position={selectedLocation} />}
        </GoogleMap>
      </div>

      {selectedLocation && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Coordinates: {selectedLocation.lat.toFixed(6)},{" "}
          {selectedLocation.lng.toFixed(6)}
        </p>
      )}
    </div>
  );
}
