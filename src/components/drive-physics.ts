import roads from "./baku-roads.json";

export const MAP_ZOOM = 17;
const TILE = 256;

export type Position = { x: number; y: number };
export type CarState = Position & { angle: number; speed: number };
type RoadSegment = { ax: number; ay: number; bx: number; by: number; radius: number };

export function project([lon, lat]: [number, number]): Position {
  const n = 2 ** MAP_ZOOM;
  const rad = lat * Math.PI / 180;
  return { x: (lon + 180) / 360 * n * TILE, y: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n * TILE };
}

const roadRadius: Record<string, number> = {
  trunk: 19, trunk_link: 16, primary: 18, primary_link: 15,
  secondary: 16, secondary_link: 14, tertiary: 14, tertiary_link: 13,
  residential: 12, unclassified: 12, living_street: 11, service: 10,
};

const segments: RoadSegment[] = roads.flatMap(road => {
  const points = (road.points as [number, number][]).map(project);
  return points.slice(1).map((b, index) => ({
    ax: points[index].x, ay: points[index].y, bx: b.x, by: b.y,
    radius: roadRadius[road.kind] ?? 12,
  }));
});

const nodeByKey = new Map<string, number>();
const graphNodes: Position[] = [];
const graphEdges: { to: number; distance: number }[][] = [];
for (const road of roads) {
  const ids = road.points.map(coord => {
    const key = coord.join(",");
    let id = nodeByKey.get(key);
    if (id === undefined) {
      id = graphNodes.length;
      nodeByKey.set(key, id);
      graphNodes.push(project(coord as [number, number]));
      graphEdges.push([]);
    }
    return id;
  });
  for (let index = 1; index < ids.length; index++) {
    const a = ids[index - 1], b = ids[index];
    const distance = Math.hypot(graphNodes[a].x - graphNodes[b].x, graphNodes[a].y - graphNodes[b].y);
    graphEdges[a].push({ to: b, distance });
    graphEdges[b].push({ to: a, distance });
  }
}

export function roadPath(from: Position, to: Position): Position[] | null {
  const nearestNodes = (point: Position) => graphNodes.map((node, id) => ({ id, distance: Math.hypot(node.x - point.x, node.y - point.y) })).sort((a, b) => a.distance - b.distance).slice(0, 8);
  const starts = nearestNodes(from), goals = nearestNodes(to);
  const goalCosts = new Map(goals.map(goal => [goal.id, goal.distance]));
  const cost = new Float64Array(graphNodes.length).fill(Infinity);
  const previous = new Int32Array(graphNodes.length).fill(-1);
  const queue: { id: number; cost: number }[] = [];
  const push = (entry: { id: number; cost: number }) => {
    queue.push(entry);
    let child = queue.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (queue[parent].cost <= queue[child].cost) break;
      [queue[parent], queue[child]] = [queue[child], queue[parent]];
      child = parent;
    }
  };
  const pop = () => {
    const root = queue[0], tail = queue.pop();
    if (queue.length && tail) {
      queue[0] = tail;
      let parent = 0;
      while (true) {
        const left = parent * 2 + 1, right = left + 1;
        if (left >= queue.length) break;
        const child = right < queue.length && queue[right].cost < queue[left].cost ? right : left;
        if (queue[parent].cost <= queue[child].cost) break;
        [queue[parent], queue[child]] = [queue[child], queue[parent]];
        parent = child;
      }
    }
    return root;
  };
  for (const start of starts) { cost[start.id] = start.distance; push({ id: start.id, cost: start.distance }); }
  let bestGoal = -1, bestCost = Infinity;
  while (queue.length) {
    const current = pop();
    if (current.cost !== cost[current.id]) continue;
    if (current.cost >= bestCost) break;
    const endCost = goalCosts.get(current.id);
    if (endCost !== undefined && current.cost + endCost < bestCost) { bestCost = current.cost + endCost; bestGoal = current.id; }
    for (const edge of graphEdges[current.id]) {
      const next = current.cost + edge.distance;
      if (next >= cost[edge.to]) continue;
      cost[edge.to] = next; previous[edge.to] = current.id; push({ id: edge.to, cost: next });
    }
  }
  if (bestGoal < 0 || bestCost > 6000) return null;
  const path: Position[] = [];
  for (let id = bestGoal; id >= 0; id = previous[id]) path.unshift(graphNodes[id]);
  return [from, ...path, to];
}

