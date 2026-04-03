import { Intervention } from "./intervention";
import { arrayAdapter } from "./facet-adapter";
import { listPredicates } from "./registry";
import { listPlugins } from "./plugin";
import { toGeoJSON } from "./utils";
import { installAllPlugins, type AllBundleInstallOptions } from "./plugins/installers";
import {
  installScenarioModellerPresets,
  type ScenarioPresetInstallOptions,
} from "./presets/scenario-modeller";

export type JsonSchema = {
  type?: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: Array<string | number | boolean | null>;
  additionalProperties?: boolean | JsonSchema;
  default?: unknown;
};

export type LLMFunctionToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
};

export type LLMToolCall = {
  name: string;
  args?: Record<string, any>;
};

type CreateFacetArgs = {
  facetId: string;
  rows: Record<string, any>[];
};

type InstallPluginsArgs = {
  options?: AllBundleInstallOptions;
};

type InstallScenarioPresetsArgs = {
  options?: ScenarioPresetInstallOptions;
};

type CreateInterventionArgs = {
  interventionId: string;
  name: string;
  facetId: string;
  description?: string;
  startYear: number;
  endYear: number;
  filterRef?: string;
  prioritiseRef?: string;
  upgradeRef?: string;
};

type SimulateInterventionArgs = {
  interventionId: string;
  sharedResources?: Record<string, number>;
};

type ExportGeoJSONArgs = {
  interventionId: string;
  stringify?: boolean;
};

type GetSimulationResultArgs = {
  interventionId: string;
};

type ToolResult = {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
};

