// @ts-nocheck — pre-existing: @react-three/fiber is not installed
"use client";

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CameraRigProps {
  activeTool: string | null;
}

export function CameraRig({ activeTool }: CameraRigProps) {
  const currentLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  
  // Vectors to avoid GC allocation in the render loop
  const tempTargetPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 7.2));
  const tempTargetLook = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Initialize starting look-at
  useEffect(() => {
    currentLookAt.current.set(0, 0, 0);
  }, []);

  useFrame((state, delta) => {
    if (activeTool !== null) {
      // Sidebar Mode: Move camera left, looking at the left-shifted processing core
      tempTargetPos.current.set(-2.2, 0.4, 6.0);
      tempTargetLook.current.set(-3.2, 0.4, -1.0);
    } else {
      // Center Mode: Normal centered view of the dashboard core and nodes
      tempTargetPos.current.set(0, 0, 7.2);
      tempTargetLook.current.set(0, 0, 0);
    }

    // Frame-rate independent smooth interpolation
    const lerpFactor = 1 - Math.pow(0.001, delta);
    const safeLerp = Math.min(lerpFactor, 0.08); // Clamp to prevent jumping on slow frames

    state.camera.position.lerp(tempTargetPos.current, safeLerp);
    currentLookAt.current.lerp(tempTargetLook.current, safeLerp);
    state.camera.lookAt(currentLookAt.current);
  });

  return null;
}
