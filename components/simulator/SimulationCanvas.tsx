"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { replaySimState } from "@/lib/simulation/engine";
import { useSimulatorStore } from "@/lib/store/simulator-store";
import {
  addScaled,
  buildTrajectory,
  len,
  missileAt,
  missileTangentAt,
  normalize,
  pathTotalDuration,
  sub,
} from "@/lib/simulation/trajectory";
import type { MissilePath, Vec3 } from "@/lib/simulation/types";

const HIT_RADIUS = 3.2;

function vec3(v: Vec3) {
  return new THREE.Vector3(v.x, v.y, v.z);
}

function MissileMesh({ color }: { color: string }) {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh position={[0, 1.2, 0]}>
        <coneGeometry args={[0.35, 1.2, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 1.4, 8]} />
        <meshStandardMaterial color="#ffffff" metalness={0.4} roughness={0.35} />
      </mesh>
    </group>
  );
}

function InterceptorMesh() {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh position={[0, 1.1, 0]}>
        <coneGeometry args={[0.32, 1, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#2ae500"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.2, 0.26, 1.2, 8]} />
        <meshStandardMaterial color="#e8e8e8" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

function CameraRig({
  missileRef,
  mode,
}: {
  missileRef: React.RefObject<THREE.Group | null>;
  mode: "orbital" | "cad" | "telemetry";
}) {
  const { camera, controls } = useThree();
  const temp = useMemo(() => new THREE.Vector3(), []);
  const smoothPos = useRef(new THREE.Vector3(90, 45, 90));

  useFrame(() => {
    const orb = controls as unknown as { enabled?: boolean; target?: THREE.Vector3 } | null;
    if (mode === "orbital") {
      if (orb) orb.enabled = true;
      return;
    }
    if (orb) orb.enabled = false;
    if (mode === "cad") {
      const target = smoothPos.current;
      target.lerp(new THREE.Vector3(0, 95, 0.1), 0.08);
      camera.position.lerp(target, 0.12);
      camera.lookAt(0, 0, 0);
      return;
    }
    if (mode === "telemetry" && missileRef.current) {
      missileRef.current.getWorldPosition(temp);
      const desired = temp.clone().add(new THREE.Vector3(-18, 10, 18));
      camera.position.lerp(desired, 0.1);
      camera.lookAt(temp);
    }
  });

  return null;
}

function SceneBody() {
  const missileRef = useRef<THREE.Group>(null);
  const interceptorRef = useRef<THREE.Group>(null);
  const explosionRef = useRef<THREE.Group>(null);
  const interceptorPos = useRef<Vec3 | null>(null);
  const visualHit = useRef(false);
  const prevPlayback = useRef<string | null>(null);

  const cameraMode = useSimulatorStore((s) => s.cameraMode);
  const playback = useSimulatorStore((s) => s.playback);
  const lastRun = useSimulatorStore((s) => s.lastRun);
  const scenario = useSimulatorStore((s) => s.scenario);
  const simTime = useSimulatorStore((s) => s.simTime);
  const setSimTime = useSimulatorStore((s) => s.setSimTime);
  const setPlayback = useSimulatorStore((s) => s.setPlayback);

  const preview = useMemo(() => buildTrajectory(scenario), [scenario]);
  const path: MissilePath = lastRun?.path ?? preview.path;
  const flightEnd = useMemo(() => pathTotalDuration(path), [path]);
  const run = lastRun;

  useFrame((_, delta) => {
    if (!missileRef.current || !interceptorRef.current) return;

    const dt = Math.min(delta, 0.05);

    if (playback === "idle" && !run) {
      const m = missileAt(path, 0);
      missileRef.current.position.copy(vec3(m));
      const tan = missileTangentAt(path, 0);
      missileRef.current.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        vec3(tan)
      );
      interceptorRef.current.position.copy(vec3(preview.interceptorStart));
      visualHit.current = false;
      if (explosionRef.current) explosionRef.current.visible = false;
      prevPlayback.current = playback;
      return;
    }

    if ((playback === "paused" || playback === "ended") && run) {
      const tEnd = Math.min(simTime, run.totalDurationSec);
      const s = replaySimState(run, tEnd);
      missileRef.current.position.copy(vec3(s.missile));
      const tan = missileTangentAt(run.path, Math.min(tEnd, flightEnd));
      missileRef.current.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        vec3(tan)
      );
      interceptorRef.current.position.copy(vec3(s.interceptor));
      if (explosionRef.current) {
        explosionRef.current.visible = s.explosionVisible;
        if (s.explosionVisible && s.explosionPos) {
          explosionRef.current.position.copy(vec3(s.explosionPos));
        }
      }
      prevPlayback.current = playback;
      return;
    }

    if (playback === "running" && run) {
      if (prevPlayback.current === "paused") {
        const s = replaySimState(run, simTime);
        interceptorPos.current = { ...s.interceptor };
        visualHit.current = s.visualHit;
      } else if (simTime < dt * 2) {
        interceptorPos.current = { ...run.interceptorStart };
        visualHit.current = false;
      }
      const t = simTime + dt;
      const mt = Math.min(t, flightEnd);
      const m = missileAt(run.path, mt);
      missileRef.current.position.copy(vec3(m));
      const tan = missileTangentAt(run.path, mt);
      missileRef.current.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        vec3(tan)
      );

      let int = interceptorPos.current!;
      const dist = len(sub(m, int));
      if (dist < HIT_RADIUS && !visualHit.current) {
        visualHit.current = true;
      }
      if (!visualHit.current) {
        const to = normalize(sub(m, int));
        int = addScaled(int, to, run.interceptorSpeed * dt);
        interceptorPos.current = int;
      }
      interceptorRef.current.position.copy(vec3(int));

      if (explosionRef.current) {
        explosionRef.current.visible = visualHit.current;
        if (visualHit.current) {
          explosionRef.current.position.copy(vec3(m));
        }
      }

      if (t >= run.totalDurationSec) {
        setPlayback("ended");
      }
      setSimTime(Math.min(t, run.totalDurationSec));
      prevPlayback.current = playback;
      return;
    }

    prevPlayback.current = playback;
  });

  const showScene = true;

  return (
    <>
      <color attach="background" args={["#0c0e12"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[40, 80, 30]} intensity={1.1} />
      <directionalLight position={[-30, 20, -20]} intensity={0.35} color="#98cbff" />
      <gridHelper args={[200, 40, "#2ae500", "#1a3320"]} position={[0, -0.5, 0]} />
      {showScene && (
        <>
          <group ref={missileRef}>
            <MissileMesh color="#ffb4ab" />
          </group>
          <group ref={interceptorRef}>
            <InterceptorMesh />
          </group>
          <group ref={explosionRef} visible={false}>
            <mesh>
              <sphereGeometry args={[2.2, 16, 16]} />
              <meshStandardMaterial
                color="#2ae500"
                emissive="#79ff5b"
                emissiveIntensity={2}
                transparent
                opacity={0.85}
              />
            </mesh>
            <pointLight intensity={8} distance={40} color="#79ff5b" />
          </group>
        </>
      )}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2 - 0.08}
        minDistance={15}
        maxDistance={220}
      />
      <CameraRig missileRef={missileRef} mode={cameraMode} />
    </>
  );
}

export default function SimulationCanvas() {
  return (
    <Canvas
      className="h-full w-full"
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [90, 45, 90], fov: 48, near: 0.1, far: 500 }}
    >
      <SceneBody />
    </Canvas>
  );
}