const DEFINITIONS: LLMFunctionToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "createFacetFromRows",
      description:
        "Create a facet from plain rows and store it in runtime state for later intervention creation.",
      parameters: {
        type: "object",
        properties: {
          facetId: {
            type: "string",
            description: "Unique facet identifier.",
          },
          rows: {
            type: "array",
            description: "Array of row objects.",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
        required: ["facetId", "rows"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "installAllPlugins",
      description:
        "Install all plugin bundles in the global plugin registry and return export references.",
      parameters: {
        type: "object",
        properties: {
          options: {
            type: "object",
            description: "Optional nested plugin options mirroring installAllPlugins(options).",
            additionalProperties: true,
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "installScenarioModellerPresets",
      description:
        "Install scenario preset predicates/plugins and return predicate and plugin-export references.",
      parameters: {
        type: "object",
        properties: {
          options: {
            type: "object",
            description: "Optional scenario preset install options.",
            additionalProperties: true,
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createInterventionFromRefs",
      description:
        "Create and store an Intervention using facetId and predicate/plugin references (no executable code in args).",
      parameters: {
        type: "object",
        properties: {
          interventionId: {
            type: "string",
            description: "Unique intervention identifier.",
          },
          name: {
            type: "string",
            description: "Intervention display name.",
          },
          facetId: {
            type: "string",
            description: "Existing facet ID created by createFacetFromRows.",
          },
          description: {
            type: "string",
            description: "Optional intervention description.",
          },
          startYear: {
            type: "integer",
            description: "Inclusive start year.",
          },
          endYear: {
            type: "integer",
            description: "Inclusive end year.",
          },
          filterRef: {
            type: "string",
            description: "Registered predicate or plugin export ref used as filter.",
          },
          prioritiseRef: {
            type: "string",
            description: "Registered predicate or plugin export ref used as prioritiser.",
          },
          upgradeRef: {
            type: "string",
            description: "Registered predicate or plugin export ref used as upgrade/transform.",
          },
        },
        required: ["interventionId", "name", "facetId", "startYear", "endYear"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simulateIntervention",
      description:
        "Run simulate() for a stored intervention and keep the latest result in runtime state.",
      parameters: {
        type: "object",
        properties: {
          interventionId: {
            type: "string",
            description: "Intervention ID to run.",
          },
          sharedResources: {
            type: "object",
            description: "Optional shared resources map (string->number).",
            additionalProperties: {
              type: "number",
            },
          },
        },
        required: ["interventionId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getSimulationResult",
      description:
        "Return the latest stored simulation result for an intervention in JSON-serializable form.",
      parameters: {
        type: "object",
        properties: {
          interventionId: {
            type: "string",
            description: "Intervention ID.",
          },
        },
        required: ["interventionId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toGeoJSON",
      description:
        "Convert the simulated facet of an intervention to GeoJSON FeatureCollection.",
      parameters: {
        type: "object",
        properties: {
          interventionId: {
            type: "string",
            description: "Intervention ID with an existing simulation result.",
          },
          stringify: {
            type: "boolean",
            description: "If true, return geojson as a string for downstream tools that require string input.",
            default: false,
          },
        },
        required: ["interventionId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listPredicates",
      description: "List currently registered predicate names.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listPlugins",
      description: "List currently registered plugin manifests.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

function yearEntryCount(metrics: Record<string, any>): number {
  let total = 0;
  for (const values of Object.values(metrics ?? {})) {
    if (Array.isArray(values)) total += values.length;
  }
  return total;
}

export function getLlmToolDefinitions(): LLMFunctionToolDefinition[] {
  return DEFINITIONS.slice();
}

export class LlmToolRuntime {
  private readonly facets = new Map<string, ReturnType<typeof arrayAdapter>>();
  private readonly interventions = new Map<string, Intervention>();
  private readonly simulationResults = new Map<string, ReturnType<Intervention["simulate"]>>();

  createFacetFromRows(args: CreateFacetArgs): ToolResult {
    if (!Array.isArray(args.rows)) {
      return { success: false, error: "rows must be an array" };
    }
    this.facets.set(args.facetId, arrayAdapter(args.rows));
    return {
      success: true,
      message: `Facet '${args.facetId}' created with ${args.rows.length} rows`,
      data: { facetId: args.facetId, rowCount: args.rows.length },
    };
  }

  installAllPlugins(args: InstallPluginsArgs = {}): ToolResult {
    const refs = installAllPlugins(args.options ?? {});
    return {
      success: true,
      message: "Installed all plugin bundles",
      data: refs,
    };
  }

  installScenarioModellerPresets(args: InstallScenarioPresetsArgs = {}): ToolResult {
    const refs = installScenarioModellerPresets(args.options ?? {});
    return {
      success: true,
      message: "Installed scenario-modeller presets",
      data: refs,
    };
  }

  createInterventionFromRefs(args: CreateInterventionArgs): ToolResult {
    const facet = this.facets.get(args.facetId);
    if (!facet) {
      return {
        success: false,
        error: `Unknown facetId '${args.facetId}'. Call createFacetFromRows first.`,
      };
    }

    const intervention = new Intervention(args.name, {
      description: args.description,
      facet,
      startYear: args.startYear,
      endYear: args.endYear,
      filter: args.filterRef,
      prioritise: args.prioritiseRef,
      upgrade: args.upgradeRef,
    });

    this.interventions.set(args.interventionId, intervention);
    return {
      success: true,
      message: `Intervention '${args.interventionId}' created`,
      data: {
        interventionId: args.interventionId,
        name: args.name,
        startYear: args.startYear,
        endYear: args.endYear,
      },
    };
  }

  simulateIntervention(args: SimulateInterventionArgs): ToolResult {
    const intervention = this.interventions.get(args.interventionId);
    if (!intervention) {
      return {
        success: false,
        error: `Unknown interventionId '${args.interventionId}'`,
      };
    }

    const result = intervention.simulate(null, args.sharedResources ?? null);
    this.simulationResults.set(args.interventionId, result);

    return {
      success: true,
      message: `Intervention '${args.interventionId}' simulated`,
      data: {
        interventionId: args.interventionId,
        years: Object.keys(result.metrics),
        metricEntryCount: yearEntryCount(result.metrics as Record<string, any>),
        entityCount: result.entities.length,
      },
    };
  }

  getSimulationResult(args: GetSimulationResultArgs): ToolResult {
    const result = this.simulationResults.get(args.interventionId);
    if (!result) {
      return {
        success: false,
        error: `No simulation result for interventionId '${args.interventionId}'`,
      };
    }

    return {
      success: true,
      data: {
        state: result.state,
        metrics: result.metrics,
        entities: result.entities,
        columns: Array.from(result.columns),
      },
    };
  }

  toGeoJSON(args: ExportGeoJSONArgs): ToolResult {
    const intervention = this.interventions.get(args.interventionId);
    if (!intervention) {
      return {
        success: false,
        error: `Unknown interventionId '${args.interventionId}'`,
      };
    }

    const geojson = toGeoJSON(intervention.simulatedFacet);
    if (!geojson) {
      return {
        success: false,
        error: `No geometry available for interventionId '${args.interventionId}'`,
      };
    }

    return {
      success: true,
      data: args.stringify ? JSON.stringify(geojson) : geojson,
    };
  }

  listPredicates(): ToolResult {
    return {
      success: true,
      data: listPredicates(),
    };
  }

  listPlugins(): ToolResult {
    return {
      success: true,
      data: listPlugins().map((p) => p.manifest),
    };
  }

  executeToolCall(call: LLMToolCall): ToolResult {
    const args = call.args ?? {};
    try {
      switch (call.name) {
        case "createFacetFromRows":
          return this.createFacetFromRows(args as CreateFacetArgs);
        case "installAllPlugins":
          return this.installAllPlugins(args as InstallPluginsArgs);
        case "installScenarioModellerPresets":
          return this.installScenarioModellerPresets(args as InstallScenarioPresetsArgs);
        case "createInterventionFromRefs":
          return this.createInterventionFromRefs(args as CreateInterventionArgs);
        case "simulateIntervention":
          return this.simulateIntervention(args as SimulateInterventionArgs);
        case "getSimulationResult":
          return this.getSimulationResult(args as GetSimulationResultArgs);
        case "toGeoJSON":
          return this.toGeoJSON(args as ExportGeoJSONArgs);
        case "listPredicates":
          return this.listPredicates();
        case "listPlugins":
          return this.listPlugins();
        default:
          return {
            success: false,
            error: `Unknown tool '${call.name}'`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export function createLlmToolRuntime(): LlmToolRuntime {
  return new LlmToolRuntime();
}
