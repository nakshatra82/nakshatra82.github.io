import { evaluate, historyStep, preset, removePart, STORAGE_KEY, validateCircuit, type Circuit, type History, type Kind } from './circuit';

export type CircuitEdit =
  | { action: 'add'; kind: Kind; x: number; z: number }
  | { action: 'move'; id: string; x: number; z: number }
  | { action: 'connect'; from: string; to: string; pin: number }
  | { action: 'remove'; id: string }
  | { action: 'set_input'; id: string; value: 0 | 1 }
  | { action: 'rename'; id: string; label: string };
export function createCircuitStore(initial: Circuit = preset('ripple')) {
  let history: History = { past: [], present: initial, future: [] };
  let baseline = JSON.stringify(initial);
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  function commit(next: Circuit) { history = historyStep(history, validateCircuit(next)); emit(); }
  function edit(edits: CircuitEdit[]) {
    if (!Array.isArray(edits) || edits.length < 1 || edits.length > 100) throw new Error('Provide between 1 and 100 edits.');
    let c = structuredClone(history.present);
    const added: string[] = [];
    for (const e of edits) {
      if (!e || typeof e !== 'object') throw new Error('Invalid circuit edit.');
      if (e.action === 'add') {
        const id = `p-${crypto.randomUUID()}`; added.push(id);
        c.parts.push({ id, kind: e.kind, label: e.kind === 'INPUT' ? `Input ${c.parts.filter(p => p.kind === 'INPUT').length + 1}` : e.kind === 'LED' ? `Output ${c.parts.filter(p => p.kind === 'LED').length + 1}` : e.kind, x: e.x, z: e.z, ...(e.kind === 'INPUT' ? { value: 0 as const } : {}) });
      } else if (e.action === 'connect') {
        c.wires.push({ id: `w-${crypto.randomUUID()}`, from: e.from, to: e.to, pin: e.pin });
      } else if (e.action === 'remove') {
        if (!c.parts.some(p => p.id === e.id) && !c.wires.some(w => w.id === e.id)) throw new Error('Component or wire no longer exists.');
        c = removePart(c, e.id); c.wires = c.wires.filter(w => w.id !== e.id);
      } else if (e.action === 'move' || e.action === 'set_input' || e.action === 'rename') {
        const p = c.parts.find(p => p.id === e.id); if (!p) throw new Error('Component no longer exists.');
        if (e.action === 'move') { p.x = e.x; p.z = e.z; }
        if (e.action === 'set_input') { if (p.kind !== 'INPUT') throw new Error('Only input switches can be toggled.'); p.value = e.value; }
        if (e.action === 'rename') p.label = e.label;
      } else throw new Error('Unknown circuit action.');
      c = validateCircuit(c);
    }
    commit(c); return { added, circuit: history.present, signals: evaluate(history.present) };
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => history,
    hasEdits: () => JSON.stringify(history.present) !== baseline,
    edit,
    replace(circuit: Circuit) { const c = validateCircuit(circuit); commit(c); baseline = JSON.stringify(c); },
    restore(circuit: Circuit) { const c = validateCircuit(circuit); history = { past: [], present: c, future: [] }; emit(); },
    undo() { history = historyStep(history, 'undo'); emit(); },
    redo() { history = historyStep(history, 'redo'); emit(); },
  };
}
export type CircuitStore = ReturnType<typeof createCircuitStore>;
export function readSaved(storage: Pick<Storage, 'getItem'>): Circuit | null {
  const raw = storage.getItem(STORAGE_KEY); return raw ? validateCircuit(JSON.parse(raw)) : null;
}
export function saveCircuit(storage: Pick<Storage, 'setItem'>, c: Circuit): boolean {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(c)); return true; } catch { return false; }
}
