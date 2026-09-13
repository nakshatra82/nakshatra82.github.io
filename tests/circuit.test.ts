import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectionError, evaluate, gate, preset, validateCircuit, type Kind, type Signal } from '../lib/circuit';
import { createCircuitStore, readSaved, saveCircuit } from '../lib/circuit-store';
import { routeWires } from '../lib/wire-routing';
import { registerCircuitTools, type RegisteredTool } from '../lib/webmcp';

test('all gate truth tables', () => {
  const tables: Partial<Record<Kind, number[]>> = { AND: [0,0,0,1], OR: [0,1,1,1], XOR: [0,1,1,0], NAND: [1,1,1,0], NOR: [1,0,0,0], XNOR: [1,0,0,1] };
  for (const [kind, expected] of Object.entries(tables)) for (let n = 0; n < 4; n++) assert.equal(gate(kind as Kind, [(n >> 1) as Signal, (n & 1) as Signal]), expected[n], `${kind} ${n}`);
  assert.equal(gate('NOT', [0]), 1); assert.equal(gate('NOT', [1]), 0);
});
test('half-adder and full-adder have correct sums for every input combination', () => {
  for (const key of ['half','full'] as const) {
    const c = validateCircuit(preset(key)), inputs = c.parts.filter(p => p.kind === 'INPUT');
    for (let n = 0; n < 2 ** inputs.length; n++) {
      inputs.forEach((p, i) => { p.value = ((n >> i) & 1) as 0 | 1; });
      const total = inputs.reduce((sum, p) => sum + (p.value ?? 0), 0), values = evaluate(c);
      assert.equal(values.sum, total % 2); assert.equal(values.carry, Math.floor(total / 2));
    }
  }
});
test('all presets validate and fan-out carries the same source value', () => {
  for (const key of ['ripple','half','full','basic','empty'] as const) assert.deepEqual(validateCircuit(preset(key)), preset(key));
  const c = preset('basic'), v = evaluate(c); assert.equal(v['sum-gate'], 1); assert.equal(v['carry-gate'], 0);
});
test('unknown inputs propagate conservatively', () => {
  for (const kind of ['NOT','XOR','XNOR','LED'] as Kind[]) assert.equal(gate(kind, [null, 1]), null);
  assert.equal(gate('AND', [0,null]), 0); assert.equal(gate('AND', [1,null]), null);
  assert.equal(gate('OR', [1,null]), 1); assert.equal(gate('OR', [0,null]), null);
  assert.equal(gate('NAND', [0,null]), 1); assert.equal(gate('NOR', [1,null]), 0);
  const c = preset('half'); c.wires = c.wires.filter(w => w.from !== 'a'); assert.equal(evaluate(c).sum, null);
});
test('invalid directions, duplicate drivers and cycles are rejected', () => {
  const c = preset('half'); assert.match(connectionError(c,'sum','a',0)!, /no output/); assert.match(connectionError(c,'a','sum-gate',0)!, /already/);
  assert.match(connectionError(c,'a','b',0)!, /valid input/);
  c.wires = []; c.wires.push({ id: 'one', from: 'sum-gate', to: 'carry-gate', pin: 0 });
  assert.match(connectionError(c,'carry-gate','sum-gate',0)!, /Feedback/);
  assert.match(connectionError(c,'sum-gate','sum-gate',0)!, /Feedback/);
});
test('deletion removes incident wires and undo/redo restores the whole edit', () => {
  const store = createCircuitStore(preset('half')); store.edit([{ action:'remove', id:'sum-gate' }]);
  assert.equal(store.getSnapshot().present.parts.length, 5); assert.equal(store.getSnapshot().present.wires.length, 3);
  store.undo(); assert.deepEqual(store.getSnapshot().present, preset('half'));
  store.redo(); assert.equal(store.getSnapshot().present.parts.length, 5);
  store.undo(); store.edit([{ action:'set_input',id:'a',value:0 }]); assert.equal(store.getSnapshot().future.length,0);
});
test('moves, adds, rename and atomic batches validate without corrupting the circuit', () => {
  const store = createCircuitStore(preset('empty'));
  const { added } = store.edit([{ action:'add',kind:'INPUT',x:-6,z:0 }, { action:'add',kind:'LED',x:6,z:0 }]);
  store.edit([{ action:'connect',from:added[0],to:added[1],pin:0 }, { action:'set_input',id:added[0],value:1 }]);
  assert.equal(evaluate(store.getSnapshot().present)[added[1]],1);
  store.edit([{ action:'move',id:added[0],x:-5,z:1 },{ action:'rename',id:added[0],label:'A' }]);
  const before = store.getSnapshot();
  assert.throws(() => store.edit([{ action:'rename',id:added[0],label:'changed' },{ action:'move',id:added[0],x:6,z:0 }]), /occupied/);
  assert.equal(store.getSnapshot(), before);
  assert.throws(() => store.edit([{ action:'move',id:added[0],x:Infinity,z:0 }]), /inside/);
});
test('preset replacement is undoable and tracks edited state', () => {
  const store = createCircuitStore(preset('half')); assert.equal(store.hasEdits(),false);
  store.edit([{ action:'set_input',id:'a',value:0 }]); assert.equal(store.hasEdits(),true);
  store.replace(preset('full')); assert.equal(store.hasEdits(),false);
  store.undo(); assert.equal(store.getSnapshot().present.name,'Half-adder'); assert.equal(evaluate(store.getSnapshot().present).sum,0);
});
test('JSON export/import and persistence round trip', () => {
  const c = preset('full'), map = new Map<string,string>();
  const storage = { getItem: (k:string) => map.get(k) ?? null, setItem: (k:string,v:string) => { map.set(k,v); } };
  assert.equal(readSaved(storage),null); assert.equal(saveCircuit(storage,c),true);
  assert.deepEqual(readSaved(storage),c); assert.deepEqual(validateCircuit(JSON.parse(JSON.stringify(c))),c);
  const store = createCircuitStore(preset('half')); store.restore(readSaved(storage)!); assert.deepEqual(store.getSnapshot().present,c);
});
test('malformed imports and unavailable storage leave editing usable', () => {
  const c = preset('half');
  assert.throws(() => validateCircuit(null)); assert.throws(() => validateCircuit({ ...c,version:2 }));
  assert.throws(() => validateCircuit({ ...c,parts:[...c.parts,c.parts[0]] }));
  assert.throws(() => validateCircuit({ ...c,wires:[...c.wires,{ id:'bad',from:'missing',to:'sum',pin:0 }] }));
  assert.throws(() => validateCircuit({ ...c,parts:[{ ...c.parts[0],id:'__proto__' }] }));
  assert.throws(() => readSaved({ getItem: () => '{broken' }));
  assert.equal(saveCircuit({ setItem: () => { throw new Error('Quota'); } },c),false);
  const store = createCircuitStore(c); store.edit([{action:'set_input',id:'b',value:1}]); assert.equal(evaluate(store.getSnapshot().present).carry,1);
});
test('agent tools share the same store and reject invalid edits atomically (contract unit test)', async () => {
  const tools = new Map<string,RegisteredTool>(), store = createCircuitStore(preset('half')); let signal: AbortSignal | undefined;
  const unregister = registerCircuitTools({ registerTool: (t,options) => { tools.set(t.name,t); signal = options.signal; } },store,()=>assert.fail());
  assert.deepEqual([...tools.keys()],['read_circuit','edit_circuit']);
  assert.equal(tools.get('read_circuit')!.annotations.readOnlyHint,true);
  const read = tools.get('read_circuit')!.execute({}) as { circuit: unknown }; assert.deepEqual(read.circuit,preset('half'));
  const before = store.getSnapshot();
  await assert.rejects(async () => tools.get('edit_circuit')!.execute({ edits:[{ action:'connect',from:'a',to:'sum-gate',pin:0 }] })); assert.equal(store.getSnapshot(),before);
  // A frame shim tests the contract only; this does not claim native browser WebMCP validation.
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = callback => { callback(0); return 0; };
  try { await tools.get('edit_circuit')!.execute({ edits:[{ action:'set_input',id:'b',value:1 }] }); assert.equal(evaluate(store.getSnapshot().present).carry,1); }
  finally { globalThis.requestAnimationFrame = original; unregister(); }
  assert.equal(signal?.aborted,true);
});
test('the default is a fully connected 34-component 4-bit ripple-carry adder', () => {
  const c = createCircuitStore().getSnapshot().present;
  assert.equal(c.name,'4-bit ripple-carry adder'); assert.equal(c.parts.length,34); assert.equal(c.wires.length,45);
  assert.ok(Object.values(evaluate(c)).every(v=>v!==null));
});
test('4-bit adder handles all 512 combinations including overflow and carry in', () => {
  const c = validateCircuit(preset('ripple'));
  for(let a=0;a<16;a++) for(let b=0;b<16;b++) for(const cin of [0,1] as const) {
    for(let i=0;i<4;i++){c.parts.find(p=>p.id==='a'+i)!.value=((a>>i)&1) as 0|1;c.parts.find(p=>p.id==='b'+i)!.value=((b>>i)&1) as 0|1;}
    c.parts.find(p=>p.id==='cin')!.value=cin;
    const values=evaluate(c), result=[0,1,2,3].reduce((v,bit)=>v+(values['out'+bit] as number)*2**bit,0)+(values.cout as number)*16;
    assert.equal(result,a+b+cin,a+' + '+b+' + '+cin);
  }
});
test('dense board routes avoid other chip bodies and preserve every pin endpoint', () => {
  const c=preset('ripple'), routes=routeWires(c);
  assert.equal(Object.keys(routes).length,45);
  for(const w of c.wires) {
    const points=routes[w.id];
    assert.ok(points.length>=2); assert.ok(points.every(p=>p.every(Number.isFinite)));
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])*10);
      for(let s=0;s<=steps;s++){
        const x=a[0]+(b[0]-a[0])*s/(steps||1),z=a[2]+(b[2]-a[2])*s/(steps||1);
        assert.equal(c.parts.some(p=>p.id!==w.from&&p.id!==w.to&&Math.abs(p.x-x)<1.08&&Math.abs(p.z-z)<.9),false,'wire '+w.id+' crosses a chip');
      }
    }
  }
});
test('moving a connected gate keeps the graph and signal values intact, and is undoable', () => {
  const store=createCircuitStore(), before=store.getSnapshot().present, values=evaluate(before);
  store.edit([{action:'move',id:'s0',x:1,z:-9}]);
  const after=store.getSnapshot().present; assert.deepEqual(after.wires,before.wires);assert.deepEqual(evaluate(after),values);
  assert.notDeepEqual(routeWires(after).w4,routeWires(before).w4);
  store.undo();assert.deepEqual(store.getSnapshot().present,before);
  assert.throws(()=>store.edit([{action:'move',id:'s0',x:-6,z:-8.7}]),/occupied/);assert.deepEqual(store.getSnapshot().present,before);
});
