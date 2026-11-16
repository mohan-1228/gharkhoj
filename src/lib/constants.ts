/** Client-safe domain constants shared by forms, filters and the API. */

export const PROPERTY_TYPES = ["room", "studio_flat", "apartment", "house", "office_space"] as const;
export type PropertyTypeValue = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_TYPE_LABELS: Record<PropertyTypeValue, string> = {
  room: "Room",
  studio_flat: "Studio / Flat",
  apartment: "Apartment",
  house: "House",
  office_space: "Office / Studio Space",
};
/** URL segment used on SEO pages, e.g. /rent/kathmandu/apartments */
export const PROPERTY_TYPE_SLUGS: Record<string, PropertyTypeValue> = {
  rooms: "room",
  flats: "studio_flat",
  apartments: "apartment",
  houses: "house",
  offices: "office_space",
};

export const FURNISHING = ["unfurnished", "semi", "fully"] as const;
export const FURNISHING_LABELS: Record<(typeof FURNISHING)[number], string> = {
  unfurnished: "Unfurnished",
  semi: "Semi-furnished",
  fully: "Fully furnished",
};

export const TENANT_TYPES = ["family", "bachelors", "students", "couples", "professionals"] as const;
export const TENANT_TYPE_LABELS: Record<(typeof TENANT_TYPES)[number], string> = {
  family: "Family",
  bachelors: "Bachelors",
  students: "Students",
  couples: "Couples",
  professionals: "Working professionals",
};

export const WATER_SUPPLY = ["tank", "boring", "municipal"] as const;
export const WATER_SUPPLY_LABELS: Record<(typeof WATER_SUPPLY)[number], string> = {
  tank: "Tanker / tank",
  boring: "Boring (groundwater)",
  municipal: "Municipal (KUKL / Khanepani)",
};

export const ELECTRICITY_BACKUP = ["none", "inverter", "generator", "solar"] as const;
export const ELECTRICITY_BACKUP_LABELS: Record<(typeof ELECTRICITY_BACKUP)[number], string> = {
  none: "None",
  inverter: "Inverter",
  generator: "Generator",
  solar: "Solar",
};

export const GAS_SUPPLY = ["none", "lpg", "piped"] as const;
export const GAS_SUPPLY_LABELS: Record<(typeof GAS_SUPPLY)[number], string> = {
  none: "None",
  lpg: "LPG cylinder",
  piped: "Piped gas",
};

export const FACING = [
  "north",
  "north_east",
  "east",
  "south_east",
  "south",
  "south_west",
  "west",
  "north_west",
] as const;

export const LISTING_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "paused",
  "rented",
  "archived",
  "rejected",
] as const;
export type ListingStatusValue = (typeof LISTING_STATUSES)[number];
export const LISTING_STATUS_LABELS: Record<ListingStatusValue, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  paused: "Paused",
  rented: "Rented",
  archived: "Archived",
  rejected: "Rejected",
};

export const TOUR_STATUSES = [
  "requested",
  "confirmed",
  "declined",
  "rescheduled",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type TourStatusValue = (typeof TOUR_STATUSES)[number];

export const REPORT_REASONS = ["scam", "inaccurate", "already_rented", "offensive", "duplicate", "other"] as const;
export const REPORT_REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  scam: "Scam or fraud",
  inaccurate: "Inaccurate information",
  already_rented: "Already rented",
  offensive: "Offensive content",
  duplicate: "Duplicate listing",
  other: "Something else",
};

export const SORT_OPTIONS = ["newest", "price_asc", "price_desc", "relevance", "nearest"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  relevance: "Most relevant",
  nearest: "Nearest",
};

/** Media upload limits — enforced in the presign policy AND re-checked server side. */
export const UPLOAD_LIMITS = {
  photo: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  floor_plan: { maxBytes: 15 * 1024 * 1024, types: ["image/jpeg", "image/png", "application/pdf"] },
  verification_doc: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "application/pdf"] },
} as const;
export type UploadKind = keyof typeof UPLOAD_LIMITS;
export const MAX_PHOTOS_PER_LISTING = 25;
export const IMAGE_WIDTHS = [320, 640, 1280] as const;

export const PRICE_MIN = 0;
export const PRICE_MAX = 500_000;
export const DEFAULT_PAGE_SIZE = 20;
export const TIMEZONE = "Asia/Kathmandu";

/** Default map view: Kathmandu Valley. */
export const DEFAULT_MAP_CENTER: [number, number] = [27.7172, 85.324];
