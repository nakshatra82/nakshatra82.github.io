import { evaluate } from './circuit';
import type { CircuitEdit, CircuitStore } from './circuit-store';

export type RegisteredTool = { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute: (input: unknown) => unknown | Promise<unknown> };
type ModelContext = { registerTool: (tool: RegisteredTool, options: { signal: AbortSignal }) => void | Promise<void> };
export function registerCircuitTools(context: ModelContext | undefined, store: CircuitStore, onError: (error: unknown) => void) {
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const tools: RegisteredTool[] = [
    { name: 'read_circuit', description: 'Read the current board, component IDs, connections, and binary signal values.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute(input) {
      if (!input || typeof input !== 'object' || Object.keys(input).length) throw new Error('read_circuit expects an empty object.');
      const circuit = store.getSnapshot().present; return { circuit, signals: evaluate(circuit) };
    } },
    { name: 'edit_circuit', description: 'Apply one or more circuit edits atomically to the visible board. Returns added component IDs and updated signals. Coordinates are x -16..16, z -11..11. Read the circuit first to get current IDs.', inputSchema: {
      type: 'object', required: ['edits'], additionalProperties: false, properties: { edits: { type: 'array', minItems: 1, maxItems: 100, items: { oneOf: [
        { type: 'object', additionalProperties: false, required: ['action','kind','x','z'], properties: { action: { const: 'add' }, kind: { enum: ['INPUT','LED','NOT','AND','OR','XOR','NAND','NOR','XNOR'] }, x: { type: 'number' }, z: { type: 'number' } } },
        { type: 'object', additionalProperties: false, required: ['action','id','x','z'], properties: { action: { const: 'move' }, id: { type: 'string' }, x: { type: 'number' }, z: { type: 'number' } } },
        { type: 'object', additionalProperties: false, required: ['action','from','to','pin'], properties: { action: { const: 'connect' }, from: { type: 'string' }, to: { type: 'string' }, pin: { type: 'integer', minimum: 0, maximum: 1 } } },
        { type: 'object', additionalProperties: false, required: ['action','id'], properties: { action: { const: 'remove' }, id: { type: 'string' } } },
        { type: 'object', additionalProperties: false, required: ['action','id','value'], properties: { action: { const: 'set_input' }, id: { type: 'string' }, value: { enum: [0,1] } } },
        { type: 'object', additionalProperties: false, required: ['action','id','label'], properties: { action: { const: 'rename' }, id: { type: 'string' }, label: { type: 'string', maxLength: 40 } } },
      ] } } },
    }, annotations: { readOnlyHint: false }, async execute(input) {
      if (!input || typeof input !== 'object' || !('edits' in input) || Object.keys(input).some(k => k !== 'edits')) throw new Error('Provide an edits array.');
      const result = store.edit(input.edits as CircuitEdit[]);
      // Subscribers update React synchronously; wait for a browser paint before reporting completion.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return { added: result.added, components: result.circuit.parts.length, connections: result.circuit.wires.length, signals: result.signals };
    } },
  ];
  for (const tool of tools) { try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(onError); } catch (error) { onError(error); } }
  return () => lifecycle.abort();
}
export function browserModelContext() { return typeof document === 'undefined' ? undefined : (document as Document & { modelContext?: ModelContext }).modelContext; }
