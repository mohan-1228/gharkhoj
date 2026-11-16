import type { ListingFormValues } from "@/schemas/listing";

/** Default values for a brand-new listing. */
export function emptyListingValues(): Partial<ListingFormValues> {
  return {
    propertyType: "studio_flat",
    furnishing: "unfurnished",
    availableFrom: new Date().toISOString().slice(0, 10) as unknown as Date,
    minLeaseMonths: 6,
    bedrooms: 1,
    bathrooms: 1,
    parkingBikes: 0,
    parkingCars: 0,
    negotiable: false,
    waterSupply: [],
    electricityBackup: "none",
    internetAvailable: false,
    wasteCollection: false,
    gas: "lpg",
    tenantTypes: [],
    petsAllowed: false,
    smokingAllowed: false,
    locationIsApproximate: true,
    amenityCodes: [],
    latitude: null,
    longitude: null,
    neighborhoodId: null,
  };
}

interface ListingLike {
  title: string;
  description: string;
  propertyType: ListingFormValues["propertyType"];
  rentNpr: number;
  depositNpr: number | null;
  negotiable: boolean;
  availableFrom: Date;
  minLeaseMonths: number;
  bedrooms: number;
  bathrooms: number;
  areaSqft: number | null;
  floorNo: number | null;
  totalFloors: number | null;
  furnishing: ListingFormValues["furnishing"];
  parkingBikes: number;
  parkingCars: number;
  facing: ListingFormValues["facing"];
  yearBuilt: number | null;
  waterSupply: string[];
  electricityBackup: ListingFormValues["electricityBackup"];
  internetAvailable: boolean;
  wasteCollection: boolean;
  gas: ListingFormValues["gas"];
  tenantTypes: string[];
  petsAllowed: boolean;
  smokingAllowed: boolean;
  cityId: number;
  neighborhoodId: number | null;
  wardNo: number | null;
  streetAddress: string | null;
  landmark: string | null;
  locationIsApproximate: boolean;
  location: { lat: number; lng: number } | null;
  amenities: { amenity: { code: string } }[];
}

/** Map a persisted listing to form values (dates → yyyy-mm-dd, nulls → empty). */
export function listingToFormValues(l: ListingLike): Partial<ListingFormValues> {
  return {
    title: l.title,
    description: l.description,
    propertyType: l.propertyType,
    rentNpr: l.rentNpr,
    depositNpr: l.depositNpr ?? undefined,
    negotiable: l.negotiable,
    availableFrom: new Date(l.availableFrom).toISOString().slice(0, 10) as unknown as Date,
    minLeaseMonths: l.minLeaseMonths,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    areaSqft: l.areaSqft ?? undefined,
    floorNo: l.floorNo ?? undefined,
    totalFloors: l.totalFloors ?? undefined,
    furnishing: l.furnishing,
    parkingBikes: l.parkingBikes,
    parkingCars: l.parkingCars,
    facing: l.facing ?? null,
    yearBuilt: l.yearBuilt ?? undefined,
    waterSupply: l.waterSupply as ListingFormValues["waterSupply"],
    electricityBackup: l.electricityBackup,
    internetAvailable: l.internetAvailable,
    wasteCollection: l.wasteCollection,
    gas: l.gas,
    tenantTypes: l.tenantTypes as ListingFormValues["tenantTypes"],
    petsAllowed: l.petsAllowed,
    smokingAllowed: l.smokingAllowed,
    cityId: l.cityId,
    neighborhoodId: l.neighborhoodId,
    wardNo: l.wardNo ?? undefined,
    streetAddress: l.streetAddress ?? "",
    landmark: l.landmark ?? "",
    locationIsApproximate: l.locationIsApproximate,
    latitude: l.location?.lat ?? null,
    longitude: l.location?.lng ?? null,
    amenityCodes: l.amenities.map((a) => a.amenity.code),
  };
}
