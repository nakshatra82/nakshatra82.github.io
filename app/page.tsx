'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Cpu, Box, Grid2X2, ChevronDown, ArrowUpRight, Plus, CircleHelp, RotateCcw, CircuitBoard as BoardIcon, Undo2, Redo2, Power, Lightbulb, Download, Upload, X, Waves, Check, MousePointer2, Move, ZoomIn, ZoomOut, Maximize2, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Focus } from 'lucide-react';
import LabInspector from '@/components/lab-inspector';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCircuitLab } from '@/hooks/use-circuit-lab';
import { TYPES, descriptions, boardSize, type Kind, type Preset } from '@/lib/circuit';

const CircuitBoard = lazy(() => import('@/components/circuit-board'));

export default function Home() {
  const lab = useCircuitLab();
  const { circuit, values, mode } = lab;
  const fileInput = useRef<HTMLInputElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(true);
  useEffect(() => { setPaletteOpen(!matchMedia('(max-width: 520px)').matches); }, []);
  const placing = !!lab.placing || lab.moving;
  const [boardWidth, boardDepth] = boardSize(circuit);
  const selectedPart = circuit.parts.find(p => p.id === lab.selected);
  const connectedWires = circuit.wires.filter(w => w.from === lab.selected || w.to === lab.selected || w.id === lab.selected);
  return <main>
    <a href="#workspace" className="skip-link">Skip to circuit workspace</a>
    <header className="site-header">
      <a href="#lab" className="brand"><span className="brand-icon"><Cpu size={22} /></span><span>Nakshatra<span className="brand-divider">/</span><span className="brand-sub">Circuit Lab</span></span></a>
      <nav aria-label="Main navigation"><a href="#lab" className="nav-active">Playground</a><a href="#about">About me <ArrowUpRight size={13} /></a><a href="https://github.com/nakshatra82" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13} /></a></nav>
      <span className="version">An experiment in digital logic</span>
    </header>
    <section id="lab" className="lab-section">
      <div className="lab-heading">
        <picture className="masthead-art"><source media="(max-width: 600px)" srcSet="/assets/silicon-hero-mobile.webp" /><img src="/assets/silicon-hero.webp" width="1536" height="1024" alt="" fetchPriority="high" /></picture>
        <div className="masthead-copy"><div className="heading-kicker"><span className="tiny-rule" />Nakshatra’s digital workbench</div><h1>Where logic<br />becomes silicon.</h1><p>Design in three dimensions. Trace every connection.<br />Bring your next idea to life.</p></div>
        <div className="masthead-caption"><span>From a single gate</span><span>to something extraordinary.</span></div>
      </div>
      <div className="featured-circuit"><div><span className="feature-chip"><Cpu size={18} /></span><span><strong>4-bit ripple-carry adder</strong><small>34 components · 45 connections · A complete carry chain</small></span></div><button onClick={() => lab.loadPreset('ripple')} disabled={!lab.ready} className="demo-button">Load featured circuit <ArrowUpRight size={15} /></button></div>
      <div className="workspace" id="workspace" tabIndex={-1}>
        <div className="workspace-toolbar">
          <div className="project-name"><BoardIcon size={17} />
            <Select value="" onValueChange={v => lab.loadPreset(v as Preset)} disabled={!lab.ready}><SelectTrigger className="preset-trigger" aria-label="Load an example circuit"><span>{circuit.name}</span></SelectTrigger><SelectContent><SelectItem value="ripple">4-bit ripple-carry adder</SelectItem><SelectItem value="half">Half-adder</SelectItem><SelectItem value="basic">Basic gates</SelectItem><SelectItem value="full">Full-adder</SelectItem><SelectItem value="empty">Empty board</SelectItem></SelectContent></Select>
          </div>
          <div className="toolbar-actions">
            <span className="saved-text" title={lab.saveStatus}><Check size={12} />{lab.saveStatus.startsWith('Saved') ? 'Saved locally' : lab.saveStatus.startsWith('Ready') ? 'Local workspace' : lab.saveStatus}</span>
            <span className="toolbar-separator" />
            <button onClick={lab.undo} disabled={!lab.history.past.length} aria-label="Undo" title="Undo (⌘ / Ctrl Z)"><Undo2 size={17} /></button>
            <button onClick={lab.redo} disabled={!lab.history.future.length} aria-label="Redo" title="Redo (⌘ / Ctrl Shift Z)"><Redo2 size={17} /></button>
            <span className="toolbar-separator" />
            <button onClick={() => fileInput.current?.click()} disabled={!lab.ready} aria-label="Import circuit JSON" title="Import circuit"><Upload size={16} /></button>
            <button onClick={lab.exportFile} disabled={!lab.ready} aria-label="Export circuit JSON" title="Export circuit"><Download size={16} /></button>
            <button onClick={() => lab.loadPreset('empty')} disabled={!lab.ready} className="new-button" aria-label="New empty circuit" title="New circuit"><Plus size={15} /><span>New</span></button>
            <input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Import circuit file" onChange={e => { const file = e.target.files?.[0]; if (file) void lab.importFile(file); e.target.value = ''; }} />
          </div>
        </div>
        <div className="workspace-main">
          <Collapsible open={paletteOpen} onOpenChange={setPaletteOpen} className="component-panel">
            <div className="panel-title"><h2>Components</h2><span className="component-count">9</span><CollapsibleTrigger className="palette-toggle" aria-label="Toggle component palette"><ChevronDown size={16} /></CollapsibleTrigger></div>
            <CollapsibleContent forceMount className="palette-content"><p className="panel-intro">The building blocks of logic.</p><h3>Inputs & outputs</h3><div className="component-list">{TYPES.slice(0, 2).map(k => <ComponentButton key={k} kind={k} active={lab.placing === k} disabled={!lab.ready} onClick={() => lab.startPlacing(k)} />)}</div><h3>Logic gates</h3><div className="component-list">{TYPES.slice(2).map(k => <ComponentButton key={k} kind={k} active={lab.placing === k} disabled={!lab.ready} onClick={() => lab.startPlacing(k)} />)}</div></CollapsibleContent>
            <div className="palette-foot"><Help /><span>Start with a switch.<br />Follow the signal.</span></div>
          </Collapsible>
          <div className={'viewport' + (placing ? ' is-placing' : '')} aria-label="Interactive circuit board. Arrow keys move the camera; plus and minus zoom." tabIndex={0} onKeyDown={e => { if(e.target !== e.currentTarget) return; const actions = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down','+':'in','=':'in','-':'out'} as const; const action = actions[e.key as keyof typeof actions]; if(action){e.preventDefault();lab.moveCamera(action);} }}>
            <div className="viewport-top"><Tabs value={mode} onValueChange={v => { lab.setMode(v as typeof mode); lab.setNavigation('orbit'); lab.cancel(); }}><TabsList className="view-tabs"><TabsTrigger value="3d"><Box />3D view</TabsTrigger><TabsTrigger value="edit"><Grid2X2 />Top-down</TabsTrigger></TabsList></Tabs><span className="live-label"><span className="live-dot" />Live simulation</span></div>
            <Suspense fallback={<div className="board-loading"><span className="loading-chip">N</span><p>Preparing the circuit board…</p></div>}><CircuitBoard circuit={circuit} values={values} mode={mode} selected={lab.selected} pending={lab.pending} reset={lab.reset} navigation={lab.navigation} cameraCommand={lab.cameraCommand} motion={lab.motion} placing={placing} onSelect={lab.select} onToggle={lab.toggle} onPin={lab.pin} onMove={(id,x,z)=>lab.edit([{action:'move',id,x,z}],'Gate moved. Its connections moved with it.')} onPlace={lab.place} onWire={lab.select} /></Suspense>
            {(placing || lab.pending) && <div className="placement-banner"><MousePointer2 size={14} /><span>{lab.pending ? 'Click a destination input pin' : lab.moving ? 'Click to move the component' : 'Click to place ' + lab.placing}</span><button onClick={lab.cancel} aria-label="Cancel placement or wiring"><X size={14} /></button>{placing && <button className="auto-place" onClick={() => { for (let z = -boardDepth/2+2; z <= boardDepth/2-2; z += 2.5) for (let x = -boardWidth/2+2; x <= boardWidth/2-2; x += 3.5) { if (!circuit.parts.some(p => p.id !== (lab.moving ? lab.selected : null) && Math.abs(p.x - x) < 2.6 && Math.abs(p.z - z) < 2)) { lab.place(x, z); return; } } lab.place(0, 0); }}>Find a spot</button>}</div>}
            {!circuit.parts.length && !placing && <div className="empty-board-message"><h2>Your next idea starts here.</h2><p>Add an input switch, a gate, and an LED.</p><button className="primary-button" onClick={() => { setPaletteOpen(true); lab.startPlacing('INPUT'); }}><Plus size={15} />Add a switch</button></div>}
            <div className="navigation-dock" aria-label="Camera controls">
              <div className="navigation-modes"><button className={lab.navigation==='orbit' ? 'active' : ''} onClick={()=>lab.setNavigation('orbit')} aria-pressed={lab.navigation==='orbit'} aria-label={mode==='edit'?'Edit: drag gates to move them':'Orbit: drag to rotate the board'} title={mode==='edit'?'Drag gates to move them':'Drag to rotate the board'}>{mode==='edit'?<MousePointer2 size={15}/>:<RotateCcw size={15}/>}<span>{mode==='edit'?'Edit':'Orbit'}</span></button><button className={lab.navigation==='pan' ? 'active' : ''} onClick={()=>lab.setNavigation('pan')} aria-pressed={lab.navigation==='pan'} aria-label="Pan: drag to move across the board" title="Drag to move across the board"><Move size={15}/><span>Pan</span></button></div>
              <span className="dock-divider"/><button onClick={()=>lab.moveCamera('out')} aria-label="Zoom out" title="Zoom out"><ZoomOut size={17}/></button><button onClick={()=>lab.moveCamera('in')} aria-label="Zoom in" title="Zoom in"><ZoomIn size={17}/></button><button onClick={lab.resetCamera} aria-label="Fit whole board" title="Fit whole board"><Maximize2 size={16}/></button>
              <span className="dock-divider"/><button onClick={()=>lab.moveCamera('left')} aria-label="Move camera left"><ArrowLeft size={16}/></button><button onClick={()=>lab.moveCamera('up')} aria-label="Move camera up"><ArrowUp size={16}/></button><button onClick={()=>lab.moveCamera('down')} aria-label="Move camera down"><ArrowDown size={16}/></button><button onClick={()=>lab.moveCamera('right')} aria-label="Move camera right"><ArrowRight size={16}/></button>
              <button onClick={()=>lab.moveCamera('focus')} disabled={!selectedPart} aria-label="Focus selected component" title="Focus selected chip"><Focus size={16}/></button>
            </div>
            {lab.selected && <div className="connection-focus"><span><strong>{selectedPart?.label || 'Connection'}</strong> · {connectedWires.length} {connectedWires.length === 1 ? 'wire' : 'wires'} highlighted</span>{selectedPart && <button className="move-selected" onClick={lab.startMoving}><Move size={13}/>Move</button>}<button onClick={()=>lab.select(null)} aria-label="Show all connections"><X size={14}/></button></div>}
            <div className="viewport-bottom"><span>{lab.navigation==='pan' ? 'Drag to pan · Pinch or scroll to zoom' : mode==='edit' ? 'Drag a gate to move · Drag empty space to pan' : 'Drag to orbit · Right-drag to pan'}</span><button className={'camera-reset' + (lab.motion ? ' active' : '')} onClick={() => lab.setMotion(!lab.motion)} aria-label="Animate signals" aria-pressed={lab.motion} title="Animate signals"><Waves size={16} /></button></div>
            <div className="axis-marker" aria-hidden="true"><span>y</span><span>z</span><span>x</span></div>
          </div>
          <LabInspector lab={lab} />
        </div>
        <footer className="workspace-status"><span><span className="live-dot" />Simulation running</span><span>{circuit.parts.length} components<span className="status-divider" />{circuit.wires.length} connections<span className="status-divider" />Combinational logic</span></footer>
      </div>
      <div className={'below-workspace' + (lab.isError ? ' has-error' : '')}><p role="status" aria-live="polite"><Lightbulb size={16} />{lab.notice}</p><a href="#about">Meet the maker <ChevronDown size={14} /></a></div>
    </section>
    <section id="about" className="about-section">
      <div className="about-heading"><div className="about-silicon"><img src="/assets/silicon-hero-mobile.webp" width="768" height="512" alt="Cinematic visualization of an exposed silicon processor with copper bond wires" loading="lazy"/><span>Curiosity, at the smallest scale.</span></div><span className="small-label">The mind behind the board</span><h2>Hi, I’m Nakshatra.</h2><p>Exploring the world between<br />a line of code and a piece of silicon.</p></div>
      <div className="about-copy"><span className="availability"><span className="live-dot" />Open to internships</span><p>First-year Electronics & Communication Engineering student at MVSR Engineering College, Hyderabad. Fascinated by chip design, VLSI, and the way hardware and software come together.</p><p className="about-secondary">Building my foundations in Python and core ECE concepts, and getting hands-on with the Robotics Club. Looking for opportunities in core electronics, VLSI, chip design, and hardware engineering.</p><div className="interest-tags"><span>VLSI & chip design</span><span>Embedded systems</span><span>Digital circuits</span><span>Python</span><span>Robotics Club member</span></div><a href="https://www.linkedin.com/in/nakshatra-d-5b8965436" target="_blank" rel="noreferrer">Let’s connect on LinkedIn <ArrowUpRight size={16} /></a></div>
    </section>
    <footer className="site-footer"><span>© {new Date().getFullYear()} Nakshatra D</span><span>Built with curiosity. Connected by logic.</span><a href="https://github.com/nakshatra82" target="_blank" rel="noreferrer" aria-label="Nakshatra on GitHub"><Cpu size={18} /></a></footer>
    <AlertDialog open={!!lab.replacement} onOpenChange={open => { if (!open) lab.setReplacement(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Replace your current circuit?</AlertDialogTitle><AlertDialogDescription>Your edits will be replaced by {lab.replacement?.name}. Export a file first to keep a separate copy. You can also undo this replacement.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => { if (lab.replacement) lab.replace(lab.replacement); }}>Replace circuit</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
function ComponentButton({ kind, active, disabled, onClick }: { kind: Kind; active: boolean; disabled: boolean; onClick: () => void }) {
  return <button className={'component-button' + (active ? ' active' : '')} disabled={disabled} onClick={onClick} title={descriptions[kind]} aria-label={'Add ' + (kind === 'INPUT' ? 'input switch' : kind === 'LED' ? 'output LED' : kind + ' gate')} aria-pressed={active}><span className={'gate-icon gate-' + kind}>{kind === 'INPUT' ? <Power size={18} /> : kind === 'LED' ? <Lightbulb size={18} /> : <GateGlyph kind={kind} />}</span><span>{kind === 'INPUT' ? 'Input switch' : kind === 'LED' ? 'Output LED' : kind}</span><Plus size={13} className="add-icon" /></button>;
}
function GateGlyph({ kind }: { kind: Kind }) {
  return <svg viewBox="0 0 34 24" width="29" height="22" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true">{kind === 'NOT' ? <path d="M1 12h7M8 3l17 9-17 9zM28 12h6" /> : <><path d="M1 7h7M1 17h7M26 12h7" />{kind.includes('OR') ? <><path d="M7 3Q14 12 7 21Q21 22 27 12Q21 2 7 3Z" />{kind.includes('X') && <path d="M3 3Q10 12 3 21" />}</> : <path d="M8 3h8a9 9 0 0 1 0 18H8Z" />}</>}{['NOT', 'NAND', 'NOR', 'XNOR'].includes(kind) && <circle cx="28" cy="12" r="2" fill="var(--panel)" />}</svg>;
}
function Help() {
  return <Dialog><DialogTrigger className="help-button" aria-label="How to use the circuit lab"><CircleHelp size={17} /></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Make your first connection.</DialogTitle><DialogDescription>Build a working digital circuit in a few small steps.</DialogDescription></DialogHeader><ol className="help-steps"><li>Pick a component from the palette. Click an empty place on the overhead board, or use “Find a spot”.</li><li>Click the output pin on a component’s right, then an input pin on another component’s left. The “Wire connections” panel offers the same controls by keyboard.</li><li>Use Pan to drag across the board, Orbit to rotate it, and the zoom buttons to get closer. The arrow buttons move the camera. Select a component and use Focus to inspect it.</li><li>Click a chip to highlight all its wires. Click or hover a trace to see its source, destination, and input pin.</li><li>Toggle an input switch. Blue traces carry 1; copper traces carry 0. “?” means an input is unknown.</li><li>Select a component to rename, move, or delete it. Undo and redo work with the toolbar or ⌘ / Ctrl Z and Shift Z.</li><li>Your circuit saves in this browser. Export a JSON file to keep or share it; import the file to reopen it.</li></ol><p className="empty-hint">This lab models combinational digital logic. Signal animation is illustrative. Analog circuits, clocks, and feedback loops aren’t supported.</p></DialogContent></Dialog>;
}
