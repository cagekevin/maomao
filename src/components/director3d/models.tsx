import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { poseForObject, presetDefinition } from './rig.ts';
import { log } from './log.ts';

// 内置人物模型：使用减面版（49k→15k 三角），蒙皮/骨骼/动画全保留，降低每帧渲染成本
// 原件 xbot-animated.glb 保留在 public/models/ 作回退
const BUILT_IN_MODEL_URL = `${import.meta.env.BASE_URL}models/xbot-animated-lod.glb`;
const whiteMaterial = { roughness: 0.78, metalness: 0.02 };

// 内置人物的场景高度（xbot 包围盒 ~1.6），作为导入模型的自动缩放目标
const PERSON_HEIGHT_TARGET = 1.6;

// 导入模型自动适配：按包围盒高度把模型缩放到内置人物高度，并让底部落地（positionY）。
// 解析失败回退 scale=1 / positionY=0（保持旧行为）。GLB 优先，.gltf 若带外部资源解析不了会走回退。
export function measureModelScale(
  buffer: ArrayBuffer,
): Promise<{ scale: number; positionY: number }> {
  return new Promise((resolve) => {
    try {
      const loader = new GLTFLoader();
      loader.parse(
        buffer,
        '',
        (gltf) => {
          try {
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const height = Math.max(1e-6, box.max.y - box.min.y);
            const scale = Math.min(100, Math.max(0.001, PERSON_HEIGHT_TARGET / height));
            resolve({ scale, positionY: -(box.min.y * scale) });
          } catch {
            resolve({ scale: 1, positionY: 0 });
          }
        },
        () => resolve({ scale: 1, positionY: 0 }),
      );
    } catch {
      resolve({ scale: 1, positionY: 0 });
    }
  });
}

const MIXAMO_BODY_SCALES = {
  standard: [1, 1, 1],
  tall: [0.95, 1.12, 0.95],
  broad: [1.14, 1.04, 1.1],
  female: [0.94, 0.98, 0.94],
  male: [1.08, 1.06, 1.08],
};

function dominantBoneNameFromHit(event) {
  const mesh = event.object;
  const face = event.face;
  const skinIndex = mesh?.geometry?.attributes?.skinIndex;
  const skinWeight = mesh?.geometry?.attributes?.skinWeight;
  const skeleton = mesh?.skeleton;
  if (!mesh?.isSkinnedMesh || !face || !skinIndex || !skinWeight || !skeleton) return null;

  const scores = new Map();
  for (const vertex of [face.a, face.b, face.c]) {
    for (let channel = 0; channel < 4; channel += 1) {
      const index = skinIndex.getComponent(vertex, channel);
      const weight = skinWeight.getComponent(vertex, channel);
      if (weight > 0) scores.set(index, (scores.get(index) || 0) + weight);
    }
  }
  let bestIndex = -1;
  let bestScore = -1;
  for (const [index, score] of scores) {
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  }
  return skeleton.bones[bestIndex]?.name || null;
}

const IK_CHAINS = {
  mixamorigLeftHand: ['mixamorigLeftForeArm', 'mixamorigLeftArm'],
  mixamorigRightHand: ['mixamorigRightForeArm', 'mixamorigRightArm'],
  mixamorigLeftFoot: ['mixamorigLeftLeg', 'mixamorigLeftUpLeg'],
  mixamorigRightFoot: ['mixamorigRightLeg', 'mixamorigRightUpLeg'],
};

function ikEffectorForJoint(jointId = '') {
  if (jointId.startsWith('mixamorigLeftHand')) return 'mixamorigLeftHand';
  if (jointId.startsWith('mixamorigRightHand')) return 'mixamorigRightHand';
  if (jointId.startsWith('mixamorigLeftFoot') || jointId.startsWith('mixamorigLeftToe'))
    return 'mixamorigLeftFoot';
  if (jointId.startsWith('mixamorigRightFoot') || jointId.startsWith('mixamorigRightToe'))
    return 'mixamorigRightFoot';
  return null;
}

