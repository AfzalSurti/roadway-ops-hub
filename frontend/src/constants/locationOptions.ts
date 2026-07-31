export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const UNION_TERRITORIES = [
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi (NCT)",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export const CONTINENTAL_REGIONS = [
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Africa",
  "Oceania",
  "Antarctica",
  "Middle East",
  "Southeast Asia",
  "Central Asia",
  "East Asia",
  "South Asia",
  "West Asia",
  "Central Europe",
  "Eastern Europe",
  "Western Europe",
  "Northern Europe",
  "Southern Europe",
] as const;

export type LocationGroup = {
  label: string;
  items: readonly string[];
};

export const LOCATION_GROUPS: LocationGroup[] = [
  { label: "Indian States", items: INDIAN_STATES },
  { label: "Union Territories", items: UNION_TERRITORIES },
  { label: "Continental Regions", items: CONTINENTAL_REGIONS },
];

export const ALL_LOCATIONS: string[] = [
  ...INDIAN_STATES,
  ...UNION_TERRITORIES,
  ...CONTINENTAL_REGIONS,
];
