'use client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { evaluate, preset, validateCircuit, type Circuit, type Kind, type Preset } from '@/lib/circuit';
import { createCircuitStore, readSaved, saveCircuit, type CircuitEdit } from '@/lib/circuit-store';
import { browserModelContext, registerCircuitTools } from '@/lib/webmcp';

export function useCircuitLab() {
  const [store] = useState(() => createCircuitStore());
  const history = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot), circuit = history.present;
  const values = useMemo(() => evaluate(circuit), [circuit]);
  const [mode, setMode] = useState<'3d' | 'edit'>('3d');
  const [navigation, setNavigation] = useState<'orbit' | 'pan'>('orbit');
  const [cameraCommand, setCameraCommand] = useState<{ tick: number; action: 'in' | 'out' | 'left' | 'right' | 'up' | 'down' | 'focus' } | null>(null);
  const moveCamera = (action: NonNullable<typeof cameraCommand>['action']) => setCameraCommand(c => ({ tick: (c?.tick ?? 0) + 1, action }));
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [placing, setPlacing] = useState<Kind | null>(null), [moving, setMoving] = useState(false);
  const [reset, setReset] = useState(0), [motion, setMotion] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Loading local circuit…');
  const [notice, setNotice] = useState('Toggle an input to follow the signal.');
  const [isError, setIsError] = useState(false);
  const [replacement, setReplacement] = useState<Circuit | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = readSaved(localStorage);
      // Upgrade only an untouched starter. Designed circuits remain in place.
      const pristineStarter = saved && JSON.stringify(saved) === JSON.stringify(preset('half'));
      if (saved && !pristineStarter) store.restore(saved);
      setSaveStatus(saved && !pristineStarter ? 'Saved in this browser' : 'Ready to save locally');
    }
    catch { setSaveStatus('Local save unavailable'); setNotice('Your saved circuit could not be loaded. You can keep editing and export a file.'); setIsError(true); }
    setReady(true);
    return store.subscribe(() => {
      let saved = false; try { saved = saveCircuit(localStorage, store.getSnapshot().present); } catch { /* Browser storage may be blocked. */ }
      setSaveStatus(saved ? 'Saved in this browser' : 'Not saved · export a file');
    });
  }, [store]);
  useEffect(() => { const query = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setMotion(!query.matches); update(); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  useEffect(() => registerCircuitTools(browserModelContext(), store, () => console.warn('Circuit agent tools are unavailable in this browser.')), [store]);
  function message(text: string, error = false) { setNotice(text); setIsError(error); }
  function run(action: () => void, success?: string) {
    try { action(); if (success) message(success); return true; }
    catch (error) { message(error instanceof Error ? error.message : 'That change could not be applied.', true); return false; }
  }
  function edit(edits: CircuitEdit[], success?: string) { return run(() => { store.edit(edits); }, success); }
  function cancel() { setPlacing(null); setMoving(false); setPending(null); }
  function undo() { store.undo(); cancel(); message('Undid the last change.'); }
  function redo() { store.redo(); cancel(); message('Restored the next change.'); }
  function toggle(id: string) { const p = store.getSnapshot().present.parts.find(p => p.id === id); if (p?.kind === 'INPUT') edit([{ action: 'set_input', id, value: p.value === 1 ? 0 : 1 }], `${p.label} is now ${p.value === 1 ? 0 : 1}.`); }
  function startPlacing(kind: Kind) { cancel(); setMode('edit'); setNavigation('orbit'); setPlacing(kind); message(`Choose a clear spot for ${kind === 'INPUT' ? 'an input switch' : kind === 'LED' ? 'an LED' : `an ${kind} gate`}.`); }
  function place(x: number, z: number) {
    if (moving && selected) { if (edit([{ action: 'move', id: selected, x, z }], 'Component moved.')) cancel(); }
    else if (placing) run(() => { const result = store.edit([{ action: 'add', kind: placing, x, z }]); setSelected(result.added[0]); cancel(); message('Component added. Connect its pins to start the signal.'); });
  }
  function select(id: string | null) { setSelected(id); setMoving(false); }
  function pin(id: string, direction: 'in' | 'out', index: number) {
    if (direction === 'out') { cancel(); setPending(id); message('Now choose an input pin on the left side of a component.'); }
    else if (!pending) message('Choose an output pin on the right side of a component first.', true);
    else if (edit([{ action: 'connect', from: pending, to: id, pin: index }], 'Connection added.')) setPending(null);
  }
  function remove(id: string) { if (edit([{ action: 'remove', id }], 'Removed. Use Undo to bring it back.')) { setSelected(null); cancel(); } }
  function replace(c: Circuit) { store.replace(c); setSelected(null); cancel(); setReset(v => v + 1); setReplacement(null); message(`${c.name} loaded.`); }
  function requestReplace(c: Circuit) { if (store.hasEdits()) setReplacement(c); else replace(c); }
  function loadPreset(key: Preset) { requestReplace(preset(key)); }
  async function importFile(file: File) {
    if (file.size > 128_000) { message('Choose a circuit JSON file smaller than 128 KB.', true); return; }
    try { const next = validateCircuit(JSON.parse(await file.text())); requestReplace(next); }
    catch (error) { message(error instanceof SyntaxError ? 'This file is not valid JSON.' : error instanceof Error ? error.message : 'Could not read this file.', true); }
  }
  function exportFile() {
    run(() => { const url = URL.createObjectURL(new Blob([JSON.stringify(circuit, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `${circuit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'circuit'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, 'Circuit exported as a JSON file.');
  }
  useEffect(() => {
    function keydown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable="true"],[role="combobox"],[role="dialog"],[role="alertdialog"]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Escape') { cancel(); message('Selection tool ready.'); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); remove(selected); }
    }
    document.addEventListener('keydown', keydown); return () => document.removeEventListener('keydown', keydown);
  });
  return { circuit, values, history, ready, mode, setMode, navigation, setNavigation, cameraCommand, moveCamera, selected, select, pending, placing, moving, reset, resetCamera: () => setReset(v => v + 1), motion, setMotion, saveStatus, notice, isError, replacement, setReplacement, replace, loadPreset, importFile, exportFile, edit, undo, redo, toggle, startPlacing, place, pin, remove, cancel,
    startMoving: () => { if (selected) { cancel(); setMoving(true); setMode('edit'); setNavigation('orbit'); message('Click a clear spot to move this component. You can also drag gates directly in Top-down Edit mode.'); } },
  };
}
export type Lab = ReturnType<typeof useCircuitLab>;
