export const TYPES = ['INPUT', 'LED', 'NOT', 'AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'] as const;
export type Kind = typeof TYPES[number];
export type Signal = 0 | 1 | null;
export type Part = { id: string; kind: Kind; label: string; x: number; z: number; value?: 0 | 1 };
export type Wire = { id: string; from: string; to: string; pin: number };
export type Circuit = { version: 1; name: string; parts: Part[]; wires: Wire[] };
export const STORAGE_KEY = 'nakshatra-circuit-v1';
export const BOARD_LIMITS = { x: 16, z: 11 } as const;
export function boardSize(circuit: Circuit): [number, number] {
  const large = circuit.parts.some(p => Math.abs(p.x) > 9 || Math.abs(p.z) > 5.5);
  return large ? [36, 26] : [22, 15];
}
export const inputCount = (kind: Kind) => kind === 'INPUT' ? 0 : kind === 'NOT' || kind === 'LED' ? 1 : 2;
export const signalText = (value: Signal | undefined) => value == null ? '?' : String(value);
export const descriptions: Record<Kind, string> = {
  INPUT: 'A switch that supplies a binary 0 or 1.', LED: 'Lights up when its input is 1.', NOT: 'Inverts its input.',
  AND: 'High only when both inputs are high.', OR: 'High when either input is high.', XOR: 'High when the inputs are different.',
  NAND: 'The inverse of AND.', NOR: 'The inverse of OR.', XNOR: 'High when the inputs match.',
};
export function gate(kind: Kind, inputs: Signal[]): Signal {
  const [a = null, b = null] = inputs;
  const invert = (v: Signal): Signal => v === null ? null : v === 1 ? 0 : 1;
  const and: Signal = a === 0 || b === 0 ? 0 : a === null || b === null ? null : 1;
  const or: Signal = a === 1 || b === 1 ? 1 : a === null || b === null ? null : 0;
  const xor: Signal = a === null || b === null ? null : a === b ? 0 : 1;
  switch (kind) {
    case 'LED': return a; case 'NOT': return invert(a); case 'AND': return and; case 'OR': return or;
    case 'XOR': return xor; case 'NAND': return invert(and); case 'NOR': return invert(or); case 'XNOR': return invert(xor);
    default: return null;
  }
}
export function evaluate(circuit: Circuit): Record<string, Signal> {
  const values: Record<string, Signal> = {};
  const visiting = new Set<string>();
  const parts = new Map(circuit.parts.map(p => [p.id, p]));
  const incoming = new Map(circuit.wires.map(w => [`${w.to}:${w.pin}`, w.from]));
  function visit(id: string): Signal {
    if (Object.hasOwn(values, id)) return values[id];
    if (visiting.has(id)) throw new Error('Feedback loops are not supported.');
    const p = parts.get(id); if (!p) return null;
    visiting.add(id);
    const value = p.kind === 'INPUT' ? p.value ?? 0 : gate(p.kind, Array.from({ length: inputCount(p.kind) }, (_, pin) => {
      const from = incoming.get(`${id}:${pin}`); return from ? visit(from) : null;
    }));
    visiting.delete(id); values[id] = value; return value;
  }
  circuit.parts.forEach(p => visit(p.id)); return values;
}
export function connectionError(c: Circuit, from: string, to: string, pin: number): string | null {
  const source = c.parts.find(p => p.id === from), target = c.parts.find(p => p.id === to);
  if (!source || !target) return 'Choose an existing source and destination.';
  if (source.kind === 'LED') return 'LEDs have no output pin.';
  if (!Number.isInteger(pin) || pin < 0 || pin >= inputCount(target.kind)) return 'Choose a valid input pin.';
  if (c.wires.some(w => w.to === to && w.pin === pin)) return 'This input already has a wire. Remove it before reconnecting.';
  const seen = new Set<string>();
  function reaches(id: string): boolean {
    if (id === from) return true; if (seen.has(id)) return false; seen.add(id);
    return c.wires.filter(w => w.from === id).some(w => reaches(w.to));
  }
  return reaches(to) ? 'Feedback loops are not supported. Connect a forward-only logic circuit.' : null;
}
export function positionError(c: Circuit, x: number, z: number, except?: string) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > BOARD_LIMITS.x || Math.abs(z) > BOARD_LIMITS.z) return 'Place the component inside the board.';
  if (c.parts.some(p => p.id !== except && Math.abs(p.x - x) < 2.6 && Math.abs(p.z - z) < 2)) return 'That space is occupied. Choose a clear spot.';
  return null;
}
export function validateCircuit(value: unknown): Circuit {
  if (!value || typeof value !== 'object') throw new Error('This is not a circuit file.');
  const c = value as Circuit;
  if (c.version !== 1 || typeof c.name !== 'string' || c.name.length > 80 || !Array.isArray(c.parts) || !Array.isArray(c.wires)) throw new Error('Unsupported circuit file. Expected version 1.');
  if (c.parts.length > 50 || c.wires.length > 100) throw new Error('Circuits support up to 50 components and 100 wires.');
  const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);
  const clean: Circuit = { version: 1, name: c.name, parts: [], wires: [] };
  for (const p of c.parts) {
    if (!p || !validId(p.id) || clean.parts.some(q => q.id === p.id) || !TYPES.includes(p.kind) || typeof p.label !== 'string' || p.label.length > 40) throw new Error('Invalid or duplicate component.');
    if (p.kind === 'INPUT' && p.value !== 0 && p.value !== 1) throw new Error('Input values must be 0 or 1.');
    const error = positionError(clean, p.x, p.z); if (error) throw new Error(error);
    clean.parts.push({ id: p.id, kind: p.kind, label: p.label, x: p.x, z: p.z, ...(p.kind === 'INPUT' ? { value: p.value } : {}) });
  }
  for (const w of c.wires) {
    if (!w || !validId(w.id) || clean.wires.some(q => q.id === w.id) || clean.parts.some(p => p.id === w.id)) throw new Error('Invalid or duplicate wire.');
    const error = connectionError(clean, w.from, w.to, w.pin); if (error) throw new Error(error);
    clean.wires.push({ id: w.id, from: w.from, to: w.to, pin: w.pin });
  }
  return clean;
}
export function removePart(c: Circuit, id: string): Circuit {
  return { ...c, parts: c.parts.filter(p => p.id !== id), wires: c.wires.filter(w => w.from !== id && w.to !== id) };
}
export type History = { past: Circuit[]; present: Circuit; future: Circuit[] };
export function historyStep(h: History, action: Circuit | 'undo' | 'redo'): History {
  if (action === 'undo') return h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h;
  if (action === 'redo') return h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h;
  return { past: [...h.past.slice(-49), h.present], present: action, future: [] };
}
export type Preset = 'ripple' | 'half' | 'basic' | 'full' | 'empty';
export function preset(which: Preset): Circuit {
  const parts: Part[] = [], wires: Wire[] = [];
  const add = (id: string, kind: Kind, label: string, x: number, z: number, value: 0 | 1 = 0) => parts.push({ id, kind, label, x, z, ...(kind === 'INPUT' ? { value } : {}) });
  const wire = (from: string, to: string, pin = 0) => wires.push({ id: `w${wires.length}`, from, to, pin });
  if (which === 'ripple') {
    add('cin', 'INPUT', 'Carry in', -0.5, -11, 0);
    for (let bit = 0; bit < 4; bit++) {
      const z = -8 + bit * 5, carryIn = bit === 0 ? 'cin' : `c${bit - 1}`;
      add(`a${bit}`, 'INPUT', `A${bit}`, -15, z - 0.7, ((11 >> bit) & 1) as 0 | 1);
      add(`b${bit}`, 'INPUT', `B${bit}`, -11, z - 0.7, ((6 >> bit) & 1) as 0 | 1);
      add(`p${bit}`, 'XOR', `Propagate ${bit}`, -6, z - 0.7);
      add(`g${bit}`, 'AND', `Generate ${bit}`, -6, z + 1.5);
      add(`s${bit}`, 'XOR', `Sum gate ${bit}`, -0.5, z - 0.7);
      add(`t${bit}`, 'AND', `Carry gate ${bit}`, -0.5, z + 1.5);
      add(`c${bit}`, 'OR', `Carry ${bit + 1}`, 4, z + 1.5);
      add(`out${bit}`, 'LED', `S${bit}`, 10, z - 0.7);
      wire(`a${bit}`, `p${bit}`); wire(`b${bit}`, `p${bit}`, 1);
      wire(`a${bit}`, `g${bit}`); wire(`b${bit}`, `g${bit}`, 1);
      wire(`p${bit}`, `s${bit}`); wire(carryIn, `s${bit}`, 1);
      wire(`p${bit}`, `t${bit}`); wire(carryIn, `t${bit}`, 1);
      wire(`g${bit}`, `c${bit}`); wire(`t${bit}`, `c${bit}`, 1);
      wire(`s${bit}`, `out${bit}`);
    }
    add('cout', 'LED', 'Carry out', 10, 8.5); wire('c3', 'cout');
  } else if (which === 'half' || which === 'basic') {
    add('a', 'INPUT', 'Input A', -7, -3, 1); add('b', 'INPUT', 'Input B', -7, 3, 0);
    add('sum-gate', which === 'half' ? 'XOR' : 'OR', which === 'half' ? 'XOR' : 'OR', 0, -3);
    add('carry-gate', 'AND', 'AND', 0, 3); add('sum', 'LED', which === 'half' ? 'Sum' : 'OR output', 7, -3); add('carry', 'LED', which === 'half' ? 'Carry' : 'AND output', 7, 3);
    wire('a', 'sum-gate'); wire('b', 'sum-gate', 1); wire('a', 'carry-gate'); wire('b', 'carry-gate', 1); wire('sum-gate', 'sum'); wire('carry-gate', 'carry');
  } else if (which === 'full') {
    add('a', 'INPUT', 'Input A', -9, -4, 1); add('b', 'INPUT', 'Input B', -9, 0); add('cin', 'INPUT', 'Carry in', -9, 4, 1);
    add('xor1', 'XOR', 'XOR 1', -4, -3); add('and1', 'AND', 'AND 1', -4, 3);
    add('xor2', 'XOR', 'XOR 2', 1, -3); add('and2', 'AND', 'AND 2', 1, 3); add('or', 'OR', 'OR', 5, 3);
    add('sum', 'LED', 'Sum', 8.5, -3); add('carry', 'LED', 'Carry', 8.5, 3);
    wire('a', 'xor1'); wire('b', 'xor1', 1); wire('a', 'and1'); wire('b', 'and1', 1); wire('xor1', 'xor2'); wire('cin', 'xor2', 1);
    wire('xor1', 'and2'); wire('cin', 'and2', 1); wire('and1', 'or'); wire('and2', 'or', 1); wire('xor2', 'sum'); wire('or', 'carry');
  }
  return { version: 1, name: ({ ripple: '4-bit ripple-carry adder', half: 'Half-adder', basic: 'Basic gates', full: 'Full-adder', empty: 'Untitled circuit' })[which], parts, wires };
}
export function pinPosition(p: Part, direction: 'in' | 'out', index = 0): [number, number, number] {
  return [p.x + (direction === 'out' ? 1.45 : -1.45), 0.24, p.z + (direction === 'in' && inputCount(p.kind) === 2 ? (index === 0 ? -0.48 : 0.48) : 0)];
}
