# Changelog

## [Unreleased] - 2024-11-23

### Bug Fixes

#### QR Code Now Links to Claim Page

Fixed the QR code on the success page to link to the correct claim page URL.

**What changed:**
- QR code now encodes the full claim URL (e.g., `https://yoursite.com/claim/{cpop-id}`)
- Added claim link display below the QR code with copy button
- Added "Open Claim Page" button for quick access

**Files modified:**
- `components/mint-success.tsx` - Updated QR code to use full claim URL, added claim link display

---

### New Features

#### cPOP List on Creator Page

Added a list of created cPOPs on the main creator page so organizers can easily manage and share their events.

**Features:**
- Shows all cPOPs created by the connected wallet
- Displays event name, date, location, and claim count
- QR code dialog for each event
- Copy claim link button
- Open claim page button
- Auto-refresh capability

**Files added:**
- `components/cpop-list.tsx` - New component displaying list of created events
- `app/api/cpops/route.ts` - API endpoint to fetch cPOPs by creator address

**Files modified:**
- `components/cpop-creator-form.tsx` - Integrated CpopList component below the form

---

## [Previous] - 2024-11-22

### New Features

#### 1. Location Autocomplete with Google Maps Integration

Replaced the manual latitude/longitude input fields with an intelligent location search system.

**What changed:**
- Users can now search for locations by name (e.g., "Tokyo Station", "Moscone Center, San Francisco")
- As you type, Google Places Autocomplete shows location predictions
- Selecting a location automatically fills in the latitude and longitude
- A Google Map preview shows the selected location with a marker
- Coordinates are displayed below the map for verification

**Files added:**
- `components/location-autocomplete.tsx` - New location search component with map preview

**Files modified:**
- `components/cpop-creator-form.tsx` - Integrated the new location component, removed separate lat/lng input fields

**Dependencies added:**
- `@react-google-maps/api` - Google Maps React wrapper
- `use-places-autocomplete` - Places Autocomplete hook

**Setup required:**
```bash
# Add to your .env.local
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
```

Enable these APIs in [Google Cloud Console](https://console.cloud.google.com/google/maps-apis):
- Maps JavaScript API
- Places API
- Geocoding API

---

#### 2. Redesigned Success Page

Replaced the inline transaction logs and QR code display with a dedicated, professional success page.

**Before:**
- Form remained visible after minting
- Transaction details shown in a table below the form (Mint creation, Register mint, ATA creation, etc.)
- Small QR code displayed at the bottom

**After:**
- Form is replaced with a full success page
- Clean success indicator with checkmark
- Large, prominent QR code with download button
- Event details summary (name, organizer, description, dates, location, token count)
- Single "View Transaction on Solana Explorer" link (simplified from multiple transaction links)
- "Create Another cPOP" button to return to the form

**Files added:**
- `components/mint-success.tsx` - New success page component

**Files modified:**
- `components/cpop-creator-form.tsx` - Added conditional rendering for success state, stores event details for display

---

### Technical Details

#### Location Autocomplete Component (`components/location-autocomplete.tsx`)

```tsx
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
```

Features:
- Debounced search (300ms) to reduce API calls
- Click-outside detection to close suggestions
- Loading state while Google Maps SDK loads
- Error handling for missing API key
- Responsive map container

#### Success Page Component (`components/mint-success.tsx`)

```tsx
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
```

Features:
- QR code download as PNG
- Event image display (if provided)
- Formatted date display
- External link to Solana Explorer
- Reset callback to create another cPOP

---

#### 3. User Claim Page with GPS Location Verification

Added a complete user-facing claim flow where attendees can claim their cPOP tokens by verifying their physical presence at the event location.

**User Flow:**
1. User scans QR code from event organizer
2. Lands on `/claim/[cpop-id]` page
3. Connects their Solana wallet (Phantom)
4. Clicks "Check My Location" to verify GPS position
5. If within 200m of event location, can claim the token
6. Receives confirmation with transaction link

**Features:**
- GPS location checking using browser Geolocation API
- Haversine formula for accurate distance calculation
- 200m radius validation (configurable)
- Real-time distance display
- Server-side location validation for security
- Success/error states with appropriate UI feedback
- Permission denied handling with helpful messages

**Files added:**
- `app/claim/[id]/page.tsx` - Server component wrapper for claim page
- `app/claim/[id]/claim-page-client.tsx` - Main claim UI with GPS logic
- `app/api/cpop/[id]/route.ts` - API endpoint to fetch event details

**Files modified:**
- `app/api/claim/route.ts` - Added server-side location validation with Haversine formula

**Security:**
- Client-side validation prevents claim button from being enabled
- Server-side validation double-checks location before processing claim
- Both use the same Haversine distance calculation

**Technical Details:**

```typescript
// Haversine formula for distance calculation
function calculateDistance(lat1, lon1, lat2, lon2): number {
  const R = 6371e3; // Earth's radius in meters
  // ... returns distance in meters
}

const CLAIM_RADIUS_METERS = 200;
```

---

#### 4. Test Page for Development

Added a test page at `/test` for developers to test the claim flow without needing to create a real event.

**Features:**
- Mock event data display
- GPS location testing
- Distance calculation verification
- Simulated claim flow

**Files added:**
- `app/test/page.tsx` - Test page for development

---

### Migration Notes

No database changes required. The form schema remains the same - latitude and longitude are still stored as before, just populated differently in the UI.

If you're running without a Google Maps API key, the location component will show an error message. Users can still create cPOPs by setting up the API key.
