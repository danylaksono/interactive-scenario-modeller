/**
 * Normalisers for common UK planning datasets. This module does not ship any register data;
 * applications load CSV/GeoJSON and pass rows through these helpers before building facets.
 */

export type EpcRowInput = Record<string, unknown>;

/** Canonical field names after normalisation */
export type NormalisedEpcRow = {
  uprn?: string;
  lodgementDate?: string;
  currentEnergyRating?: string;
  propertyType?: string;
  totalFloorAreaM2?: number;
  /** kWh/m²/year (SAP) when present */
  energyConsumptionCurrent?: number;
};

function pickString(row: EpcRowInput, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

function pickNumber(row: EpcRowInput, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

/**
 * Maps common EPC register column aliases onto stable entity field names.
 */
export function normaliseEpcRow(row: EpcRowInput): NormalisedEpcRow {
  return {
    uprn: pickString(row, ["UPRN", "uprn", "UPRN_INT", "uprn_int"]),
    lodgementDate: pickString(row, ["LODGEMENT_DATE", "lodgement_date", "lodgementDate"]),
    currentEnergyRating: pickString(row, ["CURRENT_ENERGY_RATING", "current_energy_rating", "currentEnergyRating"]),
    propertyType: pickString(row, ["PROPERTY_TYPE", "property_type", "propertyType"]),
    totalFloorAreaM2: pickNumber(row, ["TOTAL_FLOOR_AREA", "total_floor_area", "totalFloorArea", "floorAreaM2"]),
    energyConsumptionCurrent: pickNumber(row, [
      "ENERGY_CONSUMPTION_CURRENT",
      "energy_consumption_current",
      "energyConsumptionCurrent",
    ]),
  };
}

export type ImdRowInput = Record<string, unknown>;

export type NormalisedImdRow = {
  lsoaCode?: string;
  imdDecile?: number;
  imdRank?: number;
};

/**
 * Normalises Index of Multiple Deprivation extracts (LSOA level).
 */
export function normaliseImdRow(row: ImdRowInput): NormalisedImdRow {
  const lsoaCode = pickString(row, ["lsoa11cd", "LSOA11CD", "lsoa_code", "lsoaCode"]);
  const decile = pickNumber(row, ["imd_decile", "IMD_Decile", "Index of Multiple Deprivation (IMD) Decile", "imdDecile"]);
  const rank = pickNumber(row, ["imd_rank", "IMD_Rank", "imdRank"]);
  return {
    lsoaCode,
    imdDecile: decile !== undefined ? Math.min(10, Math.max(1, Math.round(decile))) : undefined,
    imdRank: rank !== undefined ? Math.round(rank) : undefined,
  };
}

export type OsUprnRowInput = Record<string, unknown>;

export type NormalisedOsUprnRow = {
  uprn?: string;
  easting?: number;
  northing?: number;
  parentUprn?: string;
};

/**
 * Normalises Ordnance Survey addressing / UPRN extracts (typical column names).
 */
export function normaliseOsUprnRow(row: OsUprnRowInput): NormalisedOsUprnRow {
  return {
    uprn: pickString(row, ["UPRN", "uprn"]),
    easting: pickNumber(row, ["EASTING", "easting", "x_coordinate"]),
    northing: pickNumber(row, ["NORTHING", "northing", "y_coordinate"]),
    parentUprn: pickString(row, ["PARENT_UPRN", "parent_uprn", "parentUprn"]),
  };
}

export type DfesSubstationCapacityRow = {
  substationId: string;
  year?: number;
  scenario?: string;
  /** kW or MW depending on source — caller should convert to kW before simulation */
  headroomKw?: number;
};

/**
 * Builds `context.state.substationCapacitiesByScenario` from flat joined rows
 * (e.g. after merging a DNO export with asset identifiers).
 */
export function buildDfesCapacityByScenario(rows: DfesSubstationCapacityRow[]): Record<string, Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, Record<string, number>>> = {};
  for (const row of rows) {
    const scenario = row.scenario ?? "default";
    const sid = String(row.substationId ?? "");
    if (!sid) continue;
    const year = row.year !== undefined ? String(row.year) : "flat";
    const kw = row.headroomKw ?? 0;
    out[scenario] = out[scenario] ?? {};
    out[scenario][year] = out[scenario][year] ?? {};
    out[scenario][year][sid] = kw;
  }
  return out;
}
