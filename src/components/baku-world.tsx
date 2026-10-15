"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import city from "./baku-city.json";
import roads from "./baku-roads.json";
import { project, type CarState, type Position } from "./drive-physics";

export type WorldStop = { id: string; title: string; point: Position; number: number };
type Props = { car: CarState; stops: WorldStop[]; overview: boolean; zoom: number; onStop: (id: string) => void };
const ORIGIN = project([49.855, 40.376]);
const world = (point: Position) => new THREE.Vector3(point.x - ORIGIN.x, 0, point.y - ORIGIN.y);
const roadWidth: Record<string, number> = { trunk: 29, trunk_link: 25, primary: 27, primary_link: 24, secondary: 25, secondary_link: 22, tertiary: 22, tertiary_link: 19, residential: 19, unclassified: 19, living_street: 16, service: 14 };

function polygonShape(coords: number[][]) {
  const shape = new THREE.Shape();
  coords.forEach((coord, index) => {
    const point = world(project(coord as [number, number]));
    if (index === 0) shape.moveTo(point.x, -point.z);
    else shape.lineTo(point.x, -point.z);
  });
  shape.closePath();
  return shape;
}

function roadMesh(widthExtra: number, height: number, color: number) {
  const positions: number[] = [];
  const push = (ax: number, az: number, bx: number, bz: number, half: number) => {
    const length = Math.hypot(bx - ax, bz - az);
    if (length < .001) return;
    const nx = -(bz - az) / length * half, nz = (bx - ax) / length * half;
    const a = [ax + nx, height, az + nz], b = [ax - nx, height, az - nz];
    const c = [bx + nx, height, bz + nz], d = [bx - nx, height, bz - nz];
    positions.push(...a, ...b, ...c, ...c, ...b, ...d);
  };
  for (const road of roads) {
    const width = (roadWidth[road.kind] ?? 18) + widthExtra;
    const points = (road.points as [number, number][]).map(point => world(project(point)));
    for (let index = 1; index < points.length; index++) push(points[index - 1].x, points[index - 1].z, points[index].x, points[index].z, width / 2);
    // Round the joins so the road does not break at turns.
    const steps = 9;
    for (const point of points) {
      for (let part = 0; part < steps; part++) {
        const a = part / steps * Math.PI * 2, b = (part + 1) / steps * Math.PI * 2;
        positions.push(point.x, height, point.z,
          point.x + Math.cos(a) * width / 2, height, point.z + Math.sin(a) * width / 2,
          point.x + Math.cos(b) * width / 2, height, point.z + Math.sin(b) * width / 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
}

function roadMarkings() {
  const vertices: number[] = [];
  for (const road of roads) {
    if (!["trunk", "primary", "secondary", "tertiary"].includes(road.kind)) continue;
    const points = (road.points as [number, number][]).map(point => world(project(point)));
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1], b = points[index];
      const length = a.distanceTo(b);
      if (length < 8) continue;
      const dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
      const nx = -dz * .55, nz = dx * .55;
      for (let distance = 4; distance + 9 < length; distance += 23) {
        const x1 = a.x + dx * distance, z1 = a.z + dz * distance;
        const x2 = a.x + dx * (distance + 9), z2 = a.z + dz * (distance + 9);
        vertices.push(x1 + nx, .13, z1 + nz, x1 - nx, .13, z1 - nz, x2 + nx, .13, z2 + nz,
          x2 + nx, .13, z2 + nz, x1 - nx, .13, z1 - nz, x2 - nx, .13, z2 - nz);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xe0e5e7, side: THREE.DoubleSide }));
}

function signTexture(number: number, title: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 150;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.roundRect(6, 8, 500, 130, 30); ctx.fill();
  ctx.fillStyle = "#2267db";
  ctx.beginPath(); ctx.arc(66, 73, 45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 40px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(number), 66, 75);
  ctx.fillStyle = "#6380ab"; ctx.font = "bold 20px Arial"; ctx.textAlign = "left"; ctx.fillText("AVTOKLUB", 128, 47);
  ctx.fillStyle = "#183360"; ctx.font = "bold 40px Arial"; ctx.fillText(title, 128, 94);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function recolor(model: THREE.Object3D) {
  const seen = new Set<THREE.Material>();
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (seen.has(material) || !(material instanceof THREE.MeshStandardMaterial)) continue;
      seen.add(material);
      if (material.name.includes("hubcap_coral")) material.color.set("#1769dc");
      if (!material.name.includes("body_pbr") || !material.map) continue;
      const source = material.map.image as CanvasImageSource & { width: number; height: number };
      const canvas = document.createElement("canvas");
      canvas.width = source.width; canvas.height = source.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(source, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < image.data.length; index += 4) {
        const red = image.data[index], green = image.data[index + 1], blue = image.data[index + 2];
        if (red > 95 && red > green * 1.23 && red > blue * 1.2) {
          const shade = Math.max(.55, Math.min(1.2, red / 205));
          image.data[index] = 17 * shade;
          image.data[index + 1] = 85 * shade;
          image.data[index + 2] = 220 * shade;
        }
      }
      ctx.putImageData(image, 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      material.map = texture;
      material.needsUpdate = true;
    }
  });
}

export default function BakuWorld({ car, stops, overview, zoom, onStop }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const carRef = useRef(car);
  const overviewRef = useRef(overview);
  const zoomRef = useRef(zoom);
  const onStopRef = useRef(onStop);
  useEffect(() => { carRef.current = car; }, [car]);
  useEffect(() => { overviewRef.current = overview; }, [overview]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { onStopRef.current = onStop; }, [onStop]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); } catch { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.style.display = "block";
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#9cc9ec");
    scene.fog = new THREE.Fog("#9cc9ec", 650, 1700);
    const camera = new THREE.OrthographicCamera(-200, 200, 125, -125, 1, 4000);
    camera.position.set(0, 230, 280);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x486547, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(-240, 500, 230);
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: "#9cc377" }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -.45;
    scene.add(ground);

    const parkMaterial = new THREE.MeshLambertMaterial({ color: "#83b963", side: THREE.DoubleSide });
    const parkGeometries: THREE.BufferGeometry[] = [];
    for (const polygon of city.green) {
      if (polygon.length < 3) continue;
      const geometry = new THREE.ShapeGeometry(polygonShape(polygon));
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, -.2, 0);
      parkGeometries.push(geometry);
    }
    const parks = mergeGeometries(parkGeometries);
    if (parks) scene.add(new THREE.Mesh(parks, parkMaterial));
    parkGeometries.forEach(geometry => geometry.dispose());
    scene.add(roadMesh(7, .03, 0xc0bba7));
    scene.add(roadMesh(0, .08, 0x374254));
    scene.add(roadMarkings());

    // Distinct roofs make the real street network readable at driving distance.
    const facades = [0xe9e7dc, 0xf0e3d3, 0xdadfe0, 0xf1ede3, 0xe3d5bf];
    const buildingGeometries: THREE.BufferGeometry[][] = facades.map(() => []);
    city.buildings.forEach((building, index) => {
      if (building.p.length < 3) return;
      const geometry = new THREE.ExtrudeGeometry(polygonShape(building.p), { depth: Math.min(building.h, 40), bevelEnabled: false });
      geometry.rotateX(-Math.PI / 2);
      buildingGeometries[index % facades.length].push(geometry);
    });
    buildingGeometries.forEach((geometries, index) => {
      const merged = mergeGeometries(geometries);
      if (merged) scene.add(new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: facades[index] })));
      geometries.forEach(geometry => geometry.dispose());
    });

    const treeTrunk = new THREE.CylinderGeometry(1.2, 1.5, 10, 5);
    const treeCrown = new THREE.DodecahedronGeometry(7, 0);
    const trunks = new THREE.InstancedMesh(treeTrunk, new THREE.MeshLambertMaterial({ color: 0x654a32 }), 180);
    const crowns = new THREE.InstancedMesh(treeCrown, new THREE.MeshLambertMaterial({ color: 0x397c39, flatShading: true }), 180);
    const dummy = new THREE.Object3D();
    let treeCount = 0;
    city.green.forEach((polygon, index) => {
      if (treeCount >= 180 || polygon.length < 4) return;
      const center = polygon.reduce((sum, coord) => { const p = world(project(coord as [number, number])); return { x: sum.x + p.x / polygon.length, z: sum.z + p.z / polygon.length }; }, { x: 0, z: 0 });
      if (Math.abs(center.x) > 1100 || Math.abs(center.z) > 1000) return;
      const scale = .7 + (index % 5) * .13;
      dummy.position.set(center.x, 4.5 * scale, center.z); dummy.scale.setScalar(scale); dummy.updateMatrix(); trunks.setMatrixAt(treeCount, dummy.matrix);
      dummy.position.y = 13 * scale; dummy.updateMatrix(); crowns.setMatrixAt(treeCount, dummy.matrix);
      treeCount++;
    });
    trunks.count = treeCount; crowns.count = treeCount;
    scene.add(trunks, crowns);

    const hitTargets: THREE.Object3D[] = [];
    stops.forEach(stop => {
      const center = world(stop.point);
      const group = new THREE.Group();
      group.position.copy(center);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(27, 48), new THREE.MeshBasicMaterial({ color: 0xe9e5d8, side: THREE.DoubleSide }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = .23; disc.userData.stopId = stop.id;
      group.add(disc); hitTargets.push(disc);
      const ring = new THREE.Mesh(new THREE.RingGeometry(25.8, 28.5, 48), new THREE.MeshBasicMaterial({ color: 0x2679ec, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .25; group.add(ring);
      const texture = signTexture(stop.number, stop.title);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
      sprite.position.y = 50; sprite.scale.set(88, 26, 1); sprite.userData.stopId = stop.id;
      group.add(sprite); hitTargets.push(sprite);
      scene.add(group);
    });

    const carGroup = new THREE.Group();
    scene.add(carGroup);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(13, 32), new THREE.MeshBasicMaterial({ color: 0x111a29, transparent: true, opacity: .3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .35;
    carGroup.add(shadow);
    let alive = true;
    new GLTFLoader().load("/models/sports-car.glb", gltf => {
      if (!alive) return;
      recolor(gltf.scene);
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 37 / Math.max(size.x, size.z);
      gltf.scene.scale.setScalar(scale);
      gltf.scene.position.set(-center.x * scale, -box.min.y * scale + .5, -center.z * scale);
      gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.renderOrder = 20;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          material.depthTest = false;
          material.depthWrite = false;
        }
      });
      carGroup.add(gltf.scene);
    });

    const resize = () => {
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      const halfHeight = Math.max(115, 190 * Math.min(1.25, 900 / height));
      const halfWidth = halfHeight * width / height;
      camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfHeight; camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false, dragged = false, lastPointerX = 0, orbitYaw = 0, lastLook = 0;
    const pointerDown = (event: PointerEvent) => { dragging = true; dragged = false; lastPointerX = event.clientX; renderer.domElement.setPointerCapture(event.pointerId); };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging || overviewRef.current) return;
      const delta = event.clientX - lastPointerX;
      if (Math.abs(delta) > 1) dragged = true;
      orbitYaw = Math.max(-1.7, Math.min(1.7, orbitYaw + delta * .006));
      lastPointerX = event.clientX;
      lastLook = performance.now();
    };
    const pointerUp = () => { dragging = false; };
    const click = (event: MouseEvent) => {
      if (dragged) { dragged = false; return; }
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hitTargets, false)[0];
      if (hit?.object.userData.stopId) onStopRef.current(hit.object.userData.stopId as string);
    };
    renderer.domElement.addEventListener("click", click);
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", pointerUp);

    const startCar = carRef.current;
    const startPoint = world(startCar);
    const startBearing = startCar.angle * Math.PI / 180;
    const startForwardX = Math.sin(startBearing), startForwardZ = -Math.cos(startBearing);
    const startMobile = element.clientWidth < 600;
    const startBehind = startMobile ? 75 : 110;
    const startAhead = startMobile ? 32 : 62;
    const cameraAt = new THREE.Vector3(startPoint.x - startForwardX * startBehind, startMobile ? 175 : 190, startPoint.z - startForwardZ * startBehind);
    const lookAt = new THREE.Vector3(startPoint.x + startForwardX * startAhead, 0, startPoint.z + startForwardZ * startAhead);
    camera.position.copy(cameraAt);
    camera.lookAt(lookAt);
    let animation = 0, previous = 0;
    const render = (time: number) => {
      const dt = Math.min(.05, (time - (previous || time)) / 1000);
      previous = time;
      const current = carRef.current;
      const point = world(current);
      const rad = current.angle * Math.PI / 180;
      if (!dragging && time - lastLook > 1200) orbitYaw *= Math.exp(-dt * 1.3);
      const cameraBearing = rad + orbitYaw;
      const fx = Math.sin(cameraBearing), fz = -Math.cos(cameraBearing);
      carGroup.position.copy(point);
      carGroup.rotation.y = -rad;
      const overviewMode = overviewRef.current;
      const zoomLevel = zoomRef.current;
      const mobile = element.clientWidth < 600;
      camera.zoom = overviewMode ? .23 : zoomLevel;
      camera.updateProjectionMatrix();
      const desired = overviewMode
        ? new THREE.Vector3(0, 950 / zoomLevel, 5)
        : new THREE.Vector3(point.x - fx * (mobile ? 75 : 110), (mobile ? 175 : 190) / zoomLevel, point.z - fz * (mobile ? 75 : 110));
      const desiredLook = overviewMode ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(point.x + fx * (mobile ? 32 : 62), 0, point.z + fz * (mobile ? 32 : 62));
      const factor = 1 - Math.exp(-dt * (overviewMode ? 2.4 : 5));
      cameraAt.lerp(desired, factor); lookAt.lerp(desiredLook, factor);
      camera.position.copy(cameraAt);
      camera.lookAt(lookAt);
      renderer.render(scene, camera);
      animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render);
    return () => {
      alive = false;
      cancelAnimationFrame(animation);
      observer.disconnect();
      renderer.domElement.removeEventListener("click", click);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) return;
        if (object instanceof THREE.Mesh) object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
          if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [stops]);
  return <div ref={host} className="drive-world" aria-label="Bakı küçələrinin üçölçülü sürüş xəritəsi" />;
}
