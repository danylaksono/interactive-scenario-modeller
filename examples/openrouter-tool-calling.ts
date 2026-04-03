import {
  createLlmToolRuntime,
  getLlmToolDefinitions,
  type LLMFunctionToolDefinition,
  type LLMToolCall,
} from "../src";

type HostToolResult = {
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
};

type AddH3LayerArgs = {
  layerId: string;
  geojson: string;
  colorBy: string;
  opacity?: number;
};

const hostToolDefinitions: LLMFunctionToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "addH3Layer",
      description:
        "Add a styled H3 hexagonal choropleth layer to the map after spatial queries/simulation outputs.",
      parameters: {
        type: "object",
        properties: {
          layerId: {
            type: "string",
            description: "Unique layer ID, e.g. 'energy-demand-hex'",
          },
          geojson: {
            type: "string",
            description: "Stringified GeoJSON FeatureCollection (from previous tool call)",
          },
          colorBy: {
            type: "string",
            description: "Metric column used for data-driven color",
          },
          opacity: {
            type: "number",
            description: "Layer opacity between 0.3 and 0.9",
          },
        },
        required: ["layerId", "geojson", "colorBy"],
        additionalProperties: false,
      },
    },
  },
];

function addH3Layer(args: AddH3LayerArgs): HostToolResult {
  try {
    const geojsonObj = JSON.parse(args.geojson) as {
      type: string;
      features?: Array<Record<string, any>>;
    };

    if (geojsonObj.type !== "FeatureCollection") {
      return { success: false, error: "Expected FeatureCollection GeoJSON" };
    }

    const featureCount = Array.isArray(geojsonObj.features) ? geojsonObj.features.length : 0;

    // In a real app, this is where map source/layer mutation happens.
    return {
      success: true,
      message: `H3 layer '${args.layerId}' added and colored by ${args.colorBy}`,
      data: {
        layerId: args.layerId,
        sourceId: `${args.layerId}-source`,
        featureCount,
        colorBy: args.colorBy,
        opacity: args.opacity ?? 0.65,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function runHostTool(call: LLMToolCall): HostToolResult {
  switch (call.name) {
    case "addH3Layer":
      return addH3Layer((call.args ?? {}) as AddH3LayerArgs);
    default:
      return { success: false, error: `Unknown host tool '${call.name}'` };
  }
}

function main() {
  const runtime = createLlmToolRuntime();
  const libraryTools = getLlmToolDefinitions();
  const allToolsForModel = [...libraryTools, ...hostToolDefinitions];

  console.log("Tool definitions exposed to model:", allToolsForModel.map((t) => t.function.name));

  const modelPlannedCalls: LLMToolCall[] = [
    {
      name: "createFacetFromRows",
      args: {
        facetId: "demo-facet",
        rows: [
          {
            id: "A",
            estimatedPVCost: 1200,
            geometry: {
              type: "Point",
              coordinates: [-1.2603, 51.752],
            },
          },
          {
            id: "B",
            estimatedPVCost: 800,
            geometry: {
              type: "Point",
              coordinates: [-1.2577, 51.7546],
            },
          },
        ],
      },
    },
    {
      name: "installAllPlugins",
      args: {},
    },
    {
      name: "createInterventionFromRefs",
      args: {
        interventionId: "pv-rollout-2026",
        name: "PV rollout",
        facetId: "demo-facet",
        startYear: 2026,
        endYear: 2026,
        upgradeRef: "financial-budget-spend-tracker:upgrade",
      },
    },
    {
      name: "simulateIntervention",
      args: {
        interventionId: "pv-rollout-2026",
      },
    },
    {
      name: "toGeoJSON",
      args: {
        interventionId: "pv-rollout-2026",
        stringify: true,
      },
    },
  ];

  let geojsonString = "";

  for (const call of modelPlannedCalls) {
    const result = runtime.executeToolCall(call);
    console.log(`\n[Library Tool] ${call.name}`);
    console.log(result);

    if (!result.success) {
      throw new Error(`Tool call failed: ${call.name} :: ${result.error ?? "unknown error"}`);
    }

    if (call.name === "toGeoJSON" && typeof result.data === "string") {
      geojsonString = result.data;
    }
  }

  const hostCall: LLMToolCall = {
    name: "addH3Layer",
    args: {
      layerId: "energy-demand-hex",
      geojson: geojsonString,
      colorBy: "cost",
      opacity: 0.7,
    },
  };

  const hostResult = runHostTool(hostCall);
  console.log(`\n[Host Tool] ${hostCall.name}`);
  console.log(hostResult);
}

main();
