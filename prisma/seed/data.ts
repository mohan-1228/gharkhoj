/** Reference data for the 10 launch cities. Coordinates are approximate centroids. */
export interface SeedNeighborhood {
  name: string;
  nameNe?: string;
  lat: number;
  lng: number;
}
export interface SeedCity {
  name: string;
  nameNe: string;
  slug: string;
  province: string;
  district: string;
  lat: number;
  lng: number;
  neighborhoods: SeedNeighborhood[];
}

export const CITIES: SeedCity[] = [
  {
    name: "Kathmandu",
    nameNe: "काठमाडौं",
    slug: "kathmandu",
    province: "Bagmati",
    district: "Kathmandu",
    lat: 27.7172,
    lng: 85.324,
    neighborhoods: [
      { name: "Baneshwor", nameNe: "बानेश्वर", lat: 27.6915, lng: 85.342 },
      { name: "Thamel", nameNe: "ठमेल", lat: 27.7154, lng: 85.3123 },
      { name: "Koteshwor", nameNe: "कोटेश्वर", lat: 27.6788, lng: 85.3496 },
      { name: "Baluwatar", nameNe: "बालुवाटार", lat: 27.7286, lng: 85.3307 },
      { name: "Maharajgunj", nameNe: "महाराजगञ्ज", lat: 27.738, lng: 85.33 },
      { name: "Chabahil", nameNe: "चाबहिल", lat: 27.7173, lng: 85.3466 },
      { name: "Kalanki", nameNe: "कलंकी", lat: 27.6933, lng: 85.2814 },
      { name: "Budhanilkantha", nameNe: "बुढानीलकण्ठ", lat: 27.765, lng: 85.365 },
      { name: "Boudha", nameNe: "बौद्ध", lat: 27.7215, lng: 85.362 },
      { name: "Lazimpat", nameNe: "लाजिम्पाट", lat: 27.723, lng: 85.32 },
    ],
  },
  {
    name: "Lalitpur",
    nameNe: "ललितपुर",
    slug: "lalitpur",
    province: "Bagmati",
    district: "Lalitpur",
    lat: 27.6588,
    lng: 85.3247,
    neighborhoods: [
      { name: "Jhamsikhel", nameNe: "झम्सिखेल", lat: 27.6795, lng: 85.3065 },
      { name: "Pulchowk", nameNe: "पुल्चोक", lat: 27.678, lng: 85.317 },
      { name: "Kupondole", nameNe: "कुपण्डोल", lat: 27.687, lng: 85.315 },
      { name: "Sanepa", nameNe: "सानेपा", lat: 27.685, lng: 85.305 },
      { name: "Imadol", nameNe: "इमाडोल", lat: 27.662, lng: 85.343 },
      { name: "Satdobato", nameNe: "सातदोबाटो", lat: 27.656, lng: 85.325 },
    ],
  },
  {
    name: "Bhaktapur",
    nameNe: "भक्तपुर",
    slug: "bhaktapur",
    province: "Bagmati",
    district: "Bhaktapur",
    lat: 27.671,
    lng: 85.4298,
    neighborhoods: [
      { name: "Suryabinayak", nameNe: "सूर्यविनायक", lat: 27.664, lng: 85.429 },
      { name: "Thimi", nameNe: "ठिमी", lat: 27.681, lng: 85.387 },
      { name: "Sallaghari", nameNe: "सल्लाघारी", lat: 27.673, lng: 85.415 },
    ],
  },
  {
    name: "Pokhara",
    nameNe: "पोखरा",
    slug: "pokhara",
    province: "Gandaki",
    district: "Kaski",
    lat: 28.2096,
    lng: 83.9856,
    neighborhoods: [
      { name: "Lakeside", nameNe: "लेकसाइड", lat: 28.21, lng: 83.96 },
      { name: "Chipledhunga", nameNe: "चिप्लेढुंगा", lat: 28.219, lng: 83.988 },
      { name: "Bagar", nameNe: "बगर", lat: 28.24, lng: 83.995 },
      { name: "Prithvi Chowk", nameNe: "पृथ्वीचोक", lat: 28.205, lng: 83.985 },
      { name: "Srijana Chowk", nameNe: "सिर्जनाचोक", lat: 28.216, lng: 83.991 },
    ],
  },
  {
    name: "Biratnagar",
    nameNe: "विराटनगर",
    slug: "biratnagar",
    province: "Koshi",
    district: "Morang",
    lat: 26.4525,
    lng: 87.2718,
    neighborhoods: [
      { name: "Traffic Chowk", lat: 26.456, lng: 87.279 },
      { name: "Bargachhi", nameNe: "बरगाछी", lat: 26.465, lng: 87.283 },
      { name: "Tinpaini", nameNe: "तीनपैनी", lat: 26.475, lng: 87.278 },
    ],
  },
  {
    name: "Bharatpur",
    nameNe: "भरतपुर",
    slug: "bharatpur",
    province: "Bagmati",
    district: "Chitwan",
    lat: 27.6766,
    lng: 84.4359,
    neighborhoods: [
      { name: "Narayangarh", nameNe: "नारायणगढ", lat: 27.699, lng: 84.43 },
      { name: "Bharatpur Height", lat: 27.672, lng: 84.426 },
      { name: "Sharadpur", nameNe: "शारदपुर", lat: 27.66, lng: 84.415 },
    ],
  },
  {
    name: "Birgunj",
    nameNe: "वीरगञ्ज",
    slug: "birgunj",
    province: "Madhesh",
    district: "Parsa",
    lat: 27.0104,
    lng: 84.877,
    neighborhoods: [
      { name: "Ghantaghar", nameNe: "घण्टाघर", lat: 27.012, lng: 84.877 },
      { name: "Adarshanagar", nameNe: "आदर्शनगर", lat: 27.015, lng: 84.88 },
      { name: "Murli", nameNe: "मुर्ली", lat: 27.005, lng: 84.87 },
    ],
  },
  {
    name: "Butwal",
    nameNe: "बुटवल",
    slug: "butwal",
    province: "Lumbini",
    district: "Rupandehi",
    lat: 27.7006,
    lng: 83.4483,
    neighborhoods: [
      { name: "Traffic Chowk", lat: 27.696, lng: 83.45 },
      { name: "Golpark", nameNe: "गोलपार्क", lat: 27.688, lng: 83.449 },
      { name: "Milanchowk", nameNe: "मिलनचोक", lat: 27.701, lng: 83.463 },
    ],
  },
  {
    name: "Dharan",
    nameNe: "धरान",
    slug: "dharan",
    province: "Koshi",
    district: "Sunsari",
    lat: 26.8125,
    lng: 87.283,
    neighborhoods: [
      { name: "Bhanu Chowk", nameNe: "भानुचोक", lat: 26.813, lng: 87.284 },
      { name: "Putali Line", nameNe: "पुतलीलाइन", lat: 26.822, lng: 87.28 },
      { name: "Chata Chowk", nameNe: "छाताचोक", lat: 26.805, lng: 87.283 },
    ],
  },
  {
    name: "Hetauda",
    nameNe: "हेटौंडा",
    slug: "hetauda",
    province: "Bagmati",
    district: "Makwanpur",
    lat: 27.4287,
    lng: 85.0322,
    neighborhoods: [
      { name: "Bhutandevi", nameNe: "भुटनदेवी", lat: 27.425, lng: 85.03 },
      { name: "Hupra Chaur", nameNe: "हुप्राचौर", lat: 27.43, lng: 85.035 },
      { name: "Basamadi", nameNe: "बसामाडी", lat: 27.44, lng: 85.01 },
    ],
  },
];

