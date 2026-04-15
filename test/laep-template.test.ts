import { describe, it, expect } from 'vitest';
import { createLaepTemplate, laepPropertySpec } from '../src';

describe('LAEP template', () => {
  it('merges LAEP defaults into context.state on init', () => {
    const tpl = createLaepTemplate({
      installPlugins: false,
      laepStateDefaults: {
        dfesActiveScenario: 'Central',
        coBenefitsCoefficients: { gbpPerKgNoxReduced: 42 },
      },
    });
    const state: Record<string, unknown> = {};
    tpl.init({ state } as any);
    expect(state.dfesActiveScenario).toBe('Central');
    expect((state.coBenefitsCoefficients as { gbpPerKgNoxReduced: number }).gbpPerKgNoxReduced).toBe(42);
  });

  it('exposes a property spec with LAEP-oriented columns', () => {
    const spec = laepPropertySpec();
    expect(spec.columns?.length).toBeGreaterThan(5);
    expect(spec.columns).toContain('coBenefitsGbpTotal');
  });
});
