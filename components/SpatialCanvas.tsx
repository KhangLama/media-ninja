// @ts-nocheck — pre-existing: @react-three/fiber is not installed
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles, Html } from "@react-three/drei";
import { useLanguage } from "./LanguageContext";
import { CameraRig } from "./CameraRig";
import { ToolMesh } from "./ToolMesh";
import * as THREE from "three";

// 1. Tool Configurations (Orbit arrangement)
const toolsData = [
  {
    id: "compress",
    icon: "📷",
    titleKey: "tool_image_title",
    color: "#06b6d4", // Cyan
    geometryType: "icosahedron",
    fileTypes: ["image"],
  },
  {
    id: "video",
    icon: "🎥",
    titleKey: "tool_video_title",
    color: "#a855f7", // Purple
    geometryType: "videoReel",
    fileTypes: ["video"],
  },
  {
    id: "subtitle",
    icon: "🎙️",
    titleKey: "tool_subtitle_title",
    color: "#3b82f6", // Blue
    geometryType: "saturnSphere",
    fileTypes: ["video"],
  },
  {
    id: "pdf",
    icon: "📄",
    titleKey: "tool_pdf_title",
    color: "#ef4444", // Red
    geometryType: "paperBox",
    fileTypes: ["pdf"],
  },
  {
    id: "ocr",
    icon: "🔍",
    titleKey: "tool_ocr_title",
    color: "#eab308", // Yellow
    geometryType: "magnifyingCylinder",
    fileTypes: ["image", "pdf"],
  },
  {
    id: "qr",
    icon: "📱",
    titleKey: "tool_qr_title",
    color: "#10b981", // Emerald
    geometryType: "qrGrid",
    fileTypes: ["image"],
  },
];

