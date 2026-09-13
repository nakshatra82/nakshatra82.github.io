'use client';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Line, RoundedBox, Environment, Lightformer, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { boardSize, inputCount, pinPosition, signalText, type Circuit, type Part, type Signal } from '@/lib/circuit';
import { routeWires } from '@/lib/wire-routing';

export type BoardProps = {
  circuit: Circuit; values: Record<string, Signal>; mode: '3d' | 'edit'; selected: string | null;
  pending: string | null; reset: number; motion: boolean; placing: boolean;
  navigation: 'orbit' | 'pan'; cameraCommand: { tick: number; action: 'in' | 'out' | 'left' | 'right' | 'up' | 'down' | 'focus' } | null;
  onSelect: (id: string) => void; onToggle: (id: string) => void;
  onPin: (id: string, direction: 'in' | 'out', index: number) => void;
  onPlace: (x: number, z: number) => void; onWire: (id: string) => void;
  onMove: (id: string, x: number, z: number) => boolean;
};
function Label({ text, position, size = 1, color = '#c8d6e4' }: { text: string; position: [number, number, number]; size?: number; color?: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.font = '500 48px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 256, 64, 500);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><planeGeometry args={[size * 3, size * 0.75]} /><meshBasicMaterial map={texture} transparent depthWrite={false} /></mesh>;
}
function Chip({ part: p, value, props, onDraft, onDragState }: { part: Part; value: Signal; props: BoardProps; onDraft: (draft: {id:string;x:number;z:number} | null) => void; onDragState: (dragging:boolean) => void }) {
  const active = value === 1, selected = props.selected === p.id, io = p.kind === 'INPUT' || p.kind === 'LED';
  const die = useTexture('/assets/silicon-die.webp');
  useEffect(() => { die.colorSpace = THREE.SRGBColorSpace; die.anisotropy = 8; }, [die]);
  const drag = useRef<{ x:number; z:number; startX:number; startY:number; offsetX:number; offsetZ:number; lastX:number; lastZ:number; moved:boolean } | null>(null);
  function beginDrag(e: ThreeEvent<PointerEvent>) {
    if(props.mode !== 'edit' || props.navigation === 'pan' || props.placing || props.pending || e.button !== 0) return;
    e.stopPropagation();
    const point = e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
    if(!point) return;
    props.onSelect(p.id);
    drag.current = {x:p.x,z:p.z,startX:e.clientX,startY:e.clientY,offsetX:point.x-p.x,offsetZ:point.z-p.z,lastX:p.x,lastZ:p.z,moved:false};
    (e.target as unknown as {setPointerCapture(id:number):void}).setPointerCapture(e.pointerId);
    onDragState(true);
  }
  function dragMove(e: ThreeEvent<PointerEvent>) {
    const d=drag.current; if(!d)return; e.stopPropagation();
    if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<4 && !d.moved)return;
    const point=e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3()); if(!point)return;
    const [w,h]=boardSize(props.circuit);
    d.lastX=Math.max(-w/2+2,Math.min(w/2-2,Math.round((point.x-d.offsetX)*2)/2));
    d.lastZ=Math.max(-h/2+2,Math.min(h/2-2,Math.round((point.z-d.offsetZ)*2)/2));
    d.moved=true; onDraft({id:p.id,x:d.lastX,z:d.lastZ});
  }
  function endDrag(e: ThreeEvent<PointerEvent>, cancel=false) {
    const d=drag.current;if(!d)return;e.stopPropagation();drag.current=null;
    (e.target as unknown as {releasePointerCapture(id:number):void}).releasePointerCapture(e.pointerId);
    onDragState(false);onDraft(null);
    if(d.moved && !cancel && (d.lastX!==d.x || d.lastZ!==d.z)) props.onMove(p.id,d.lastX,d.lastZ);
  }
  const pinClick = (direction: 'in' | 'out', index: number) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if(e.delta < 4) props.onPin(p.id, direction, index); };
  return <group>
    <group position={[p.x, 0, p.z]} onPointerDown={beginDrag} onPointerMove={dragMove} onPointerUp={e=>endDrag(e)} onPointerCancel={e=>endDrag(e,true)} onClick={e => { e.stopPropagation(); if(e.delta < 4) props.onSelect(p.id); }}>
      <RoundedBox args={[2.2, io ? 0.35 : 0.65, 1.85]} radius={0.1} smoothness={3} position={[0, io ? 0.32 : 0.45, 0]} castShadow receiveShadow><meshStandardMaterial color={selected ? '#304554' : '#18242c'} metalness={0.62} roughness={0.3} /></RoundedBox>
      {!io && <>
        <RoundedBox args={[1.74, 0.07, 1.44]} radius={0.04} smoothness={2} position={[0, 0.8, 0]}><meshStandardMaterial color="#bba078" metalness={0.88} roughness={0.2} /></RoundedBox>
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.841,0]}><planeGeometry args={[1.58,1.29]} /><meshPhysicalMaterial map={die} color="#d6e4ec" metalness={0.56} roughness={0.23} clearcoat={0.9} clearcoatRoughness={0.14} /></mesh>
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.847,0.03]}><planeGeometry args={[1.13,0.46]} /><meshBasicMaterial color="#101a25" transparent opacity={0.86} /></mesh>
        <Label text={p.kind} position={[0, 0.855, 0.03]} size={0.43} color="#f1f8fc" />
        {[-1, 1].flatMap(side => [-0.6, -0.2, 0.2, 0.6].map((z, i) => <mesh key={`${side}-${i}`} position={[side * 1.19, 0.22, z]}><boxGeometry args={[0.45, 0.13, 0.13]} /><meshStandardMaterial color="#bc9973" metalness={0.85} roughness={0.25} /></mesh>))}
      </>}
      {p.kind === 'INPUT' && <group onClick={e => { e.stopPropagation(); if(e.delta < 4) props.onToggle(p.id); }}>
        <RoundedBox args={[1.24, 0.1, 0.67]} radius={0.07} position={[0, 0.55, 0]}><meshStandardMaterial color="#111c28" /></RoundedBox>
        <RoundedBox args={[0.58, 0.16, 0.55]} radius={0.05} position={[active ? 0.31 : -0.31, 0.63, 0]}><meshStandardMaterial color={active ? '#69c9ff' : '#718698'} metalness={0.4} roughness={0.3} emissive={active ? '#2d80aa' : '#000000'} emissiveIntensity={0.3} /></RoundedBox>
      </group>}
      {p.kind === 'LED' && <group position={[0, 0.64, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.37, 0.07, 12, 24]} /><meshStandardMaterial color="#b69774" metalness={0.8} roughness={0.25} /></mesh>
        <mesh><sphereGeometry args={[0.32, 24, 16]} /><meshStandardMaterial color={active ? '#a5e0ff' : value === null ? '#b99d67' : '#344a59'} emissive={active ? '#38b5ff' : '#000000'} emissiveIntensity={active ? 2.1 : 0} metalness={0.15} roughness={0.23} /></mesh>
        {active && <pointLight color="#69c9ff" intensity={2} distance={2.5} />}
      </group>}
      <Label text={p.label} position={[0, 0.17, 1.3]} size={0.49} />
      {selected && <Line points={[[-1.23, 0.16, -1.04], [1.23, 0.16, -1.04], [1.23, 0.16, 1.04], [-1.23, 0.16, 1.04], [-1.23, 0.16, -1.04]]} color="#69c9ff" lineWidth={1.4} />}
    </group>
    {Array.from({ length: inputCount(p.kind) }, (_, i) => <mesh key={i} position={pinPosition(p, 'in', i)} onClick={pinClick('in', i)}><sphereGeometry args={[0.14, 12, 8]} /><meshStandardMaterial color={props.pending ? '#69c9ff' : '#bb926a'} emissive={props.pending ? '#287ca4' : '#000000'} /></mesh>)}
    {p.kind !== 'LED' && <mesh position={pinPosition(p, 'out')} onClick={pinClick('out', 0)}><sphereGeometry args={[0.14, 12, 8]} /><meshStandardMaterial color={active || props.pending === p.id ? '#69c9ff' : '#bb926a'} /></mesh>}
  </group>;
}
function SignalDot({ points, motion }: { points: THREE.Vector3[]; motion: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const path = useMemo(() => { const p = new THREE.CurvePath<THREE.Vector3>(); for (let i = 1; i < points.length; i++) p.add(new THREE.LineCurve3(points[i - 1], points[i])); return p; }, [points]);
  useFrame(({ clock }) => { if (ref.current && motion) ref.current.position.copy(path.getPoint((clock.elapsedTime * 0.18) % 1)); });
  return motion ? <mesh ref={ref}><sphereGeometry args={[0.075, 8, 8]} /><meshBasicMaterial color="#d3f1ff" /></mesh> : null;
}
function Camera({ mode, reset, width, depth, props, dragging }: { mode: string; reset: number; width: number; depth: number; props: BoardProps; dragging:boolean }) {
  const { camera, size, invalidate } = useThree(); const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => {
    if (!props.cameraCommand || !controls.current) return;
    const c = controls.current, action = props.cameraCommand.action;
    const offset = camera.position.clone().sub(c.target), distance = offset.length();
    if(action === 'in' || action === 'out') camera.position.copy(c.target).add(offset.multiplyScalar(action === 'in' ? 0.78 : 1.28));
    else if(action === 'focus') {
      const part = props.circuit.parts.find(p => p.id === props.selected);
      if(part) { c.target.set(part.x,0,part.z); camera.position.copy(c.target).add(offset.normalize().multiplyScalar(9)); }
    } else {
      const delta = new THREE.Vector3(action === 'left' ? -1 : action === 'right' ? 1 : 0, action === 'up' ? 1 : action === 'down' ? -1 : 0,0).applyQuaternion(camera.quaternion).multiplyScalar(distance * 0.12);
      camera.position.add(delta); c.target.add(delta);
    }
    c.update(); invalidate();
  // Camera commands are discrete. Changes to selection must not trigger an old command again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.cameraCommand, camera, invalidate]);
  useEffect(() => {
    const aspect = size.width / Math.max(size.height - 100, 1), tan = Math.tan(43 * Math.PI / 360);
    const projectedWidth = mode === 'edit' ? width + 2 : width + depth * 0.15;
    const projectedDepth = mode === 'edit' ? depth + 2 : depth * 0.82 + width * 0.15;
    const distance = Math.max(projectedWidth / (2 * tan * aspect), projectedDepth / (2 * tan)) * 1.12;
    camera.position.copy(mode === 'edit' ? new THREE.Vector3(0,distance,0.001) : new THREE.Vector3(0.15,0.85,0.5).normalize().multiplyScalar(distance));
    camera.lookAt(0, 0, 0); controls.current?.target.set(0, 0, 0); controls.current?.update();
  }, [mode, reset, camera, size.width, size.height, width, depth]);
  const pan = props.navigation === 'pan' || mode === 'edit';
  return <OrbitControls ref={controls} makeDefault enabled={!dragging} enableDamping={false} enableRotate={!pan} minDistance={5} maxDistance={140} maxPolarAngle={Math.PI / 2.25} enablePan screenSpacePanning mouseButtons={{ LEFT:pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE:THREE.MOUSE.DOLLY, RIGHT:THREE.MOUSE.PAN }} touches={{ ONE:pan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO:THREE.TOUCH.DOLLY_PAN }} />;
}
function Scene(props: BoardProps) {
  const { values } = props;
  const [draft,setDraft] = useState<{id:string;x:number;z:number}|null>(null);
  const [dragging,setDragging] = useState(false);
  const circuit = useMemo(()=>draft ? {...props.circuit,parts:props.circuit.parts.map(p=>p.id===draft.id?{...p,x:draft.x,z:draft.z}:p)} : props.circuit,[props.circuit,draft]);
  const [width,depth] = boardSize(circuit);
  const routes = useMemo(() => routeWires(circuit), [circuit]);
  const [hoveredWire,setHoveredWire] = useState<string | null>(null);
  const activeWire = circuit.wires.find(w => w.id === (hoveredWire || props.selected));
  return <>
    <color attach="background" args={['#10171f']} /><ambientLight intensity={0.7} />
    <Environment resolution={128} frames={1}><Lightformer form="rect" intensity={3} position={[0,10,0]} rotation={[Math.PI/2,0,0]} scale={[15,15,1]} /><Lightformer form="rect" intensity={2.5} color="#afdcff" position={[-10,4,3]} rotation={[0,Math.PI/2,0]} scale={[10,5,1]} /><Lightformer form="rect" intensity={3} color="#ecc294" position={[10,5,-5]} rotation={[0,-Math.PI/2,0]} scale={[15,4,1]} /></Environment>
    <directionalLight position={[0, 24, 5]} intensity={3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-normalBias={0.035} />
    <directionalLight position={[-15, 7, -8]} color="#79b5e3" intensity={2} /><directionalLight position={[15, 6, 4]} color="#efbc86" intensity={1.3} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#101820" roughness={0.8} /></mesh>
    <gridHelper args={[100, 100, '#223140', '#1a2734']} position={[0, -0.47, 0]} />
    <RoundedBox args={[width, 0.42, depth]} radius={0.24} smoothness={3} receiveShadow castShadow position={[0, -0.1, 0]} onClick={e => { e.stopPropagation(); if (props.placing) props.onPlace(Math.round(e.point.x * 2) / 2, Math.round(e.point.z * 2) / 2); }}><meshPhysicalMaterial color="#153337" metalness={0.38} roughness={0.43} clearcoat={0.3} /></RoundedBox>
    <Line points={[[-width/2+0.3,0.12,-depth/2+0.3],[width/2-0.3,0.12,-depth/2+0.3],[width/2-0.3,0.12,depth/2-0.3],[-width/2+0.3,0.12,depth/2-0.3],[-width/2+0.3,0.12,-depth/2+0.3]]} color="#9a794b" lineWidth={0.8} />
    {[-width/2+0.7,width/2-0.7].flatMap(x => [-depth/2+0.7,depth/2-0.7].map(z => <group key={`${x}${z}`} position={[x, 0.12, z]}><mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.16, 0.31, 24]} /><meshStandardMaterial color="#bea27e" metalness={0.75} roughness={0.35} /></mesh><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}><circleGeometry args={[0.15, 20]} /><meshBasicMaterial color="#111b23" /></mesh></group>))}
    <Label text="NAKSHATRA / SILICON LAB" position={[-width/2+6, 0.13, -depth/2+0.8]} size={1.7} color="#9bb8b6" /><Label text="DIGITAL LOGIC • REV 2.0" position={[width/2-5, 0.13, depth/2-0.8]} size={1.2} color="#9bb8b6" />
    {Array.from({ length: Math.floor(depth/0.8)-2 }, (_, i) => <Line key={i} points={[[-width/2+1, 0.12, -depth/2+1.5 + i * 0.8], [width/2-1, 0.12, -depth/2+1.5 + i * 0.8]]} color="#274347" lineWidth={0.4} />)}
    {width > 22 && [0,1,2,3].map(bit => <group key={bit}><Label text={`BIT ${bit} / ${2 ** bit}`} position={[14.5,0.14,-8+bit*5]} size={0.8} color="#b3a789" /><Line points={[[-16.5,0.135,-5.5+bit*5],[16.5,0.135,-5.5+bit*5]]} color="#456064" lineWidth={0.7} dashed dashSize={0.18} gapSize={0.14} /></group>)}
    {circuit.wires.map(w => {
      const points = routes[w.id].map(p => new THREE.Vector3(...p)), v = values[w.from];
      const highlighted = props.selected === w.id || hoveredWire === w.id || props.selected === w.from || props.selected === w.to;
      const dimmed = !!props.selected && !highlighted;
      return <group key={w.id} onClick={e => { e.stopPropagation(); if(e.delta < 4) props.onWire(w.id); }} onPointerOver={e=>{e.stopPropagation();setHoveredWire(w.id);}} onPointerOut={()=>setHoveredWire(null)}>
        {highlighted && <Line points={points} color="#b2e6ff" lineWidth={9} transparent opacity={0.14} raycast={()=>null} />}
        <Line points={points} color={highlighted ? '#e1f7ff' : v === 1 ? '#64d7ff' : v === null ? '#daba80' : '#daa36b'} lineWidth={highlighted ? 4 : 2.5} transparent opacity={dimmed ? 0.23 : 1} dashed={v === null} dashSize={0.2} gapSize={0.15} />
        {v === 1 && !dimmed && <SignalDot points={points} motion={props.motion} />}
      </group>;
    })}
    {activeWire && <Html position={routes[activeWire.id][Math.floor(routes[activeWire.id].length/2)]} center style={{pointerEvents:'none'}} zIndexRange={[8,0]}><div className="wire-tooltip">{circuit.parts.find(p=>p.id===activeWire.from)?.label}<span>→</span>{circuit.parts.find(p=>p.id===activeWire.to)?.label}<small>In {activeWire.pin+1} · Logic {signalText(values[activeWire.from])}</small></div></Html>}
    {circuit.parts.map(p => <Chip key={p.id} part={p} value={values[p.id]} props={props} onDraft={d=>setDraft(current=>current?.id===d?.id && current?.x===d?.x && current?.z===d?.z ? current : d)} onDragState={setDragging} />)}<Camera mode={props.mode} reset={props.reset} width={width} depth={depth} props={props} dragging={dragging} />
  </>;
}
function Fallback(props: BoardProps) {
  const [width,depth] = boardSize(props.circuit);
  const [view,setView] = useState({x:-width/2-1,z:-depth/2-1,w:width+2,h:depth+2});
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{screenX:number;screenY:number;matrix:DOMMatrix;start:{x:number;y:number};view:typeof view;part?:Part;lastX:number;lastZ:number}|null>(null);
  const moved = useRef(false);
  const routes = useMemo(() => routeWires(props.circuit), [props.circuit]);
  useEffect(()=>setView({x:-width/2-1,z:-depth/2-1,w:width+2,h:depth+2}),[width,depth,props.reset]);
  useEffect(()=>{
    const action=props.cameraCommand?.action;if(!action)return;
    setView(v=>{
      if(action==='focus'){const p=props.circuit.parts.find(p=>p.id===props.selected);return p?{x:p.x-5,z:p.z-5*v.h/v.w,w:10,h:10*v.h/v.w}:v;}
      if(action==='in'||action==='out'){const scale=action==='in'?.78:1.28;return{x:v.x+v.w*(1-scale)/2,z:v.z+v.h*(1-scale)/2,w:v.w*scale,h:v.h*scale};}
      return{...v,x:v.x+(action==='left'?-.12:action==='right'?.12:0)*v.w,z:v.z+(action==='up'?-.12:action==='down'?.12:0)*v.h};
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[props.cameraCommand]);
  function begin(e:React.PointerEvent,part?:Part){
    if(e.button!==0||!svg.current)return;e.stopPropagation();moved.current=false;
    const matrix=svg.current.getScreenCTM()?.inverse();if(!matrix)return;
    const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix);
    const editable=part&&props.mode==='edit'&&props.navigation!=='pan'&&!props.placing&&!props.pending;
    drag.current={screenX:e.clientX,screenY:e.clientY,matrix,start:point,view,part:editable?part:undefined,lastX:part?.x??0,lastZ:part?.z??0};
    svg.current.setPointerCapture(e.pointerId);
    if(part)props.onSelect(part.id);
  }
  function move(e:React.PointerEvent){
    const d=drag.current;if(!d)return;
    if(Math.hypot(e.clientX-d.screenX,e.clientY-d.screenY)<4&&!moved.current)return;
    moved.current=true;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(d.matrix),dx=point.x-d.start.x,dz=point.y-d.start.y;
    if(d.part){d.lastX=Math.max(-width/2+2,Math.min(width/2-2,Math.round((d.part.x+dx)*2)/2));d.lastZ=Math.max(-depth/2+2,Math.min(depth/2-2,Math.round((d.part.z+dz)*2)/2));}
    else setView({...d.view,x:d.view.x-dx,z:d.view.z-dz});
  }
  function end(e:React.PointerEvent,cancel=false){const d=drag.current;if(!d)return;drag.current=null;svg.current?.releasePointerCapture(e.pointerId);if(d.part&&moved.current&&!cancel)props.onMove(d.part.id,d.lastX,d.lastZ);}
  return <div className="fallback-board"><p className="fallback-note">2D board · drag to pan · use the zoom controls</p><svg ref={svg} viewBox={view.x+' '+view.z+' '+view.w+' '+view.h} role="img" aria-label="Circuit schematic" style={{touchAction:'none'}} onPointerDown={e=>begin(e)} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onWheel={e=>{const scale=e.deltaY>0?1.12:.89;setView(v=>({x:v.x+v.w*(1-scale)/2,z:v.z+v.h*(1-scale)/2,w:v.w*scale,h:v.h*scale}));}} onClick={e => {
    if (!props.placing || moved.current) return; const point = e.currentTarget.createSVGPoint(); point.x = e.clientX; point.y = e.clientY;
    const matrix = e.currentTarget.getScreenCTM(); if (!matrix) return; const p = point.matrixTransform(matrix.inverse()); props.onPlace(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2);
  }}><rect x={-width/2} y={-depth/2} width={width} height={depth} rx="0.3" fill="#253b43" />
    {props.circuit.wires.map(w => {const highlighted=props.selected===w.id||props.selected===w.from||props.selected===w.to;return <path key={w.id} d={routes[w.id].map((p,i)=>(i?'L':'M')+p[0]+' '+p[2]).join(' ')} stroke={highlighted ? '#fff' : props.values[w.from] === 1 ? '#69d9ff' : '#dca571'} opacity={props.selected&&!highlighted?.22:1} fill="none" strokeWidth={highlighted?.16:.11} onClick={e => { e.stopPropagation(); if(!moved.current)props.onWire(w.id); }}><title>{props.circuit.parts.find(p=>p.id===w.from)?.label+' → '+props.circuit.parts.find(p=>p.id===w.to)?.label+' input '+(w.pin+1)}</title></path>;})}
    {props.circuit.parts.map(p => <g key={p.id} transform={'translate('+p.x+','+p.z+')'} onPointerDown={e=>begin(e,p)} onClick={e => { e.stopPropagation(); if(!moved.current)props.onSelect(p.id); }}><rect x="-1.1" y="-0.9" width="2.2" height="1.8" rx="0.15" fill="#1c2834" stroke={props.selected === p.id ? '#69c9ff' : '#56707e'} strokeWidth="0.05" /><text textAnchor="middle" y="-0.13" fill="#eef3f8" fontSize="0.4">{p.kind}</text><text textAnchor="middle" y="0.48" fill="#69c9ff" fontSize="0.45">{signalText(props.values[p.id])}</text><text textAnchor="middle" y="1.4" fill="#c6d3df" fontSize="0.35">{p.label}</text>{Array.from({ length: inputCount(p.kind) }, (_, i) => <circle key={i} cx="-1.45" cy={inputCount(p.kind) === 2 ? i === 0 ? -0.48 : 0.48 : 0} r="0.2" fill="#c98a57" onPointerDown={e=>e.stopPropagation()} onClick={e => { e.stopPropagation(); props.onPin(p.id, 'in', i); }} />)}{p.kind !== 'LED' && <circle cx="1.45" cy="0" r="0.2" fill="#69c9ff" onPointerDown={e=>e.stopPropagation()} onClick={e => { e.stopPropagation(); props.onPin(p.id, 'out', 0); }} />}</g>)}
  </svg></div>;
}
class RenderBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export default function CircuitBoard(props: BoardProps) {
  const [ready, setReady] = useState(false), [supported, setSupported] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    try { const canvas = document.createElement('canvas'); const gl = canvas.getContext('webgl2'); setSupported(!!gl); gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { setSupported(false); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    let inView = true;
    const update = () => setVisible(inView && document.visibilityState === 'visible');
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); });
    if (root.current) observer.observe(root.current);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, [ready]);
  if (!ready) return <div className="board-loading"><span className="loading-chip">N</span><p>Preparing the circuit board…</p></div>;
  if (!supported) return <Fallback {...props} />;
  return <div className="board-canvas" ref={root}><RenderBoundary fallback={<Fallback {...props} />}><Canvas shadows="percentage" dpr={[1, 1.5]} camera={{ position: [9, 20, 20], fov: 43 }} frameloop={props.motion && visible ? 'always' : 'demand'} onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', () => setSupported(false), { once: true }); }}><Suspense fallback={null}><Scene {...props} motion={props.motion && visible} /></Suspense></Canvas></RenderBoundary></div>;
}
