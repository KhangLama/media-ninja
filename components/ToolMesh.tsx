// @ts-nocheck — pre-existing: @react-three/fiber is not installed
"use client";

import React, { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useLanguage } from "./LanguageContext";

interface ToolMeshProps {
  toolId: string;
  icon: string;
  titleKey: string;
  position: [number, number, number];
  color: string;
  geometryType: string;
  isHighlighted: boolean; // True when this tool matches the dragged file type
  isDimmed: boolean;      // True when another tool matches the dragged file type
  onClick: () => void;
}

export function ToolMesh({
  toolId,
  icon,
  titleKey,
  position,
  color,
  geometryType,
  isHighlighted,
  isDimmed,
  onClick,
}: ToolMeshProps) {
  const meshRef = useRef<THREE.Group>(null);
  const scannerRingRef = useRef<THREE.Mesh>(null);
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);

  // Animate the rotation and local floating
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Gentle float (sine wave)
    const floatOffset = Math.sin(state.clock.getElapsedTime() * 1.2 + position[0]) * 0.12;
    meshRef.current.position.y = floatOffset;

    // Slow rotation
    const rotSpeed = hovered || isHighlighted ? 0.7 : 0.15;
    meshRef.current.rotation.y += delta * rotSpeed;
    meshRef.current.rotation.x += delta * (rotSpeed * 0.2);

    // Sliding ring for OCR scanner
    if (geometryType === "magnifyingCylinder" && scannerRingRef.current) {
      scannerRingRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 2.2) * 0.45;
    }
  });

  // Calculate rendering scale based on hover, highlighted, and dimmed states
  const scaleValue = isHighlighted
    ? 1.45 // Glow/enlarge for matching dropped file
    : isDimmed
    ? 0.55 // Shrink/fade for unmatched files
    : hovered
    ? 1.18 // Hover zoom
    : 1.0;

  // Pulse effect when file is dragged over this node
  const pulseIntensity = isHighlighted
    ? 1.5 + Math.sin(Date.now() * 0.01) * 0.4
    : hovered
    ? 1.0
    : 0.1;

  return (
    <group position={position}>
      {/* 3D Geometry Wrapper */}
      <group
        ref={meshRef}
        scale={[scaleValue, scaleValue, scaleValue]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!isDimmed) {
            setHovered(true);
            document.body.style.cursor = "pointer";
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = "default";
        }}
      >
        <ToolShape
          geometryType={geometryType}
          color={color}
          hovered={hovered || isHighlighted}
          pulseIntensity={pulseIntensity}
          scannerRingRef={scannerRingRef}
          isDimmed={isDimmed}
        />
      </group>

      {/* Floating 2D label */}
      <Html
        position={[0, -0.92, 0]}
        center
        distanceFactor={7.5}
        pointerEvents="none"
      >
        <div
          className={[
            "flex flex-col items-center pointer-events-none select-none text-center transition-all duration-300",
            isDimmed ? "opacity-20 scale-75" : "opacity-100 scale-100",
          ].join(" ")}
        >
          <span
            className={[
              "text-2xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] select-none",
              isHighlighted ? "animate-bounce text-3xl" : "animate-none",
            ].join(" ")}
          >
            {icon}
          </span>
          <p
            className={[
              "mt-1.5 font-bold text-[10px] tracking-widest text-neutral-200 uppercase whitespace-nowrap bg-neutral-950/80 px-2 py-0.5 rounded border shadow-lg transition-colors",
              isHighlighted ? "border-cyan-400 text-cyan-300" : "border-white/5",
            ].join(" ")}
          >
            {t(titleKey)}
          </p>
        </div>
      </Html>
    </group>
  );
}

/* ── Custom shapes renderer based on geometryType ── */
interface ToolShapeProps {
  geometryType: string;
  color: string;
  hovered: boolean;
  pulseIntensity: number;
  scannerRingRef: React.RefObject<THREE.Mesh | null>;
  isDimmed: boolean;
}

