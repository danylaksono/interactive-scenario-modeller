import type { PluginManifest, PluginKind } from './plugin';

const semverRe = /^\d+\.\d+\.\d+(-.+)?$/;
const allowedKinds: PluginKind[] = ['predicate','prioritiser','upgrade','constraint','adapter','outputBuilder','composite'];

export function validateManifest(manifest: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object') {
    errors.push('manifest must be an object');
    return { valid: false, errors };
  }
  if (!manifest.name || typeof manifest.name !== 'string') errors.push('manifest.name is required and must be a string');
  if (!manifest.version || typeof manifest.version !== 'string' || !semverRe.test(manifest.version)) errors.push('manifest.version is required and must be semver (e.g. 1.0.0)');
  const kinds = Array.isArray(manifest.kind) ? manifest.kind : [manifest.kind];
  if (!manifest.kind || kinds.length === 0 || kinds.some((k: any) => !allowedKinds.includes(k))) errors.push(`manifest.kind must be one of: ${allowedKinds.join(', ')}`);
  if (!manifest.entry || typeof manifest.entry !== 'string') errors.push('manifest.entry is required and must be a string');
  if (manifest.exports && typeof manifest.exports !== 'object') errors.push('manifest.exports must be an object when present');
  if (manifest.exports && Object.values(manifest.exports).some((v) => typeof v !== 'string')) errors.push('manifest.exports values must be strings');
  if (manifest.configSchema && typeof manifest.configSchema !== 'object') errors.push('manifest.configSchema must be an object when present');
  if (manifest.trusted !== undefined && typeof manifest.trusted !== 'boolean') errors.push('manifest.trusted must be a boolean when present');
  if (manifest.compat && manifest.compat.package !== 'interactive-scenario-modeller') errors.push('manifest.compat.package must be "interactive-scenario-modeller" when present');
  if (manifest.compat?.minVersion && !semverRe.test(manifest.compat.minVersion)) errors.push('manifest.compat.minVersion must be semver when present');
  if (manifest.compat?.maxVersion && !semverRe.test(manifest.compat.maxVersion)) errors.push('manifest.compat.maxVersion must be semver when present');
  return { valid: errors.length === 0, errors };
}

export function validatePluginRegistration(registration: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!registration || typeof registration !== 'object') {
    return { valid: false, errors: ['registration must be an object'] };
  }

  const manifestResult = validateManifest(registration.manifest as PluginManifest);
  if (!manifestResult.valid) errors.push(...manifestResult.errors);

  const kinds = Array.isArray(registration?.manifest?.kind)
    ? registration.manifest.kind
    : [registration?.manifest?.kind];

  const kindToHandler: Record<PluginKind, string | null> = {
    predicate: 'predicate',
    prioritiser: 'prioritise',
    upgrade: 'upgrade',
    constraint: 'constraint',
    adapter: 'adapter',
    outputBuilder: 'outputBuilder',
    composite: null,
  };

  for (const kind of kinds) {
    if (!allowedKinds.includes(kind as PluginKind)) continue;
    const typedKind = kind as PluginKind;
    const handler = kindToHandler[typedKind];
    if (!handler) continue;
    if (typeof registration[handler] !== 'function') {
      errors.push(`plugin kind "${typedKind}" requires a "${handler}" function`);
    }
  }

  return { valid: errors.length === 0, errors };
}