function MixamoJointMarker({
  bone,
  jointId,
  selected,
  modelRoot,
  onSelectJoint,
  onBeginDrag,
  onDrag,
  onEndDrag,
}) {
  const markerRef = useRef(null);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const isFineBone = /Hand|Eye|End/.test(jointId);
  useFrame(() => {
    if (!bone || !markerRef.current || !modelRoot.current) return;
    bone.getWorldPosition(worldPosition);
    modelRoot.current.worldToLocal(worldPosition);
    markerRef.current.position.copy(worldPosition);
  });
  return (
    <mesh
      ref={markerRef}
      scale={selected ? 1.25 : 0.72}
      onPointerDown={(event) => {
        if (onBeginDrag?.(event, jointId)) return;
        event.stopPropagation();
        onSelectJoint?.(jointId);
      }}
      onPointerMove={onDrag}
      onPointerUp={onEndDrag}
      onPointerCancel={onEndDrag}
      renderOrder={8}
    >
      <sphereGeometry args={[isFineBone ? 0.012 : 0.022, 12, 8]} />
      <meshBasicMaterial
        color={selected ? '#ffd469' : '#bf9948'}
        transparent
        opacity={selected ? 0.98 : 0.28}
        depthTest={false}
      />
    </mesh>
  );
}

function MixamoIKHandle({ bone, jointId, selected, modelRoot, onBeginDrag, onDrag, onEndDrag }) {
  const markerRef = useRef(null);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!bone || !markerRef.current || !modelRoot.current) return;
    bone.getWorldPosition(worldPosition);
    modelRoot.current.worldToLocal(worldPosition);
    markerRef.current.position.copy(worldPosition);
  });
  return (
    <group
      ref={markerRef}
      onPointerDown={(event) => onBeginDrag?.(event, jointId)}
      onPointerMove={onDrag}
      onPointerUp={onEndDrag}
      onPointerCancel={onEndDrag}
    >
      <mesh scale={selected ? 1.18 : 1} renderOrder={10}>
        <octahedronGeometry args={[0.055, 0]} />
        <meshBasicMaterial
          color={selected ? '#8ee6d0' : '#55bca9'}
          transparent
          opacity={0.96}
          depthTest={false}
        />
      </mesh>
      <mesh renderOrder={9}>
        <sphereGeometry args={[0.09, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MixamoPersonModel({
  bodyType = 'standard',
  pose = 'idle',
  poseTime,
  continuousMotion = false,
  animationTime = 0,
  rigRoot,
  joints,
  footLock = false,
  color = '#e8e3d8',
  selected = false,
  selectedJoint,
  onSelectJoint,
  onRotateJoint,
  onRotateJoints,
  showBoneGizmo = false,
  onSurfacePointerDown,
  onSurfacePointerMove,
  onSurfacePointerUp,
}) {
  const gltf = useGLTF(BUILT_IN_MODEL_URL);
  const orbitControls = useThree((state) => state.controls) as unknown as {
    enabled: boolean;
  } | null;
  const invalidate = useThree((state) => state.invalidate);
  const camera = useThree((state) => state.camera) as unknown as
    (THREE.PerspectiveCamera & { fov?: number }) | null;
  const viewportSize = useThree((state) => state.size);
  const modelRoot = useRef(null);
  const rig = poseForObject({ pose, rigRoot, joints });
  const sampledRotations = useRef(new WeakMap());
  const boneDrag = useRef(null);
  const { scene, bones, bindTransforms, materials, mixer, clips } = useMemo(() => {
    const cloned = skeletonClone(gltf.scene);
    const nextBones: Record<string, THREE.Bone> = {};
    const nextBindTransforms = new WeakMap<
      THREE.Bone,
      { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }
    >();
    const nextMaterials: THREE.MeshStandardMaterial[] = [];

    cloned.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const bone = child as THREE.Bone;
        nextBones[bone.name] = bone;
        nextBindTransforms.set(bone, {
          position: bone.position.clone(),
          quaternion: bone.quaternion.clone(),
          scale: bone.scale.clone(),
        });
      }
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        const material = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.78,
          metalness: 0.02,
        });
        mesh.material = material;
        nextMaterials.push(material);
      }
    });

    return {
      scene: cloned,
      bones: nextBones,
      bindTransforms: nextBindTransforms,
      materials: nextMaterials,
      mixer: new THREE.AnimationMixer(cloned),
      clips: Object.fromEntries(gltf.animations.map((clip) => [clip.name, clip])),
    };
  }, [gltf, color]);

  useLayoutEffect(() => {
    mixer.stopAllAction();
    for (const bone of Object.values(bones)) {
      const bind = bindTransforms.get(bone);
      if (!bind) continue;
      bone.position.copy(bind.position);
      bone.quaternion.copy(bind.quaternion);
      bone.scale.copy(bind.scale);
    }

    const preset = presetDefinition(pose);
    const clip = preset.clip ? clips[preset.clip] : null;
    if (clip) {
      const action = mixer.clipAction(clip);
      action.reset().setLoop(THREE.LoopOnce, 0);
      action.clampWhenFinished = true;
      action.play();
      const basePhase = THREE.MathUtils.clamp(
        Number.isFinite(poseTime) ? poseTime : preset.phase,
        0,
        1,
      );
      const phase =
        continuousMotion && preset.loopable && preset.duration > 0
          ? (((basePhase + animationTime / preset.duration) % 1) + 1) % 1
          : basePhase;
      mixer.setTime(clip.duration * phase);
    }

    // P2：这里只改局部变换（骨骼 quaternion/position/scale），期间无人读取世界矩阵，
    // 因此不再调用 updateMatrixWorld；渲染器绘制前 + 本 effect 末尾各会更新一次，重复遍历反而浪费。
    const nextSampled = new WeakMap();
    const deltaEuler = new THREE.Euler();
    const deltaQuaternion = new THREE.Quaternion();
    for (const [jointId, bone] of Object.entries(bones)) {
      nextSampled.set(bone, bone.quaternion.clone());
      const rotation = rig.joints[jointId];
      if (!rotation) continue;
      deltaEuler.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0, 'XYZ');
      deltaQuaternion.setFromEuler(deltaEuler);
      bone.quaternion.multiply(deltaQuaternion).normalize();
    }
    sampledRotations.current = nextSampled;
    scene.updateMatrixWorld(true);
  }, [
    animationTime,
    bindTransforms,
    bones,
    clips,
    continuousMotion,
    mixer,
    pose,
    poseTime,
    rig.joints,
    scene,
  ]);

  useLayoutEffect(() => {
    const bodyColor = new THREE.Color(color);
    const selectionGlow = new THREE.Color('#4b3511');
    for (const material of materials) {
      material.color.copy(bodyColor);
      material.emissive.copy(selectionGlow);
      material.emissiveIntensity = selected ? 0.16 : 0;
      material.needsUpdate = true;
    }
  }, [color, materials, selected]);

  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
      materials.forEach((material) => material.dispose());
    },
    [materials, mixer, scene],
  );

  const beginIKDrag = useCallback(
    (event, jointId) => {
      const effectorId = ikEffectorForJoint(jointId);
      const chainIds = IK_CHAINS[effectorId];
      const effector = bones[effectorId];
      if (
        !selected ||
        !showBoneGizmo ||
        !onRotateJoints ||
        !effector ||
        !chainIds?.every((id) => bones[id])
      )
        return false;
      event.stopPropagation();
      event.nativeEvent?.stopImmediatePropagation?.();
      event.target?.setPointerCapture?.(event.pointerId);
      onSelectJoint?.(effectorId);
      scene.updateMatrixWorld(true);
      const startTarget = effector.getWorldPosition(new THREE.Vector3());
      const distance = Math.max(0.5, camera.position.distanceTo(startTarget));
      const fov = THREE.MathUtils.degToRad(camera.fov || 42);
      const worldPerPixel = (2 * Math.tan(fov / 2) * distance) / Math.max(1, viewportSize.height);
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      boneDrag.current = {
        kind: 'ik',
        pointerId: event.pointerId,
        jointId: effectorId,
        chainIds,
        startX: event.clientX,
        startY: event.clientY,
        startTarget,
        worldPerPixel,
        right,
        up,
        lockHeight: footLock && effectorId.includes('Foot'),
        startQuaternions: Object.fromEntries(
          chainIds.map((id) => [id, bones[id].quaternion.clone()]),
        ),
      };
      if (orbitControls) orbitControls.enabled = false;
      document.body.style.cursor = 'grabbing';
      return true;
    },
    [
      bones,
      camera,
      footLock,
      onRotateJoints,
      onSelectJoint,
      orbitControls,
      scene,
      selected,
      showBoneGizmo,
      viewportSize.height,
    ],
  );

  const beginBoneDrag = useCallback(
    (event, jointId) => {
      if (ikEffectorForJoint(jointId) && beginIKDrag(event, jointId)) return true;
      if (!selected || !showBoneGizmo || !onRotateJoint || !bones[jointId]) return false;
      event.stopPropagation();
      event.nativeEvent?.stopImmediatePropagation?.();
      event.target?.setPointerCapture?.(event.pointerId);
      onSelectJoint?.(jointId);
      const startRotation = rig.joints[jointId] || [0, 0, 0];
      boneDrag.current = {
        kind: 'joint',
        pointerId: event.pointerId,
        jointId,
        startX: event.clientX,
        startY: event.clientY,
        startRotation: [...startRotation],
        nextRotation: [...startRotation],
      };
      if (orbitControls) orbitControls.enabled = false;
      document.body.style.cursor = 'grabbing';
      return true;
    },
    [
      beginIKDrag,
      bones,
      onRotateJoint,
      onSelectJoint,
      orbitControls,
      rig.joints,
      selected,
      showBoneGizmo,
    ],
  );

  const dragBone = useCallback(
    (event) => {
      const drag = boneDrag.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.stopPropagation();
      if (drag.kind === 'ik') {
        for (const jointId of drag.chainIds)
          bones[jointId].quaternion.copy(drag.startQuaternions[jointId]);
        scene.updateMatrixWorld(true);
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        const target = drag.startTarget
          .clone()
          .addScaledVector(drag.right, dx * drag.worldPerPixel)
          .addScaledVector(drag.up, -dy * drag.worldPerPixel);
        if (drag.lockHeight) target.y = drag.startTarget.y;

        const effector = bones[drag.jointId];
        const jointPosition = new THREE.Vector3();
        const endPosition = new THREE.Vector3();
        const currentDirection = new THREE.Vector3();
        const targetDirection = new THREE.Vector3();
        const parentWorld = new THREE.Quaternion();
        const worldDelta = new THREE.Quaternion();
        const localDelta = new THREE.Quaternion();
        for (let iteration = 0; iteration < 10; iteration += 1) {
          for (const jointId of drag.chainIds) {
            const joint = bones[jointId];
            joint.getWorldPosition(jointPosition);
            effector.getWorldPosition(endPosition);
            currentDirection.copy(endPosition).sub(jointPosition);
            targetDirection.copy(target).sub(jointPosition);
            if (currentDirection.lengthSq() < 1e-8 || targetDirection.lengthSq() < 1e-8) continue;
            currentDirection.normalize();
            targetDirection.normalize();
            worldDelta.setFromUnitVectors(currentDirection, targetDirection);
            joint.parent.getWorldQuaternion(parentWorld);
            localDelta.copy(parentWorld).invert().multiply(worldDelta).multiply(parentWorld);
            joint.quaternion.premultiply(localDelta).normalize();
            scene.updateMatrixWorld(true);
          }
          effector.getWorldPosition(endPosition);
          if (endPosition.distanceToSquared(target) < 0.000025) break;
        }
        // frameloop="demand"：骨骼/IK 拖拽直接改骨骼（不经 React 提交），需手动触发重绘
        invalidate();
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const twist = Boolean(event.shiftKey || event.nativeEvent?.shiftKey);
      const nextRotation = twist
        ? [drag.startRotation[0], drag.startRotation[1], drag.startRotation[2] + dx * 0.012]
        : [
            drag.startRotation[0] - dy * 0.012,
            drag.startRotation[1] + dx * 0.012,
            drag.startRotation[2],
          ];
      const bone = bones[drag.jointId];
      const sampled = sampledRotations.current.get(bone);
      if (!bone || !sampled) return;
      const delta = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(nextRotation[0] || 0, nextRotation[1] || 0, nextRotation[2] || 0, 'XYZ'),
      );
      bone.quaternion.copy(sampled).multiply(delta).normalize();
      scene.updateMatrixWorld(true);
      drag.nextRotation = nextRotation;
      // frameloop="demand"：骨骼/IK 拖拽直接改骨骼（不经 React 提交），需手动触发重绘
      invalidate();
    },
    [bones, invalidate, scene],
  );

  const endBoneDrag = useCallback(
    (event) => {
      const drag = boneDrag.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.stopPropagation();
      event.target?.releasePointerCapture?.(event.pointerId);
      boneDrag.current = null;
      if (orbitControls) orbitControls.enabled = true;
      document.body.style.cursor = '';
      if (drag.kind === 'ik') {
        const rotations = {};
        const inverseSampled = new THREE.Quaternion();
        const delta = new THREE.Quaternion();
        const euler = new THREE.Euler();
        for (const jointId of drag.chainIds) {
          const bone = bones[jointId];
          const sampled = sampledRotations.current.get(bone);
          if (!sampled) continue;
          inverseSampled.copy(sampled).invert();
          delta.copy(inverseSampled).multiply(bone.quaternion).normalize();
          euler.setFromQuaternion(delta, 'XYZ');
          rotations[jointId] = [euler.x, euler.y, euler.z];
        }
        onRotateJoints?.(rotations);
      } else {
        onRotateJoint?.(drag.jointId, drag.nextRotation);
      }
    },
    [bones, onRotateJoint, onRotateJoints, orbitControls],
  );

  const beginBoneDragFromSurface = useCallback(
    (event) => {
      if (!selected || !showBoneGizmo) return;
      const jointId = dominantBoneNameFromHit(event);
      if (jointId) beginBoneDrag(event, jointId);
    },
    [beginBoneDrag, selected, showBoneGizmo],
  );

  const handleSurfacePointerDown = useCallback(
    (event) => {
      if (showBoneGizmo) beginBoneDragFromSurface(event);
      else onSurfacePointerDown?.(event);
    },
    [beginBoneDragFromSurface, onSurfacePointerDown, showBoneGizmo],
  );
  const handleSurfacePointerMove = useCallback(
    (event) => {
      if (showBoneGizmo) dragBone(event);
      else onSurfacePointerMove?.(event);
    },
    [dragBone, onSurfacePointerMove, showBoneGizmo],
  );
  const handleSurfacePointerUp = useCallback(
    (event) => {
      if (showBoneGizmo) endBoneDrag(event);
      else onSurfacePointerUp?.(event);
    },
    [endBoneDrag, onSurfacePointerUp, showBoneGizmo],
  );

  useEffect(
    () => () => {
      if (boneDrag.current) {
        document.body.style.cursor = '';
        if (orbitControls) orbitControls.enabled = true;
      }
    },
    [orbitControls],
  );

  const scale = MIXAMO_BODY_SCALES[bodyType] || MIXAMO_BODY_SCALES.standard;
  return (
    <group position={rig.root}>
      <group ref={modelRoot} scale={scale}>
        <primitive
          object={scene}
          onPointerDown={handleSurfacePointerDown}
          onPointerMove={handleSurfacePointerMove}
          onPointerUp={handleSurfacePointerUp}
          onPointerCancel={handleSurfacePointerUp}
        />
        {selected &&
          showBoneGizmo &&
          Object.entries(bones).map(([jointId, bone]) => (
            <MixamoJointMarker
              key={jointId}
              bone={bone}
              jointId={jointId}
              selected={selectedJoint === jointId}
              modelRoot={modelRoot}
              onSelectJoint={onSelectJoint}
              onBeginDrag={beginBoneDrag}
              onDrag={dragBone}
              onEndDrag={endBoneDrag}
            />
          ))}
        {selected &&
          showBoneGizmo &&
          Object.keys(IK_CHAINS).map((jointId) => (
            <MixamoIKHandle
              key={`ik-${jointId}`}
              bone={bones[jointId]}
              jointId={jointId}
              selected={selectedJoint === jointId}
              modelRoot={modelRoot}
              onBeginDrag={beginIKDrag}
              onDrag={dragBone}
              onEndDrag={endBoneDrag}
            />
          ))}
      </group>
    </group>
  );
}

class ModelErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // 记录渲染异常（走统一日志层，便于排查，不阻塞回退 UI）
  componentDidCatch(error: unknown, info: unknown) {
    log.error(
      '模型加载/渲染异常',
      error,
      (info as { componentStack?: string } | null)?.componentStack,
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function StudioPerson(props) {
  const fallback = (
    <mesh position={[0, 0.9, 0]} castShadow>
      <capsuleGeometry args={[0.28, 1.25, 8, 18]} />
      <meshStandardMaterial color={props.color || '#e8e3d8'} {...whiteMaterial} />
    </mesh>
  );
  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <MixamoPersonModel {...props} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

function ImportedModel({ url, selected }: { url: string; selected?: boolean }) {
  const gltf = useGLTF(url);
  const root = (Array.isArray(gltf) ? gltf[0] : gltf) as { scene?: THREE.Group };
  const scene = useMemo(() => skeletonClone(root.scene!), [root.scene]);
  useLayoutEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (selected && mesh.material) {
          const base = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          const cloned = (base as THREE.MeshStandardMaterial).clone();
          cloned.emissive = new THREE.Color('#312813');
          cloned.emissiveIntensity = 0.22;
          mesh.material = cloned as THREE.Material;
        }
      }
    });
  }, [scene, selected]);
  return <primitive object={scene} />;
}

export {
  MIXAMO_BODY_SCALES,
  dominantBoneNameFromHit,
  IK_CHAINS,
  ikEffectorForJoint,
  MixamoJointMarker,
  MixamoIKHandle,
  MixamoPersonModel,
  ModelErrorBoundary,
  StudioPerson,
  ImportedModel,
};