function ToolShape({
  geometryType,
  color,
  hovered,
  pulseIntensity,
  scannerRingRef,
  isDimmed,
}: ToolShapeProps) {
  const emissiveColor = hovered ? color : "#000000";
  const opacityValue = isDimmed ? 0.25 : 1.0;

  const physicalMaterial = (
    <meshPhysicalMaterial
      color={color}
      roughness={0.1}
      metalness={0.9}
      clearcoat={1.0}
      clearcoatRoughness={0.05}
      emissive={emissiveColor}
      emissiveIntensity={pulseIntensity}
      transparent={isDimmed}
      opacity={opacityValue}
    />
  );

  switch (geometryType) {
    case "icosahedron":
      // Image Studio: Ninja Smoke Bomb
      return (
        <group>
          {/* Bomb Sphere Body */}
          <mesh>
            <sphereGeometry args={[0.42, 32, 32]} />
            <meshPhysicalMaterial
              color={color}
              roughness={0.2}
              metalness={0.8}
              emissive={emissiveColor}
              emissiveIntensity={pulseIntensity}
              transparent={isDimmed}
              opacity={opacityValue}
            />
          </mesh>
          {/* Metallic Top Cap */}
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.1, 12]} />
            <meshPhysicalMaterial color="#ffffff" roughness={0.3} metalness={0.9} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Fuse Cord */}
          <mesh position={[0.08, 0.54, 0]} rotation={[0, 0, -0.4]}>
            <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={hovered ? 2.0 : 0.8} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Inner Glowing Core */}
          <mesh>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={hovered ? 0.3 : 0.0} />
          </mesh>
        </group>
      );

    case "videoReel":
      // Video Processor: Crossed Katanas + Play Symbol
      return (
        <group>
          {/* Katana 1 */}
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <cylinderGeometry args={[0.012, 0.012, 1.4, 8]} />
            <meshStandardMaterial color="#ffffff" metalness={0.9} roughness={0.1} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Katana 1 Handle */}
          <mesh position={[-0.5, -0.5, 0]} rotation={[0, 0, Math.PI / 4]}>
            <cylinderGeometry args={[0.022, 0.022, 0.3, 8]} />
            <meshStandardMaterial color="#27272a" transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Katana 2 */}
          <mesh rotation={[0, 0, -Math.PI / 4]}>
            <cylinderGeometry args={[0.012, 0.012, 1.4, 8]} />
            <meshStandardMaterial color="#ffffff" metalness={0.9} roughness={0.1} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Katana 2 Handle */}
          <mesh position={[0.5, -0.5, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <cylinderGeometry args={[0.022, 0.022, 0.3, 8]} />
            <meshStandardMaterial color="#27272a" transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Centered Glowing Play Symbol (pyramid pointing right) */}
          <mesh position={[-0.03, 0.04, 0.08]} rotation={[Math.PI / 2, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.24, 0.38, 3]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={hovered ? 3.0 : 1.5}
              transparent={isDimmed}
              opacity={opacityValue}
            />
          </mesh>
        </group>
      );

    case "saturnSphere":
      // Subtitle Generator: Temple Gong (Audio/Sound Wave)
      return (
        <group>
          {/* Frame Top Bar */}
          <mesh position={[0, 0.44, 0]}>
            <boxGeometry args={[0.9, 0.05, 0.05]} />
            <meshStandardMaterial color="#27272a" transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Frame Side Bar 1 */}
          <mesh position={[-0.4, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.8, 12]} />
            <meshStandardMaterial color="#27272a" transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Frame Side Bar 2 */}
          <mesh position={[0.4, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.8, 12]} />
            <meshStandardMaterial color="#27272a" transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Hanging Gong Plate */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 24]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={hovered ? 2.5 : 1.2}
              transparent={isDimmed}
              opacity={opacityValue}
            />
          </mesh>
          {/* Sonic rings (soundwaves radiating) */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42, 0.012, 8, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={isDimmed ? 0.1 : 0.6} />
          </mesh>
        </group>
      );

    case "paperBox":
      // PDF Suite: Rolled Ninja Scroll
      return (
        <group rotation={[0, 0, -Math.PI / 6]}>
          {/* Scroll Body (Parchment Paper) */}
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 0.9, 16]} />
            <meshPhysicalMaterial
              color="#fef08a" // Aged yellow parchment paper
              roughness={0.6}
              metalness={0.1}
              transparent={isDimmed}
              opacity={opacityValue}
            />
          </mesh>
          {/* Wooden Roller Core End Left */}
          <mesh position={[0, -0.49, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.07, 12]} />
            <meshStandardMaterial color="#78350f" transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Wooden Roller Core End Right */}
          <mesh position={[0, 0.49, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.07, 12]} />
            <meshStandardMaterial color="#78350f" transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Red Tie Ribbon (Glowing Red PDF branding band) */}
          <mesh>
            <cylinderGeometry args={[0.21, 0.21, 0.22, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={hovered ? 2.8 : 1.4}
              transparent={isDimmed}
              opacity={opacityValue}
            />
          </mesh>
        </group>
      );

    case "magnifyingCylinder":
      // OCR Text Extractor: Unfolded Scroll with Kanji/Runes and Laser Scanner
      return (
        <group>
          {/* Scroll Left Roller */}
          <mesh position={[-0.38, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.9, 12]} />
            <meshStandardMaterial color="#78350f" transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Scroll Right Roller */}
          <mesh position={[0.38, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.9, 12]} />
            <meshStandardMaterial color="#78350f" transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Unrolled Parchment Sheet */}
          <mesh position={[0, 0, -0.01]}>
            <boxGeometry args={[0.68, 0.78, 0.015]} />
            <meshStandardMaterial
              color="#fef08a" // Parchment
              roughness={0.7}
              metalness={0.1}
              transparent={isDimmed}
              opacity={opacityValue}
            />
          </mesh>
          {/* Abstract Glowing Runes/Lines */}
          <mesh position={[0, 0.18, 0.01]}>
            <boxGeometry args={[0.36, 0.035, 0.01]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          <mesh position={[0, 0.0, 0.01]}>
            <boxGeometry args={[0.4, 0.035, 0.01]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          <mesh position={[0, -0.18, 0.01]}>
            <boxGeometry args={[0.34, 0.035, 0.01]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Sliding Scanning Laser Line */}
          <mesh ref={scannerRingRef} position={[0, 0, 0.02]}>
            <boxGeometry args={[0.74, 0.025, 0.025]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={color}
              emissiveIntensity={hovered ? 3.5 : 2.0}
              transparent={isDimmed}
              opacity={opacityValue}
            />
          </mesh>
        </group>
      );

    case "qrGrid":
      // QR Customizer & Scanner: Ninja QR Talisman (Fuda Card)
      return (
        <group rotation={[0, 0.2, 0.15]}>
          {/* Talisman Amulet Card (Paper) */}
          <mesh>
            <boxGeometry args={[0.54, 1.05, 0.015]} />
            <meshStandardMaterial
              color="#fef08a" // Aged paper
              roughness={0.8}
              transparent={isDimmed}
              opacity={opacityValue}
            />
          </mesh>
          {/* Emerald Amulet Border */}
          <mesh>
            <boxGeometry args={[0.58, 1.09, 0.01]} />
            <meshStandardMaterial
              color={color}
              wireframe
              transparent
              opacity={isDimmed ? 0.2 : 0.6}
            />
          </mesh>
          {/* Red header seal */}
          <mesh position={[0, 0.4, 0.01]}>
            <boxGeometry args={[0.26, 0.12, 0.01]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.0} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Emerald QR Seals */}
          {/* Top target seal */}
          <mesh position={[0, 0.16, 0.01]}>
            <boxGeometry args={[0.14, 0.14, 0.01]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          {/* Center matrix patterns */}
          <mesh position={[-0.08, -0.05, 0.01]}>
            <boxGeometry args={[0.07, 0.14, 0.01]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          <mesh position={[0.08, -0.11, 0.01]}>
            <boxGeometry args={[0.07, 0.16, 0.01]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          <mesh position={[-0.04, -0.24, 0.01]}>
            <boxGeometry args={[0.12, 0.07, 0.01]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
          <mesh position={[0.04, -0.34, 0.01]}>
            <boxGeometry args={[0.09, 0.07, 0.01]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent={isDimmed} opacity={opacityValue} />
          </mesh>
        </group>
      );

    default:
      return (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          {physicalMaterial}
        </mesh>
      );
  }
}