// 2. WarpGate Component: Neon ring that rotates slowly
function WarpGate({ position, color }: { position: [number, number, number]; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 0.15;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <torusGeometry args={[3.2, 0.015, 12, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.15} />
    </mesh>
  );
}

// 3. IntroPanel Component: Glassmorphic panel floating at the starting point
function IntroPanel() {
  const { t, language } = useLanguage();

  return (
    <Html position={[0, 0.4, 3.2]} center distanceFactor={8} pointerEvents="none">
      <div className="w-[92vw] max-w-xl p-5 sm:p-8 backdrop-blur-md bg-neutral-950/50 border border-white/10 rounded-2xl text-center flex flex-col gap-4 sm:gap-6 text-white select-none pointer-events-none shadow-[0_0_80px_rgba(0,0,0,0.8)]">
        <div>
          <p className="mb-1 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-cyan-400">
            {t("hero_tagline")}
          </p>
          <h1 className="text-2xl sm:text-4xl font-semibold text-white tracking-tight leading-tight">
            {t("hero_title")}
          </h1>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-neutral-300">
            {t("hero_description")}
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-2 border-t border-b border-white/5 py-3 text-center">
          <div>
            <div className="text-lg sm:text-2xl font-bold text-cyan-400">0</div>
            <div className="text-[9px] sm:text-[10px] text-neutral-400 uppercase tracking-wider mt-0.5">{t("metric_server_upload")}</div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-bold text-purple-400">6</div>
            <div className="text-[9px] sm:text-[10px] text-neutral-400 uppercase tracking-wider mt-0.5">{t("metric_media_tools")}</div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-bold text-emerald-400">100%</div>
            <div className="text-[9px] sm:text-[10px] text-neutral-400 uppercase tracking-wider mt-0.5">{t("metric_local_first")}</div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5 animate-pulse mt-0.5">
          <span className="text-[10px] sm:text-xs text-neutral-400 font-medium uppercase tracking-widest">
            {language === "vi" ? "Cuộn chuột để bắt đầu" : "Scroll to explore"}
          </span>
          <span className="text-lg text-cyan-400">↓</span>
        </div>
      </div>
    </Html>
  );
}

// 4. HolographicCore Component: Central 3D core that morphs to the left when active
function HolographicCore({ activeTool }: { activeTool: string | null }) {
  const coreRef = useRef<THREE.Group>(null);
  const shurikenRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Target vectors for position interpolation
  const tempTargetPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  useFrame((state, delta) => {
    if (!coreRef.current || !shurikenRef.current || !ringRef.current) return;

    // A. Smooth morph position (center vs left sidebar)
    if (activeTool !== null) {
      // Morph position to the left side
      tempTargetPos.current.set(-3.6, 0.4, -0.8);
    } else {
      // Center position
      const floatOffset = Math.sin(state.clock.getElapsedTime() * 0.8) * 0.15;
      tempTargetPos.current.set(0, floatOffset, 0);
    }

    coreRef.current.position.lerp(tempTargetPos.current, 0.08);

    // B. Fast spin in processing mode, slow spin in idle mode
    const rotSpeed = activeTool !== null ? 7.0 : 1.2; // Spin like a thrown weapon when active!
    shurikenRef.current.rotation.z += delta * rotSpeed; // Flat spin on Z-axis
    shurikenRef.current.rotation.x += delta * 0.15;     // Slow wobble tilt

    ringRef.current.rotation.y += delta * (rotSpeed * 0.4);
    ringRef.current.rotation.x += delta * 0.2;
  });

  const coreColor = activeTool !== null ? "#a855f7" : "#06b6d4";

  return (
    <group ref={coreRef}>
      {/* 3D Holographic Shuriken (Ninja Star) */}
      <group ref={shurikenRef}>
        {/* Central Disc */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.12, 16]} />
          <meshPhysicalMaterial
            color={coreColor}
            roughness={0.15}
            metalness={0.8}
            emissive={coreColor}
            emissiveIntensity={activeTool !== null ? 2.0 : 0.6}
          />
        </mesh>
        
        {/* Inner Ring Accents (white highlight) */}
        <mesh position={[0, 0, 0.07]}>
          <torusGeometry args={[0.18, 0.02, 8, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, -0.07]}>
          <torusGeometry args={[0.18, 0.02, 8, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* 4 Pointed Blades */}
        {/* Top Blade */}
        <mesh position={[0, 0.65, 0]}>
          <coneGeometry args={[0.18, 0.7, 4]} />
          <meshPhysicalMaterial
            color={coreColor}
            roughness={0.15}
            metalness={0.85}
            emissive={coreColor}
            emissiveIntensity={1.0}
          />
        </mesh>
        {/* Bottom Blade */}
        <mesh position={[0, -0.65, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.18, 0.7, 4]} />
          <meshPhysicalMaterial
            color={coreColor}
            roughness={0.15}
            metalness={0.85}
            emissive={coreColor}
            emissiveIntensity={1.0}
          />
        </mesh>
        {/* Left Blade */}
        <mesh position={[-0.65, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.18, 0.7, 4]} />
          <meshPhysicalMaterial
            color={coreColor}
            roughness={0.15}
            metalness={0.85}
            emissive={coreColor}
            emissiveIntensity={1.0}
          />
        </mesh>
        {/* Right Blade */}
        <mesh position={[0.65, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.18, 0.7, 4]} />
          <meshPhysicalMaterial
            color={coreColor}
            roughness={0.15}
            metalness={0.85}
            emissive={coreColor}
            emissiveIntensity={1.0}
          />
        </mesh>
      </group>

      {/* Orbiting Gyro Slash Ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1.5, 0.015, 12, 64]} />
        <meshPhysicalMaterial
          color="#a855f7"
          emissive="#a855f7"
          emissiveIntensity={activeTool !== null ? 2.5 : 1.0}
        />
      </mesh>

      <pointLight distance={6} intensity={4} color={coreColor} />
    </group>
  );
}

// 5. LaserLink Component: Thin cylinder representing a neon data cable
function LaserLink({
  start,
  end,
  color,
  visible,
  isHighlighted,
  isDimmed,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  visible: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Calculate midpoint, length, and rotation to face the core
  const x = end[0];
  const y = end[1];
  const length = Math.sqrt(x * x + y * y);
  const angle = Math.atan2(y, x);

  // Animate laser scale and opacity
  useFrame((state) => {
    if (meshRef.current) {
      // Smoothly transition scale to 0 if nodes are hidden
      const targetScale = visible ? 1.0 : 0.0;
      meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, targetScale, 0.1);
    }
  });

  const opacityValue = isHighlighted
    ? 0.9
    : isDimmed
    ? 0.02
    : 0.25;

  return (
    <mesh
      ref={meshRef}
      position={[x / 2, y / 2, 0]}
      rotation={[0, 0, angle + Math.PI / 2]}
      scale={[1, 1, 1]}
    >
      <cylinderGeometry args={[0.008, 0.008, length, 8]} />
      <meshBasicMaterial color={color} transparent opacity={opacityValue} />
    </mesh>
  );
}

// 6. InteractiveWorkbench Component: Dynamic scale wrapper based on viewport width
interface InteractiveWorkbenchProps {
  activeTool: string | null;
  draggedFileType: string | null;
  onSelectTool: (toolId: string) => void;
}

function InteractiveWorkbench({ activeTool, draggedFileType, onSelectTool }: InteractiveWorkbenchProps) {
  const { width, height } = useThree((state) => state.viewport);
  const radius = 2.7; // Compacted orbit (was 3.15) to prevent any edge clipping

  // Scale down the entire group as the viewport width/height shrinks to prevent clipping.
  // Standard desktop viewport at Z=0 typically has width ~ 9.5, height ~ 6.5.
  // We account for the header/footer overlays by using a conservative height divisor (9.8).
  // When activeTool is open, the canvas is on the left side (35% width), and the core is focused,
  // so we use a stable scale (1.0) to prevent the core from shrinking.
  const responsiveScale = activeTool !== null
    ? 1.0
    : Math.min(1.0, width / 11.8, height / 9.8);

  return (
    <group scale={[responsiveScale, responsiveScale, responsiveScale]}>
      {/* Holographic Core */}
      <HolographicCore activeTool={activeTool} />

      {/* Orbit Nodes and Laser Links */}
      {toolsData.map((tool, idx) => {
        // Orbit Coordinates
        const angle = idx * (Math.PI / 3); // 6 tools, spaced 60 degrees apart
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius * 0.58; // Flatter oval distribution for safer vertical bounds
        const z = 0;

        // Drag-and-Drop Highlights
        const matchesDrag = draggedFileType !== null && tool.fileTypes.includes(draggedFileType);
        const isHighlighted = matchesDrag;
        const isDimmed = draggedFileType !== null && !matchesDrag;

        // Nodes scale to 0 (hidden) when activeTool opens
        const nodeVisible = activeTool === null;

        return (
          <group key={tool.id} visible={nodeVisible || activeTool === tool.id}>
            {/* Laser connecting core to this node */}
            {nodeVisible && (
              <LaserLink
                start={[0, 0, 0]}
                end={[x, y, z]}
                color={tool.color}
                visible={nodeVisible}
                isHighlighted={isHighlighted}
                isDimmed={isDimmed}
              />
            )}

            {/* Orbiting Interactive Tool Node */}
            {(nodeVisible || activeTool === tool.id) && (
              <group scale={nodeVisible ? [1, 1, 1] : [0, 0, 0]}>
                <ToolMesh
                  toolId={tool.id}
                  icon={tool.icon}
                  titleKey={tool.titleKey}
                  position={[x, y, z]}
                  color={tool.color}
                  geometryType={tool.geometryType}
                  isHighlighted={isHighlighted}
                  isDimmed={isDimmed}
                  onClick={() => onSelectTool(tool.id)}
                />
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

// 7. Main Exportable Component
interface SpatialCanvasProps {
  activeTool: string | null;
  draggedFileType: string | null;
  onSelectTool: (toolId: string) => void;
}

export default function SpatialCanvas({ activeTool, draggedFileType, onSelectTool }: SpatialCanvasProps) {
  return (
    <div className="w-full h-full select-none outline-none bg-neutral-950">
      <Canvas
        camera={{ position: [0, 0, 7.2], fov: 60, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#050505")); // Dark space theme
        }}
      >
        {/* Lights */}
        <ambientLight intensity={0.35} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={1.5} color="#06b6d4" />
        <pointLight position={[10, 10, -30]} intensity={1.0} color="#a855f7" />

        {/* Dual-color Sparkle Nebulae */}
        <Sparkles count={140} scale={20} size={2.2} speed={0.3} color="#22d3ee" />
        <Sparkles count={80} scale={24} size={1.5} speed={0.2} color="#a855f7" />

        {/* Camera Controller */}
        <CameraRig activeTool={activeTool} />

        {/* Responsive Interactive Workbench */}
        <InteractiveWorkbench
          activeTool={activeTool}
          draggedFileType={draggedFileType}
          onSelectTool={onSelectTool}
        />
      </Canvas>
    </div>
  );
}
