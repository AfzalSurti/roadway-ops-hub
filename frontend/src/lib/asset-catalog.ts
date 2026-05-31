export const ASSET_CLASS_GROUPS = {
  Appliances: [
    "Appliances - Air Conditioner",
    "Appliances - Air Cooler",
    "Appliances - Table Fan",
    "Appliances - Ceiling Fan",
    "Appliances - Cylinder",
    "Appliances - Gas Stove",
    "Appliances - Induction Cooktop",
    "Appliances - Oven",
    "Appliances - Invertor",
    "Appliances - Stabiliser",
    "Appliances - UPS",
    "Appliances - Kitchen Utensils",
    "Appliances - Refrigerator",
    "Appliances - TV",
    "Appliances - Set-up Box",
    "Appliances - Geyser",
    "Appliances - Heater",
    "Appliance - Electric Kettle",
    "Appliance - Water Purifier (RO)",
    "Applance- Washing machine"
  ],
  IT: [
    "IT - Computer (CPU / Monitor / KB / Mouse)",
    "IT - Laptop",
    "IT - Printer / Scanner",
    "IT - HDD",
    "IT - SSD",
    "IT - Pendrive",
    "IT - Wifi Router",
    "IT - Broadband",
    "IT - Dongle"
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
  Misc: [
    "Misc - Box file",
    "Misc - Bucket / Mug / Bath Stool",
    "Misc - Bulb & Tubelights",
    "Misc - Calculator",
    "Misc - Curtains",
    "Misc - Door Mat",
    "Misc - Door Bell",
    "Misc - Dustbin",
    "Misc - Extension Board",
    "Misc - File Stand",
    "Misc - File tray",
    "Misc - Lock & Keys",
    "Misc - Measuring Tape",
    "Misc - Mirror",
    "Misc - Punching Machine",
    "Misc - Register",
    "Misc - Stamp",
    "Misc - Stapler",
    "Misc - Wall Clock",
    "Misc - Water Heating Rod",
    "Misc - Water Jug",
    "Misc - White Board",
    "Misc - Window Screen"
  ]
} as const;

export const ASSET_CLASS_GROUP_OPTIONS = ["All", "Appliances", "IT", "Furniture", "Vehicles", "Misc"] as const;

export type AssetClassGroup = (typeof ASSET_CLASS_GROUP_OPTIONS)[number];

export const ASSET_CLASS_OPTIONS_BY_GROUP = Object.entries(ASSET_CLASS_GROUPS).map(([group, options]) => ({
  group,
  options: options.map((label) => ({ label, value: label }))
}));

export function getAssetClassGroup(assetClass: string): AssetClassGroup | "Other" {
  for (const [group, values] of Object.entries(ASSET_CLASS_GROUPS)) {
    if (values.includes(assetClass)) {
      return group as AssetClassGroup;
    }
  }
  return "Other";
}
