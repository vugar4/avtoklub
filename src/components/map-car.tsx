"use client";

import { useEffect, useRef, useState } from "react";
import { CarFront } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export default function MapCar() {
  const host = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" }); } catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(176, 176);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.setAttribute("aria-hidden", "true");
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
    camera.position.set(2.4, 7.8, 5.3);
    camera.lookAt(0, .55, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8595ab, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(-4, 9, 5);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xa4caff, .7);
    fill.position.set(5, 5, -6);
    scene.add(fill);

    let disposed = false;
    const loader = new GLTFLoader();
    loader.load("/models/sports-car.glb", gltf => {
      if (disposed) return;
      const model = gltf.scene;
      const tintedMaterials = new Set<THREE.Material>();
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (tintedMaterials.has(material)) continue;
          tintedMaterials.add(material);
          if (!(material instanceof THREE.MeshStandardMaterial)) continue;
          if (material.name.includes("hubcap_coral")) material.color.set("#1769dc");
          if (!material.name.includes("body_pbr") || !material.map) continue;
          const source = material.map.image as CanvasImageSource & { width: number; height: number };
          const canvas = document.createElement("canvas");
          canvas.width = source.width;
          canvas.height = source.height;
          const context = canvas.getContext("2d");
          if (!context) continue;
          context.drawImage(source, 0, 0);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          for (let index = 0; index < image.data.length; index += 4) {
            const red = image.data[index], green = image.data[index + 1], blue = image.data[index + 2];
            if (red > 95 && red > green * 1.23 && red > blue * 1.2) {
              const shade = Math.max(.55, Math.min(1.2, red / 205));
              image.data[index] = 17 * shade;
              image.data[index + 1] = 85 * shade;
              image.data[index + 2] = 220 * shade;
            }
          }
          context.putImageData(image, 0, 0);
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = false;
          material.map = texture;
          material.needsUpdate = true;
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 4.2 / Math.max(size.x, size.z);
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      scene.add(model);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshBasicMaterial({ color: 0x132139, transparent: true, opacity: .17, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.y = 1.45;
      shadow.position.y = -.035;
      scene.add(shadow);
      renderer.render(scene, camera);
      setLoaded(true);
    });
    return () => {
      disposed = true;
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return <div ref={host} className={`map-car-model ${loaded ? "map-car-loaded" : ""}`} aria-hidden="true"><span className="map-car-fallback"><CarFront size={35}/></span></div>;
}
