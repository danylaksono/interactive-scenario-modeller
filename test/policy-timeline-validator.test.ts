import { describe, it, expect } from 'vitest';
import {
  arrayAdapter,
  createPolicyTimelineValidatorPlugin,
  Intervention,
  registerPlugin,
} from '../src';

describe('Policy timeline validator plugin', () => {
  it('passes for valid policy timeline schema', () => {
    const pluginName = `policy-validator-${Date.now()}`;
    registerPlugin(createPolicyTimelineValidatorPlugin({ name: pluginName }));

    const facet = arrayAdapter([
      { uprn: 'a' },
      { uprn: 'b' },
    ]);

    const intervention = new Intervention('policy-valid', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.activePolicies = {
          2026: {
            enabledBuildingTypes: ['residential', 'public'],
            minEfficiencyStandard: 60,
          },
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    expect(result.metrics['2026']).toHaveLength(2);
  });

  it('blocks upgrades on invalid policy schema', () => {
    const pluginName = `policy-validator-invalid-${Date.now()}`;
    registerPlugin(createPolicyTimelineValidatorPlugin({ name: pluginName }));

    const facet = arrayAdapter([{ uprn: 'a' }]);

    const intervention = new Intervention('policy-invalid', {
      facet,
      startYear: 2026,
      endYear: 2026,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.activePolicies = {
          2026: {
            enabledBuildingTypes: [123],
          },
        };
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    expect(result.metrics['2026']).toHaveLength(0);
  });

  it('blocks upgrades when strict coverage is enabled and a required year is missing', () => {
    const pluginName = `policy-validator-coverage-${Date.now()}`;
    registerPlugin(
      createPolicyTimelineValidatorPlugin({
        name: pluginName,
        strictCoverage: true,
      }),
    );

    const facet = arrayAdapter([{ uprn: 'a' }]);

    const intervention = new Intervention('policy-coverage', {
      facet,
      startYear: 2026,
      endYear: 2027,
      filter: `${pluginName}:constraint`,
      init: (context) => {
        context.state.activePolicies = {
          2026: {
            enabledBuildingTypes: ['residential'],
          },
        };
        context.state.requiredPolicyYears = [2026, 2027];
      },
      upgrade: () => ({ selected: true }),
    });

    const result = intervention.simulate();
    expect(result.metrics['2026']).toHaveLength(0);
    expect(result.metrics['2027']).toHaveLength(0);
  });
});
