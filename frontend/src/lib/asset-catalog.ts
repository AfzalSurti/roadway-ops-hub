export const ASSET_TYPES_BY_CLASS = {
  Appliances: [
    "Air Conditioner",
    "Air Cooler",
    "Table Fan",
    "Ceiling Fan",
    "Cylinder",
    "Gas Stove",
    "Induction Cooktop",
    "Oven",
    "Invertor",
    "Stabiliser",
    "UPS",
    "Kitchen Utensils",
    "Refrigerator",
    "TV",
    "Set-up Box",
    "Geyser",
    "Heater",
    "Electric Kettle",
    "Water Purifier (RO)",
    "Washing machine"
  ],
  IT: [
    "Computer (CPU / Monitor / KB / Mouse)",
    "Laptop",
    "Printer / Scanner",
    "HDD",
    "SSD",
    "Pendrive",
    "Wifi Router",
    "Broadband",
    "Dongle",
    "Memory Card",
    "Hard Disk 4TB",
    "Hard Disk 8TB",
    "Hard Disk 2TB",
    "Card Reader"
  ],
  Furniture: [
    "Chair - Office",
    "Chair - Revolving",
    "Chair - Visitor",
    "Chair - Guest",
    "Chair - Garden",
    "Chair - Plastic",
    "Chair - Wheel chair (Med)",
    "Cupboard",
    "Almirah",
    "Steel Rack",
    "Table - Dining (Plastic)",
    "Table - Office / Computer",
    "SF - Bed",
    "SF - Bed sheet",
    "SF - Blanket",
    "SF - Mattress",
    "SF - Pillow & Cover"
  ],
  Vehicles: ["Bike - Owned", "Car - Owned"],
  "Survey Equipment": [
    "Network Survey Vehicle",
    "Falling Weight Deflectometer",
    "Retro Reflectometer (Pavement Marking)",
    "Retro Reflectometer (Sign Board)",
    "Traffic Survey Camera",
    "Cyclic Plate Load Test Equipment",
    "Axle Pad",
    "ATCC Set"
  ],
  "Measuring Instruments": ["Vernier Caliper", "Measuring Tape 15m", "Dial Gauge", "Thermometer"],
  "Safety Equipment": ["Company Logo Safety Jacket", "Safety Jacket", "Safety Shoes"],
  "Utility Equipment": ["Ladder"],
  Misc: [
    "Box file",
    "Bucket / Mug / Bath Stool",
    "Bulb & Tubelights",
    "Calculator",
    "Curtains",
    "Door Mat",
    "Door Bell",
    "Dustbin",
    "Extension Board",
    "File Stand",
    "File tray",
    "Lock & Keys",
    "Measuring Tape",
    "Mirror",
    "Punching Machine",
    "Register",
    "Stamp",
    "Stapler",
    "Wall Clock",
    "Water Heating Rod",
    "Water Jug",
    "White Board",
    "Window Screen"
  ]
} as const;

export const ASSET_CLASS_OPTIONS = [
  "Appliances",
  "IT",
  "Furniture",
  "Vehicles",
  "Survey Equipment",
  "Measuring Instruments",
  "Safety Equipment",
  "Utility Equipment",
  "Misc",
  "Other"
] as const;
export const ASSET_CLASS_GROUP_OPTIONS = ["All", ...ASSET_CLASS_OPTIONS] as const;

export type AssetClassGroup = (typeof ASSET_CLASS_OPTIONS)[number];

export function getAssetTypesForClass(assetClass: string): string[] {
  if (assetClass in ASSET_TYPES_BY_CLASS) {
    return [...ASSET_TYPES_BY_CLASS[assetClass as keyof typeof ASSET_TYPES_BY_CLASS]];
  }
  return [];
}

export function getAssetClassGroup(assetClass: string): AssetClassGroup {
  return ASSET_CLASS_OPTIONS.includes(assetClass as AssetClassGroup) ? (assetClass as AssetClassGroup) : "Other";
}
