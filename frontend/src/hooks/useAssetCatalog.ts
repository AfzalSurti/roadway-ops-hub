import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ASSET_CLASS_OPTIONS, getAssetTypesForClass as getStaticTypesForClass } from "@/lib/asset-catalog";

export type AssetCatalogEntry = {
  id: string;
  className: string;
  types: string[];
  sortOrder: number;
};

export function useAssetCatalog() {
  const query = useQuery({
    queryKey: ["asset-catalog"],
    queryFn: () => api.getAssetCatalog()
  });

  const catalog = query.data ?? [];

  const classOptions = catalog.length
    ? [...catalog.map((entry) => entry.className), "Other"]
    : [...ASSET_CLASS_OPTIONS];

  const getTypesForClass = (assetClass: string): string[] => {
    if (assetClass === "Other") {
      return [];
    }

    const fromCatalog = catalog.find((entry) => entry.className === assetClass)?.types ?? [];
    if (fromCatalog.length) {
      return fromCatalog;
    }

    return getStaticTypesForClass(assetClass);
  };

  return {
    catalog,
    classOptions,
    getTypesForClass,
    isLoading: query.isLoading,
    refetch: query.refetch
  };
}

export const SURVEY_EQUIPMENT_CLASS = "Survey Equipment";
export const IN_STORE_PROJECT_LABEL = "IN_STORE";
