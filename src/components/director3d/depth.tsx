import { useEffect, useState } from 'react';
import * as THREE from 'three';

function smoothDepthValues(values, width, height, passes) {
  let current = values;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(current.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        let count = 0;
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = x + offsetX;
            const sampleY = y + offsetY;
            if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
              sum += current[sampleY * width + sampleX];
              count += 1;
            }
          }
        }
        next[y * width + x] = sum / count;
      }
    }
    current = next;
  }
  return current;
}

interface DepthMeshModelProps {
  url: string;
  settings?: {
    invert?: boolean;
    near?: number;
    far?: number;
    fov?: number;
    density?: number;
    smoothing?: number;
  };
  color?: string;
  selected?: boolean;
}

function DepthMeshModel({ url, settings = {}, color, selected }: DepthMeshModelProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const invert = settings.invert ?? false;
  const near = Math.max(0.05, Number(settings.near ?? 0.8));
  const far = Math.max(near + 0.1, Number(settings.far ?? 6));
  const fov = THREE.MathUtils.clamp(Number(settings.fov ?? 60), 20, 120);
  const density = THREE.MathUtils.clamp(Math.round(Number(settings.density ?? 64)), 16, 128);
  const smoothing = THREE.MathUtils.clamp(Math.round(Number(settings.smoothing ?? 1)), 0, 4);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      const imageAspect = image.width / Math.max(1, image.height);
      const columns = imageAspect >= 1 ? density : Math.max(16, Math.round(density * imageAspect));
      const rows = imageAspect >= 1 ? Math.max(16, Math.round(density / imageAspect)) : density;
      const canvas = document.createElement('canvas');
      canvas.width = columns;
      canvas.height = rows;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, columns, rows);
      const pixels = context.getImageData(0, 0, columns, rows).data;
      let depthValues = new Float32Array(columns * rows);
      for (let index = 0; index < depthValues.length; index += 1) {
        const pixel = index * 4;
        depthValues[index] =
          (pixels[pixel] * 0.2126 + pixels[pixel + 1] * 0.7152 + pixels[pixel + 2] * 0.0722) / 255;
      }
      depthValues = smoothDepthValues(depthValues, columns, rows, smoothing);

      const positions = new Float32Array(columns * rows * 3);
      const fieldOfView = THREE.MathUtils.degToRad(fov);
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          const index = y * columns + x;
          const normalizedDepth = invert ? 1 - depthValues[index] : depthValues[index];
          const distance = near + normalizedDepth * (far - near);
          const halfHeight = Math.tan(fieldOfView / 2) * distance;
          const halfWidth = halfHeight * imageAspect;
          positions[index * 3] = ((x / Math.max(1, columns - 1)) * 2 - 1) * halfWidth;
          positions[index * 3 + 1] = (1 - (y / Math.max(1, rows - 1)) * 2) * halfHeight;
          positions[index * 3 + 2] = -(distance - near);
        }
      }

      const indices = [];
      for (let y = 0; y < rows - 1; y += 1) {
        for (let x = 0; x < columns - 1; x += 1) {
          const topLeft = y * columns + x;
          const topRight = topLeft + 1;
          const bottomLeft = topLeft + columns;
          const bottomRight = bottomLeft + 1;
          indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
        }
      }

      const nextGeometry = new THREE.BufferGeometry();
      nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      nextGeometry.setIndex(indices);
      nextGeometry.computeVertexNormals();
      nextGeometry.computeBoundingBox();
      nextGeometry.computeBoundingSphere();
      if (!cancelled) setGeometry(nextGeometry);
      else nextGeometry.dispose();
    };
    image.src = url;
    return () => {
      cancelled = true;
    };
  }, [url, invert, near, far, fov, density, smoothing]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry)
    return (
      <mesh>
        <planeGeometry args={[2.5, 1.4, 10, 6]} />
        <meshStandardMaterial color="#7f7b72" wireframe />
      </mesh>
    );
  return (
    <mesh geometry={geometry} castShadow receiveShadow={false}>
      <meshStandardMaterial
        color={selected ? '#f3dba5' : color || '#c9c4b8'}
        roughness={0.86}
        metalness={0.01}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export { smoothDepthValues, DepthMeshModel };
