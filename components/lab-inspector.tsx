'use client';
import { useState } from 'react';
import { ChevronDown, Move, PlugZap, Trash2, X, Zap, Focus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { descriptions, inputCount, signalText, BOARD_LIMITS, type Part } from '@/lib/circuit';
import type { Lab } from '@/hooks/use-circuit-lab';

export function Choice({ label, value, options, onChange, placeholder = 'Choose…' }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder?: string }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger className="lab-select" aria-label={label}><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}
export default function LabInspector({ lab }: { lab: Lab }) {
  const { circuit, values } = lab;
  const selected = circuit.parts.find(p => p.id === lab.selected), wire = circuit.wires.find(w => w.id === lab.selected);
  const isRipple = ['a0','a1','a2','a3','b0','b1','b2','b3','cin','out0','out1','out2','out3','cout'].every(id => circuit.parts.some(p => p.id === id));
  const inputs = circuit.parts.filter(p => p.kind === 'INPUT'), outputs = circuit.parts.filter(p => p.kind === 'LED');
  return <aside className="inspector"><div className="panel-title"><h2>Live signals</h2><Zap size={15} /></div><p className="panel-intro">Try changing an input.</p>
    {isRipple ? <RippleSignals lab={lab} /> : <>    <div className="signal-group"><h3>Inputs</h3>{!inputs.length && <p className="empty-hint">Add a switch to power your circuit.</p>}{inputs.map(p => <div className="signal-row" key={p.id}><button className="signal-name" onClick={() => lab.select(p.id)}>{p.label}</button><span className={`signal-value v${values[p.id]}`} aria-label={`${p.label} value ${signalText(values[p.id])}`}>{signalText(values[p.id])}</span><Switch checked={p.value === 1} onCheckedChange={() => lab.toggle(p.id)} aria-label={`Toggle ${p.label}`} /></div>)}</div>
    <div className="signal-group"><h3>Outputs</h3>{!outputs.length && <p className="empty-hint">Add an LED to see the result.</p>}{outputs.map(p => <div className="signal-row" key={p.id}><span className={`led-indicator v${values[p.id]}`} /><button className="signal-name" onClick={() => lab.select(p.id)}>{p.label}</button><output className={`signal-value v${values[p.id]}`} aria-label={`${p.label} value ${signalText(values[p.id])}`}>{signalText(values[p.id])}</output></div>)}</div>
</>}
    <div className="inspector-divider" />
    <Choice label="Inspect a component" value={selected?.id ?? ''} placeholder="Inspect a component" options={circuit.parts.map(p => ({ value: p.id, label: `${p.label} · ${p.kind}` }))} onChange={lab.select} />
    {selected ? <PartEditor key={`${selected.id}:${selected.x}:${selected.z}:${selected.label}`} part={selected} lab={lab} /> : wire ? <div className="part-editor"><span className="small-label">Selected connection</span><p className="circuit-description">{circuit.parts.find(p => p.id === wire.from)?.label} → {circuit.parts.find(p => p.id === wire.to)?.label}, input {wire.pin + 1}</p><button className="danger-button" onClick={() => lab.remove(wire.id)}><Trash2 size={14} />Remove wire</button></div> : <div className="circuit-explainer"><span className="small-label">Inside this circuit</span><h2 className="circuit-title">{isRipple ? 'Four stages. One carry chain.' : circuit.name === 'Half-adder' ? 'One bit. Two answers.' : circuit.name === 'Full-adder' ? 'Make room for the carry.' : 'Follow the logic.'}</h2><p className="circuit-description">{isRipple ? 'Each stage adds A, B, and the previous carry. Watch the carry travel from bit 0 to bit 3. Click a chip to trace its connections.' : circuit.name === 'Half-adder' ? 'A half-adder adds two binary inputs. XOR gives you the sum. AND gives you the carry.' : circuit.name === 'Full-adder' ? 'Add two bits and a carry-in. The sum is the low bit; carry is the high bit.' : 'Add components from the palette, then connect an output pin to an input pin. Changes update instantly.'}</p>{circuit.name === 'Half-adder' && <div className="formula">Sum = A ⊕ B<br />Carry = A · B</div>}</div>}
    <ConnectionEditor lab={lab} />
    <div className="inspector-bottom"><span className="signal-key"><i />Logic 1</span><span className="signal-key low"><i />Logic 0</span><span className="signal-key">? Unknown</span></div>
  </aside>;
}
function PartEditor({ part: p, lab }: { part: Part; lab: Lab }) {
  const [label, setLabel] = useState(p.label), [x, setX] = useState(String(p.x)), [z, setZ] = useState(String(p.z));
  return <div className="part-editor"><div className="selected-heading"><span className="small-label">Selected · {p.kind}</span><span className={`signal-value v${lab.values[p.id]}`}>{signalText(lab.values[p.id])}</span></div><p className="circuit-description">{descriptions[p.kind]}</p>
    <form onSubmit={e => { e.preventDefault(); lab.edit([{ action: 'rename', id: p.id, label }], 'Component renamed.'); }}><label className="field-label" htmlFor="part-label">Label</label><div className="inline-field"><input id="part-label" maxLength={40} value={label} onChange={e => setLabel(e.target.value)} /><button type="submit" className="small-button">Set</button></div></form>
    <div className="part-actions"><button className="small-button" onClick={()=>lab.moveCamera('focus')}><Focus size={13}/>Focus</button><button className={`small-button ${lab.moving ? 'active' : ''}`} onClick={lab.startMoving}><Move size={13} />Move</button><button className="danger-button" onClick={() => lab.remove(p.id)}><Trash2 size={13} />Delete</button></div>
    <details className="coordinate-details"><summary>Position <ChevronDown size={12} /></summary><form className="position-form" onSubmit={e => { e.preventDefault(); lab.edit([{ action: 'move', id: p.id, x: Number(x), z: Number(z) }], 'Position updated.'); }}><label>X<input type="number" min={-BOARD_LIMITS.x} max={BOARD_LIMITS.x} step="0.5" required value={x} onChange={e => setX(e.target.value)} /></label><label>Z<input type="number" min={-BOARD_LIMITS.z} max={BOARD_LIMITS.z} step="0.5" required value={z} onChange={e => setZ(e.target.value)} /></label><button className="small-button" type="submit">Move</button></form><p className="empty-hint">Current: {p.x}, {p.z}</p></details>
    <div className="related-connections"><h3>Connected components</h3>{lab.circuit.wires.filter(w=>w.from===p.id || w.to===p.id).map(w=><button key={w.id} onClick={()=>lab.select(w.id)}><span>{w.from===p.id ? 'Out →' : '← In '+(w.pin+1)}</span><strong>{lab.circuit.parts.find(q=>q.id===(w.from===p.id?w.to:w.from))?.label}</strong><span>{signalText(lab.values[w.from])}</span></button>)}</div>
    <div className="pin-readout">{Array.from({ length: inputCount(p.kind) }, (_, pin) => { const wire = lab.circuit.wires.find(w => w.to === p.id && w.pin === pin); return <div key={pin}><span>In {pin + 1}</span><span>{wire ? signalText(lab.values[wire.from]) : '? Unconnected'}</span>{wire && <button onClick={() => lab.remove(wire.id)} aria-label={`Disconnect input ${pin + 1}`}><X size={13} /></button>}</div>; })}</div>
  </div>;
}
function ConnectionEditor({ lab }: { lab: Lab }) {
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const sources = lab.circuit.parts.filter(p => p.kind !== 'LED'), targets = lab.circuit.parts.flatMap(p => Array.from({ length: inputCount(p.kind) }, (_, pin) => ({ value: `${p.id}:${pin}`, label: `${p.label} · in ${pin + 1}` })));
  const validFrom = sources.some(p => p.id === from) ? from : '', validTo = targets.some(p => p.value === to) ? to : '';
  return <details className="connection-editor"><summary><PlugZap size={14} />Wire connections<ChevronDown size={12} /></summary><p className="empty-hint">Use these controls or click the board’s pins.</p><label className="field-label">From output</label><Choice label="Wire source" value={validFrom} options={sources.map(p => ({ value: p.id, label: p.label }))} onChange={setFrom} /><label className="field-label">To input</label><Choice label="Wire destination" value={validTo} options={targets} onChange={setTo} /><button className="primary-button connect-button" disabled={!validFrom || !validTo} onClick={() => { const [id, pin] = to.split(':'); if (lab.edit([{ action: 'connect', from, to: id, pin: Number(pin) }], 'Connection added.')) setTo(''); }}><PlusWire />Connect pins</button>
    {lab.circuit.wires.length > 0 && <div className="wire-list">{lab.circuit.wires.map(w => <div key={w.id}><button onClick={() => lab.select(w.id)}>{lab.circuit.parts.find(p => p.id === w.from)?.label} → {lab.circuit.parts.find(p => p.id === w.to)?.label} / {w.pin + 1}</button><button onClick={() => lab.remove(w.id)} aria-label={`Remove wire from ${lab.circuit.parts.find(p => p.id === w.from)?.label} to ${lab.circuit.parts.find(p => p.id === w.to)?.label} input ${w.pin + 1}`}><X size={13} /></button></div>)}</div>}
  </details>;
}
function PlusWire() { return <PlugZap size={14} />; }
function RippleSignals({ lab }: { lab: Lab }) {
  const bits = [3,2,1,0];
  const number = (prefix: string) => bits.reduce((n,bit)=>n + (lab.values[prefix+bit] === 1 ? 2 ** bit : 0),0);
  const unknown = ['out0','out1','out2','out3','cout'].some(id=>lab.values[id] == null);
  const result = number('out') + (lab.values.cout === 1 ? 16 : 0);
  return <div className="ripple-signals">
    {['a','b'].map(prefix=><div className="bus-group" key={prefix}><div className="bus-heading"><h3>Word {prefix.toUpperCase()}</h3><span>{number(prefix)} <small>decimal</small></span></div><div className="bit-bank">{bits.map(bit=><label key={bit} className={'bit-control v'+lab.values[prefix+bit]}><span>{prefix.toUpperCase()}{bit}</span><Switch checked={lab.values[prefix+bit]===1} onCheckedChange={()=>lab.toggle(prefix+bit)} aria-label={'Toggle '+prefix.toUpperCase()+bit}/><strong>{signalText(lab.values[prefix+bit])}</strong></label>)}</div></div>)}
    <div className="signal-row carry-switch"><span>Carry in</span><span className={'signal-value v'+lab.values.cin}>{signalText(lab.values.cin)}</span><Switch checked={lab.values.cin===1} onCheckedChange={()=>lab.toggle('cin')} aria-label="Toggle carry in"/></div>
    <div className="result-display"><div className="result-heading"><span>Result</span><strong>{unknown ? '?' : result}<small>decimal</small></strong></div><div className="output-bank">{['cout','out3','out2','out1','out0'].map((id,i)=><button className={'output-bit v'+lab.values[id]} key={id} onClick={()=>lab.select(id)} aria-label={'Inspect '+(i===0?'carry out':'sum '+(4-i))}><span>{i===0?'Cout':'S'+(4-i)}</span><strong>{signalText(lab.values[id])}</strong></button>)}</div><p>{unknown ? 'An input is unconnected' : number('a')+' + '+number('b')+' + '+signalText(lab.values.cin)+' → '+result}</p></div>
  </div>;
}
