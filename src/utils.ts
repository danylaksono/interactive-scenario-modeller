export class DataTable {
  columns: string[];
  data: any[];
  constructor(columns: string[], data: any[]) { this.columns = columns; this.data = data; }
  identityFacet() { // minimal facade
    return {
      columns: this.columns.slice(),
      data: this.data.slice(),
      getRowCount() { return this.data.length; },
      getRow(i: number) { return this.data[i]; }
    };
  }
}

export function compilePredicate(code: string): Function {
  if (typeof code !== 'string' || !code.trim()) throw new Error('No code provided');
  try {
    const fn = Function('"use strict"; return (' + code + ')')();
    if (typeof fn !== 'function') throw new Error('Compiled code is not a function');
    return fn;
  } catch (e:any) {
    throw new Error(`Failed to compile predicate: ${e && e.message ? e.message : String(e)}`);
  }
}

export function safeEval(code: string) {
  // Deprecated convenience wrapper: prefer `compilePredicate` + `registerPredicate`.
  return compilePredicate(code);
}