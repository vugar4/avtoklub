"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const ROAD_WIDTH = 5.1;
const PATH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-9, 0, -10),
  new THREE.Vector3(-6.5, 0, -6),
  new THREE.Vector3(-4.5, 0, -2.5),
  new THREE.Vector3(-1.5, 0, 0),
  new THREE.Vector3(1.7, 0, 1.3),
  new THREE.Vector3(4.6, 0, 4),
  new THREE.Vector3(7, 0, 8),
  new THREE.Vector3(8.5, 0, 11),
]);

function roadPoint(t: number, offset = 0) {
  const point = PATH.getPoint(t);
  const tangent = PATH.getTangent(t).normalize();
  const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
  return point.addScaledVector(side, offset);
}

function strip(start: number, end: number, offset: number, width: number, height: number, steps = 96) {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index <= steps; index++) {
    const t = start + (end - start) * index / steps;
    const left = roadPoint(t, offset - width / 2);
    const right = roadPoint(t, offset + width / 2);
    vertices.push(left.x, height, left.z, right.x, height, right.z);
    uvs.push(0, t * 12, 1, t * 12);
    if (index < steps) {
      const at = index * 2;
      indices.push(at, at + 2, at + 1, at + 1, at + 2, at + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function asphaltTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#383d42";
    context.fillRect(0, 0, 256, 256);
    for (let index = 0; index < 6500; index++) {
      const x = (index * 73.67) % 256;
      const y = (index * 139.31 + Math.sin(index * 9.13) * 100) % 256;
      context.fillStyle = index % 3 ? "rgba(255,255,255,.045)" : "rgba(0,0,0,.09)";
      context.fillRect(x, y, index % 5 ? 1 : 2, index % 5 ? 1 : 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export default function HeroRoad() {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let visible = true;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      queueMicrotask(() => setState("error"));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = "hero-road-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    camera.position.set(9, 18, 13);
    camera.lookAt(0, 0, 0.8);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd7dee4, 2.4));
    const light = new THREE.DirectionalLight(0xffffff, 3.0);
    light.position.set(-6, 14, 6);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -14;
    light.shadow.camera.right = 14;
    light.shadow.camera.top = 14;
    light.shadow.camera.bottom = -14;
    light.shadow.bias = -0.0002;
    scene.add(light);

    const texture = asphaltTexture();
    const roadMaterial = new THREE.MeshStandardMaterial({ map: texture, color: 0xd9dcdf, roughness: 0.95, side: THREE.DoubleSide });
    const shoulder = new THREE.Mesh(strip(0, 1, 0, ROAD_WIDTH + 0.56, -0.02), new THREE.MeshStandardMaterial({ color: 0xb7bdc3, roughness: 1, side: THREE.DoubleSide }));
    const road = new THREE.Mesh(strip(0, 1, 0, ROAD_WIDTH, 0), roadMaterial);
    road.receiveShadow = true;
    scene.add(shoulder, road);

    const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xf4f5f4, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      scene.add(new THREE.Mesh(strip(0, 1, side * (ROAD_WIDTH / 2 - 0.22), 0.085, 0.015), edgeMaterial));
    }
    const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xe7e9e9, side: THREE.DoubleSide });
    for (let index = 1; index < 30; index++) {
      const start = index / 30;
      scene.add(new THREE.Mesh(strip(start, Math.min(start + 0.014, 1), 0, 0.075, 0.022, 3), dashMaterial));
    }

    const car = new THREE.Group();
    scene.add(car);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let travel = 0.32;
    let last = 0;
    const render = (time: number) => {
      if (!visible || document.hidden) return;
      if (last && !reducedMotion.matches) travel += Math.min((time - last) / 1000, 0.05) * 0.045;
      if (travel > 0.83) travel = 0.22;
      last = time;
      const position = roadPoint(travel, ROAD_WIDTH * 0.25);
      const tangent = PATH.getTangent(travel);
      car.position.set(position.x, 0.03, position.z);
      car.rotation.y = Math.atan2(tangent.x, tangent.z);
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(render);

    const resize = () => {
      const width = Math.max(1, element.clientWidth);
      const height = Math.max(1, element.clientHeight);
      const aspect = width / height;
      const extent = 10;
      camera.left = -extent * aspect;
      camera.right = extent * aspect;
      camera.top = extent;
      camera.bottom = -extent;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    resize();
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) last = 0;
    });
    intersection.observe(element);

    new GLTFLoader().load("/models/car-concept.glb", gltf => {
      if (disposed) return;
      const model = gltf.scene;
      model.traverse(object => {
        if (object.name === "License Plate") object.visible = false;
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const recolor = (material: THREE.Material) => {
          if (!(material instanceof THREE.MeshStandardMaterial) || !material.name.includes("Paint 1 Carmine")) return material;
          const yellow = material.clone();
          yellow.color.set("#ffcc00");
          yellow.metalness = 0.38;
          yellow.roughness = 0.24;
          return yellow;
        };
        object.material = Array.isArray(object.material) ? object.material.map(recolor) : recolor(object.material);
      });
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const middle = bounds.getCenter(new THREE.Vector3());
      const scale = 3.45 / Math.max(size.x, size.z);
      model.scale.setScalar(scale);
      model.position.set(-middle.x * scale, -bounds.min.y * scale, -middle.z * scale);
      car.add(model);
      setState("ready");
    }, undefined, () => {
      if (!disposed) setState("error");
    });

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      intersection.disconnect();
      resizeObserver.disconnect();
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      });
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="hero-road" role="img" aria-label="Perspektivli yol üzərində hərəkət edən sarı üçölçülü avtomobil">
    {state !== "ready" && <div className="hero-road-status" role="status">{state === "error" ? "3D avtomobil yüklənmədi" : "3D avtomobil yüklənir…"}</div>}
  </div>;
}
