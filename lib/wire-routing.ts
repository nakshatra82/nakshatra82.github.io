import { boardSize, pinPosition, type Circuit } from './circuit';

export type Point3 = [number, number, number];
type SearchNode = { x: number; z: number; cost: number; score: number; parent?: SearchNode; direction: number };

// A small binary heap keeps routing a dense board quick without a graph dependency.
class Heap {
  private nodes: SearchNode[] = [];
  get length() { return this.nodes.length; }
  push(node: SearchNode) {
    this.nodes.push(node); let i = this.nodes.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.nodes[p].score <= node.score) break; this.nodes[i] = this.nodes[p]; i = p; }
    this.nodes[i] = node;
  }
  pop(): SearchNode {
    const first = this.nodes[0], last = this.nodes.pop()!;
    if (this.nodes.length) {
      let i = 0;
      while (i * 2 + 1 < this.nodes.length) {
        let child = i * 2 + 1;
        if (child + 1 < this.nodes.length && this.nodes[child + 1].score < this.nodes[child].score) child++;
        if (this.nodes[child].score >= last.score) break;
        this.nodes[i] = this.nodes[child]; i = child;
      }
      this.nodes[i] = last;
    }
    return first;
  }
}
export function routeWires(c: Circuit): Record<string, Point3[]> {
  const [width, depth] = boardSize(c), routes: Record<string, Point3[]> = {}, occupied = new Map<string, number>();
  const key = (x: number, z: number) => `${x},${z}`;
  const blocked = new Set<string>();
  for (let x = -width + 1; x < width; x++) for (let z = -depth + 1; z < depth; z++) {
    if (c.parts.some(p => Math.abs(p.x - x / 2) < 1.3 && Math.abs(p.z - z / 2) < 1.03)) blocked.add(key(x,z));
  }
  c.wires.forEach((wire, index) => {
    const from = c.parts.find(p => p.id === wire.from)!, to = c.parts.find(p => p.id === wire.to)!;
    const a = pinPosition(from,'out'), b = pinPosition(to,'in',wire.pin);
    const sx = Math.round((a[0] + 0.35) * 2), sz = Math.round(a[2] * 2), tx = Math.round((b[0] - 0.35) * 2), tz = Math.round(b[2] * 2);
    const open = new Heap(), costs = new Map<string,number>();
    open.push({ x:sx, z:sz, cost:0, score:0, direction:-1 }); let goal: SearchNode | undefined;
    while (open.length) {
      const current = open.pop(), state = `${key(current.x,current.z)}:${current.direction}`;
      if (current.cost > (costs.get(state) ?? Infinity)) continue;
      if (current.x === tx && current.z === tz) { goal = current; break; }
      for (const [direction,[dx,dz]] of [[1,0],[0,1],[-1,0],[0,-1]].entries()) {
        const x = current.x + dx, z = current.z + dz, cell = key(x,z);
        if (Math.abs(x) >= width || Math.abs(z) >= depth || blocked.has(cell)) continue;
        const cost = current.cost + 1 + (current.direction >= 0 && direction !== current.direction ? 0.45 : 0) + (occupied.get(cell) ?? 0) * 0.3;
        const nextKey = `${cell}:${direction}`;
        if (cost >= (costs.get(nextKey) ?? Infinity)) continue;
        costs.set(nextKey,cost); open.push({ x,z,cost,score:cost + Math.abs(x-tx) + Math.abs(z-tz),parent:current,direction });
      }
    }
    const grid: Point3[] = [], height = 0.25 + (index % 5) * 0.005;
    while (goal) { grid.push([goal.x / 2,height,goal.z / 2]); const k = key(goal.x,goal.z); occupied.set(k,(occupied.get(k) ?? 0) + 1); goal = goal.parent; }
    grid.reverse();
    // A visible over-board jumper is the fallback for a completely obstructed route.
    if (!grid.length) { routes[wire.id] = [a,[a[0],1.8,a[2]],[b[0],1.8,b[2]],b]; return; }
    const raw = [a,...grid,b];
    const simplified = raw.filter((point,i) => i === 0 || i === raw.length - 1 ||
      Math.abs((point[0]-raw[i-1][0])*(raw[i+1][2]-point[2])-(point[2]-raw[i-1][2])*(raw[i+1][0]-point[0])) > 0.00001);
    routes[wire.id] = simplified;
  });
  return routes;
}
