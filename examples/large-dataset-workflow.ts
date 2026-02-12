import fs from 'node:fs';
import readline from 'node:readline';
import { performance } from 'node:perf_hooks';
import path from 'node:path';

import {
  Intervention,
  arrayAdapter,
  createScenarioTemplate,
} from '../src';

type ProjectedBuilding = {
  uprn: string;
  estimatedPVCost: number;
  projectedDemandIncreaseKw: number;
  substationId: string;
  fuelPovertyScore: number;
  carbonSavingPotential: number;
  areaType: string;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
}

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeHeaderMap(headers: string[]) {
  const map = new Map<string, number>();
  headers.forEach((h, idx) => map.set(h.trim().toLowerCase(), idx));
  return map;
}

function pickField(cells: string[], headerMap: Map<string, number>, names: string[], fallback = '') {
  for (const name of names) {
    const idx = headerMap.get(name.toLowerCase());
    if (idx !== undefined) return cells[idx] ?? fallback;
  }
  return fallback;
}

async function loadProjectedBuildings(csvPath: string, limit?: number): Promise<ProjectedBuilding[]> {
  const stream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const rows: ProjectedBuilding[] = [];
  let headerMap: Map<string, number> | null = null;

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (!headerMap) {
      headerMap = normalizeHeaderMap(parseCsvLine(line));
      continue;
    }

    const cells = parseCsvLine(line);

    const uprn = pickField(cells, headerMap, ['uprn', 'uprn_id', 'id'], '').trim();
    if (!uprn) continue;

    const estimatedPVCost = toNumber(
      pickField(cells, headerMap, ['estimatedpvcost', 'pv_cost', 'cost'], ''),
      6000,
    );

    const projectedDemandIncreaseKw = toNumber(
      pickField(cells, headerMap, ['projecteddemandincreasekw', 'demand_increase_kw', 'demandkw'], ''),
      15,
    );

    const substationId = pickField(cells, headerMap, ['substationid', 'substation_id', 'substation'], 'UNKNOWN') || 'UNKNOWN';

    const fuelPovertyScore = toNumber(
      pickField(cells, headerMap, ['fuelpovertyscore', 'fuel_poverty_score'], ''),
      0.4,
    );

    const carbonSavingPotential = toNumber(
      pickField(cells, headerMap, ['carbonsavingpotential', 'carbon_saving_potential'], ''),
      0.5,
    );

    const areaType = pickField(cells, headerMap, ['areatype', 'area_type', 'urban_rural'], 'urban') || 'urban';

    rows.push({
      uprn,
      estimatedPVCost,
      projectedDemandIncreaseKw,
      substationId,
      fuelPovertyScore,
      carbonSavingPotential,
      areaType,
    });

    if (limit && rows.length >= limit) break;
  }

  rl.close();
  stream.close();
  return rows;
}

function runStage(stageName: string, buildings: ProjectedBuilding[]) {
  const template = createScenarioTemplate({
    stateDefaults: {
      budgetAllocation: { 2026: 20_000_000 },
      budgetSpent: { 2026: 0 },
      substationCapacities: { S1: 20000, S2: 15000, UNKNOWN: 100000 },
      fuelPovertyPriority: {
        threshold: 0.45,
        weights: {
          fuelPovertyScore: 0.6,
          carbonSavingPotential: 0.4,
        },
      },
    },
  });

  const facet = arrayAdapter(buildings);

  const intervention = new Intervention(`Large-dataset stage: ${stageName}`, {
    facet,
    startYear: 2026,
    endYear: 2026,
    init: template.init,
    filter: template.pluginRefs!.grid.substationCapacityGate.exportRef,
    prioritise: template.pluginRefs!.timeseries.loadProfileScoring.exportRef,
    upgrade: template.pluginRefs!.financial.budgetSpendTracker.exportRef,
  });

  const start = performance.now();
  const result = intervention.simulate();
  const end = performance.now();

  const selected = result.metrics['2026']?.length ?? 0;
  const spent = result.state.budgetSpent?.[2026] ?? 0;

  return {
    stageName,
    inputRows: buildings.length,
    selected,
    spent,
    elapsedMs: Math.round(end - start),
  };
}

async function main() {
  const csvPath = path.resolve(process.cwd(), 'data/winchester_building_stock.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found at ${csvPath}`);
  }

  console.log('Running staged large-dataset workflow...');

  const smokeRows = await loadProjectedBuildings(csvPath, 2_000);
  const mediumRows = await loadProjectedBuildings(csvPath, 15_000);
  const fullRows = await loadProjectedBuildings(csvPath);

  const smoke = runStage('smoke (2k)', smokeRows);
  const medium = runStage('medium (15k)', mediumRows);
  const full = runStage('full (all rows)', fullRows);

  console.table([smoke, medium, full]);

  console.log('Tips:');
  console.log('- Keep projected fields minimal in loadProjectedBuildings().');
  console.log('- Add scenario constraints incrementally and re-run staged checks.');
  console.log('- Run sensitivity/Monte Carlo only after baseline full run stabilizes.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