export function nearestRoad(point: Position, searchRadius = 55) {
  let best: { x: number; y: number; distance: number; radius: number; angle: number } | null = null;
  for (const road of segments) {
    const minX = Math.min(road.ax, road.bx) - searchRadius;
    const maxX = Math.max(road.ax, road.bx) + searchRadius;
    const minY = Math.min(road.ay, road.by) - searchRadius;
    const maxY = Math.max(road.ay, road.by) + searchRadius;
    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) continue;
    const dx = road.bx - road.ax, dy = road.by - road.ay;
    const along = Math.max(0, Math.min(1, ((point.x - road.ax) * dx + (point.y - road.ay) * dy) / (dx * dx + dy * dy)));
    const x = road.ax + along * dx, y = road.ay + along * dy;
    const distance = Math.hypot(point.x - x, point.y - y);
    if (!best || distance < best.distance) best = { x, y, distance, radius: road.radius, angle: Math.atan2(dx, -dy) * 180 / Math.PI };
  }
  return best;
}

export function drivingStart(near: Position): CarState {
  let choice: { score: number; road: RoadSegment } | null = null;
  for (const road of segments) {
    const length = Math.hypot(road.bx - road.ax, road.by - road.ay);
    if (length < 105) continue;
    const midX = (road.ax + road.bx) / 2, midY = (road.ay + road.by) / 2;
    const distance = Math.hypot(midX - near.x, midY - near.y);
    if (distance > 400) continue;
    const score = distance - Math.min(length, 240) * .35;
    if (!choice || score < choice.score) choice = { score, road };
  }
  if (choice) {
    const road = choice.road;
    return { x: (road.ax + road.bx) / 2, y: (road.ay + road.by) / 2, angle: Math.atan2(road.bx - road.ax, road.ay - road.by) * 180 / Math.PI, speed: 0 };
  }
  const road = nearestRoad(near, 500);
  return { x: road?.x ?? near.x, y: road?.y ?? near.y, angle: road?.angle ?? 0, speed: 0 };
}

export function stepDrive(car: CarState, throttle: number, steer: number, dt: number, boost = false, handbrake = false): CarState {
  const accelerating = throttle > 0 && car.speed >= 0 || throttle < 0 && car.speed <= 0;
  const force = throttle === 0 ? 0 : accelerating ? throttle * (boost ? 125 : 77) : throttle * 120;
  let speed = Math.max(-28, Math.min(boost ? 108 : 76, car.speed + force * dt));
  if (throttle === 0) speed *= Math.exp(-2.2 * dt);
  if (handbrake) speed *= Math.exp(-6 * dt);
  if (Math.abs(speed) < .12) speed = 0;

  // Steering needs motion. Reverse gear turns the nose in the opposite direction.
  const grip = Math.min(1, Math.abs(speed) / 20);
  const angle = car.angle + steer * Math.sign(speed) * (35 + (handbrake ? 160 : 100) * grip) * dt;
  const radians = angle * Math.PI / 180;
  let x = car.x + Math.sin(radians) * speed * dt;
  let y = car.y - Math.cos(radians) * speed * dt;
  const road = nearestRoad({ x, y }, 30);
  if (!road) return { ...car, angle, speed: 0 };
  const edge = road.radius - 2;
  if (road.distance > edge) {
    const factor = edge / road.distance;
    x = road.x + (x - road.x) * factor;
    y = road.y + (y - road.y) * factor;
    speed *= .48;
  }
  return { x, y, angle, speed };
}