export const AMENITIES: {
  code: string;
  label: string;
  labelNe: string;
  category: "basics" | "building" | "policies" | "nearby";
  icon: string;
}[] = [
  // Basics
  { code: "wifi", label: "Wi-Fi", labelNe: "वाइफाइ", category: "basics", icon: "wifi" },
  { code: "water_24h", label: "24h water", labelNe: "२४ घण्टा पानी", category: "basics", icon: "droplets" },
  { code: "hot_water", label: "Hot water / geyser", labelNe: "तातो पानी", category: "basics", icon: "flame" },
  {
    code: "power_backup",
    label: "Electricity backup",
    labelNe: "बिजुली ब्याकअप",
    category: "basics",
    icon: "battery-charging",
  },
  { code: "furnished", label: "Furnished", labelNe: "फर्निस्ड", category: "basics", icon: "sofa" },
  { code: "kitchen", label: "Kitchen", labelNe: "भान्सा", category: "basics", icon: "cooking-pot" },
  { code: "balcony", label: "Balcony / terrace", labelNe: "बालकनी", category: "basics", icon: "sun" },
  { code: "attached_bath", label: "Attached bathroom", labelNe: "एट्याच बाथरुम", category: "basics", icon: "bath" },
  // Building
  { code: "elevator", label: "Elevator", labelNe: "लिफ्ट", category: "building", icon: "arrow-up-down" },
  { code: "parking", label: "Parking", labelNe: "पार्किङ", category: "building", icon: "car" },
  { code: "cctv", label: "CCTV", labelNe: "सीसीटीभी", category: "building", icon: "cctv" },
  { code: "security_guard", label: "Security guard", labelNe: "सुरक्षा गार्ड", category: "building", icon: "shield" },
  { code: "gated", label: "Gated compound", labelNe: "कम्पाउन्ड", category: "building", icon: "fence" },
  { code: "rooftop", label: "Rooftop access", labelNe: "छत", category: "building", icon: "building" },
  { code: "laundry", label: "Laundry", labelNe: "लुगा धुने", category: "building", icon: "washing-machine" },
  { code: "generator", label: "Generator", labelNe: "जेनेरेटर", category: "building", icon: "zap" },
  {
    code: "rainwater",
    label: "Rainwater harvesting",
    labelNe: "वर्षाको पानी संकलन",
    category: "building",
    icon: "cloud-rain",
  },
  { code: "solar_heater", label: "Solar water heating", labelNe: "सोलार", category: "building", icon: "sun-medium" },
  // Policies
  { code: "pets_allowed", label: "Pets allowed", labelNe: "घरपालुवा जनावर", category: "policies", icon: "paw-print" },
  { code: "smoking_allowed", label: "Smoking allowed", labelNe: "धुम्रपान", category: "policies", icon: "cigarette" },
  { code: "visitors_allowed", label: "Visitors allowed", labelNe: "पाहुना", category: "policies", icon: "users" },
  // Nearby
  { code: "near_school", label: "School nearby", labelNe: "विद्यालय नजिक", category: "nearby", icon: "school" },
  { code: "near_hospital", label: "Hospital nearby", labelNe: "अस्पताल नजिक", category: "nearby", icon: "hospital" },
  { code: "near_bus", label: "Bus / micro stop", labelNe: "बस स्टप", category: "nearby", icon: "bus" },
  { code: "near_supermarket", label: "Supermarket", labelNe: "सुपरमार्केट", category: "nearby", icon: "shopping-cart" },
  { code: "near_temple", label: "Temple", labelNe: "मन्दिर", category: "nearby", icon: "landmark" },
  { code: "near_gym", label: "Gym", labelNe: "जिम", category: "nearby", icon: "dumbbell" },
  { code: "near_park", label: "Park", labelNe: "पार्क", category: "nearby", icon: "trees" },
];
