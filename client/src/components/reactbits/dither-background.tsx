import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface DitherEffectProps {
  waveSpeed?: number;
  waveFrequency?: number;
  waveAmplitude?: number;
  waveColor?: [number, number, number];
  colorNum?: number;
  pixelSize?: number;
  disableAnimation?: boolean;
  enableMouseInteraction?: boolean;
  mouseRadius?: number;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uWaveSpeed;
  uniform float uWaveFrequency;
  uniform float uWaveAmplitude;
  uniform vec3 uWaveColor;
  uniform float uColorNum;
  uniform float uPixelSize;
  uniform bool uEnableMouseInteraction;
  uniform float uMouseRadius;

  varying vec2 vUv;

  float bayerMatrix8x8(vec2 uv) {
    const float bayer[64] = float[64](
      0.0, 32.0, 8.0, 40.0, 2.0, 34.0, 10.0, 42.0,
      48.0, 16.0, 56.0, 24.0, 50.0, 18.0, 58.0, 26.0,
      12.0, 44.0, 4.0, 36.0, 14.0, 46.0, 6.0, 38.0,
      60.0, 28.0, 52.0, 20.0, 62.0, 30.0, 54.0, 22.0,
      3.0, 35.0, 11.0, 43.0, 1.0, 33.0, 9.0, 41.0,
      51.0, 19.0, 59.0, 27.0, 49.0, 17.0, 57.0, 25.0,
      15.0, 47.0, 7.0, 39.0, 13.0, 45.0, 5.0, 37.0,
      63.0, 31.0, 55.0, 23.0, 61.0, 29.0, 53.0, 21.0
    );
    vec2 coords = floor(mod(uv * uResolution / uPixelSize, 8.0));
    int index = int(coords.x) + int(coords.y) * 8;
    return bayer[index] / 64.0;
  }

  void main() {
    vec2 uv = vUv;
    vec2 pixelatedUv = floor(uv * uResolution / uPixelSize) * uPixelSize / uResolution;
    
    float wave = sin(pixelatedUv.x * uWaveFrequency + uTime * uWaveSpeed) * uWaveAmplitude;
    wave += sin(pixelatedUv.y * uWaveFrequency * 0.5 + uTime * uWaveSpeed * 0.7) * uWaveAmplitude * 0.5;
    
    if (uEnableMouseInteraction) {
      vec2 mouseUv = uMouse;
      float dist = distance(pixelatedUv, mouseUv);
      if (dist < uMouseRadius) {
        float influence = 1.0 - (dist / uMouseRadius);
        wave += sin(dist * 20.0 - uTime * 3.0) * influence * 0.3;
      }
    }
    
    float brightness = 0.5 + wave;
    brightness = floor(brightness * uColorNum) / uColorNum;
    
    float dither = bayerMatrix8x8(uv);
    brightness = brightness + (dither - 0.5) / uColorNum;
    brightness = clamp(brightness, 0.0, 1.0);
    
    vec3 color = uWaveColor * brightness;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function DitherPlane({
  waveSpeed = 0.05,
  waveFrequency = 3,
  waveAmplitude = 0.3,
  waveColor = [0.5, 0.5, 0.5],
  colorNum = 4,
  pixelSize = 2,
  disableAnimation = false,
  enableMouseInteraction = true,
  mouseRadius = 0.3,
}: DitherEffectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size, viewport } = useThree();
  const mouse = useRef({ x: 0.5, y: 0.5 });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uWaveSpeed: { value: waveSpeed },
      uWaveFrequency: { value: waveFrequency },
      uWaveAmplitude: { value: waveAmplitude },
      uWaveColor: { value: new THREE.Vector3(...waveColor) },
      uColorNum: { value: colorNum },
      uPixelSize: { value: pixelSize },
      uEnableMouseInteraction: { value: enableMouseInteraction },
      uMouseRadius: { value: mouseRadius },
    }),
    [waveSpeed, waveFrequency, waveAmplitude, waveColor, colorNum, pixelSize, enableMouseInteraction, mouseRadius, size.width, size.height]
  );

  useFrame((state, delta) => {
    if (!disableAnimation && meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value += delta;
      material.uniforms.uMouse.value.set(mouse.current.x, mouse.current.y);
      material.uniforms.uResolution.value.set(size.width, size.height);
    }
  });

  return (
    <mesh
      ref={meshRef}
      scale={[viewport.width, viewport.height, 1]}
      onPointerMove={(e) => {
        mouse.current.x = e.uv?.x ?? 0.5;
        mouse.current.y = e.uv?.y ?? 0.5;
      }}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

interface DitherBackgroundProps extends DitherEffectProps {
  className?: string;
}

export function DitherBackground({
  className = "",
  ...props
}: DitherBackgroundProps) {
  return (
    <div className={`fixed inset-0 -z-10 ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 1], fov: 75 }}
        gl={{ antialias: false, alpha: false }}
        dpr={1}
      >
        <Suspense fallback={null}>
          <DitherPlane {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
