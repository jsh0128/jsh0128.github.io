// gatsby-plugin-typescript 는 classic JSX 런타임(React.createElement)을 쓰므로 JSX 사용 시
// React 네임스페이스가 스코프에 있어야 한다. 레퍼런스(HeroScene3)는 automatic 런타임 전제라
// React import 가 없었는데, blog-v2 에선 이 import 가 없으면 런타임 "React is not defined".
import * as React from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import {
  type MutableRefObject,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  ClampToEdgeWrapping,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  type TextureDataType,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"

// blog-v2 Hero 배경(SPEC-BLOG-HERO-001). 이 센터피스는 실제 GPU 유체 시뮬레이션이다 —
// 고전적 실시간 오일러(Navier-Stokes) 솔버를 ping-pong 프레임버퍼 위 fragment-shader
// 패스 체인으로 돌린다("WebGL fluid simulation" 기법, GPU Gems ch.38). 포인터가 흐르는
// 잉크를 젓는다: 포인터 이동이 VELOCITY + dye 를 가우시안으로 주입하고, 솔버가 필드를
// advect 하고, curl+vorticity confinement 로 swirl 을 더하고, Jacobi 압력 투영으로
// 발산을 0 으로 만들어 잉크가 흐르고 swirl 하다 천천히 흩어진다.
//
// 레퍼런스(HeroScene3)와의 차이(SPEC-BLOG-HERO-001):
//  - 색을 하드코딩하지 않는다. DISPLAY 는 CSS 토큰(--color-bg/--color-brand/--color-heading)을
//    런타임에 읽어 모노크롬 잉크 유니폼(uColorBg/uColorInk/uColorHot)으로 렌더한다. 블렌드
//    모델 = mix(bg, ink, shaped(d)) 로 라이트(흰 배경 위 어두운 잉크·감산)·다크(어두운
//    배경 위 밝은 잉크·가산 glow) 양쪽에서 정상 렌더된다.
//  - 저해상 솔버(SIM 64 / DYE 128 / PRESSURE 10) + DPR 1.5 캡 + 뷰포트/탭 프레임루프 pause +
//    모바일/reduced-motion 정적 프레임 + context-loss 격하로 스크롤 읽기 블로그가 가볍게 유지된다.
//  - 모든 three / @react-three/fiber import 가 이 모듈에 캡슐화되어 lazy 청크로 격리된다
//    (초기 페이지 번들 미포함, REQ-BLOG-HERO-005 / AC-005-1).
// 색은 DISPLAY(sRGB) 공간에서 저작하고 toneMapped=false + 렌더러 NoToneMapping 으로
// 프레임버퍼에 직행한다(WYSIWYG — CSS 토큰 hex 가 셰이더 출력과 일치, 컴포지터 없음).

// ---------------------------------------------------------------------------
// 솔버 튜닝 상수(모두 안전한 기본값).
// ---------------------------------------------------------------------------

// 포인터 "strength"(splat 힘 램프)의 프레임레이트 독립 easing 비율(1/s). 매 프레임
// 1 - exp(-EASE_RATE * dt) 로 적용해 어떤 프레임레이트에서도 감각이 동일하다.
const EASE_RATE = 5.5
// 다운스케일 시뮬레이션 해상도(velocity / pressure / divergence / curl).
// 유체는 풀블리드 배경이라 정밀 시뮬레이션이 아니므로 낮춘다(레퍼런스 128 → 64).
const SIM_RESOLUTION = 64
// dye/색 필드 해상도 — 시뮬레이션의 ~2x 로 잉크 디테일을 살짝 더 살린다(레퍼런스 256 → 128).
const DYE_RESOLUTION = 128
// 압력 Poisson 솔브(∇²p = divergence)의 Jacobi 반복 수(레퍼런스 20 → 10). 배경 유체엔
// 충분한 비압축성 룩과 저비용의 균형.
const PRESSURE_ITERATIONS = 10
// 스텝당 압력 필드 감쇠(솔브를 안정화하는 완만한 누수).
const PRESSURE_DECAY = 0.8
// Vorticity confinement 강도 — 잉크를 살아있게 만드는 소규모 swirl 디테일.
const CURL_STRENGTH = 30
// Velocity 소산(1/s) — 낮게 두어 운동량이 남고 wake 가 트레일을 남긴다.
const VELOCITY_DISSIPATION = 0.2
// Dye 소산(1/s) — 잉크 색이 몇 초에 걸쳐 우아하게 사라진다.
const DENSITY_DISSIPATION = 0.6
// 원시 포인터 이동(UV delta)을 주입 velocity 로 바꾸는 강도.
const SPLAT_FORCE = 5200
// 가우시안 splat 반경 계수(falloff = exp(-dot(p,p) / radius)).
const SPLAT_RADIUS = 0.0022
// 포인터 splat 당 주입 dye 양(겹치면 누적 → 진한 코어).
const DYE_AMOUNT = 0.18
// 포인터가 유휴일 때 잔잔한 앰비언트 자동 splat 간격(초). 커서 없이도 잉크가 은은히
// 살아있게 한다(마우스 stir 가 여전히 주인공 — 이것은 느리고 옅다).
const IDLE_INTERVAL = 2.3

// 모바일/coarse-pointer 정적 매체 쿼리(REQ-BLOG-HERO-006 / AC-006-1).
const STATIC_MEDIA_QUERY = "(pointer: coarse), (max-width: 40rem)"
// 복구 불가능 컨텍스트 손실 누적 임계(레퍼런스 lostCount >= 3 과 일치, REQ-006 / AC-006-2).
const MAX_CONTEXT_LOSSES = 3
// DPR 캡(레퍼런스 2 → 1.5, REQ-BLOG-HERO-005 / AC-005-2).
const DPR_CAP = 1.5

// ---------------------------------------------------------------------------
// GLSL — 인라인 솔버 패스(three ShaderMaterial, GLSL ES 1.0 / WebGL2).
// planeGeometry(2,2) 가 xy 클립 공간 [-1,1] 을 덮으므로 vertex shader 는 카메라와
// 무관하게 position.xy 로 gl_Position 을 채운다. 이웃 텍셀 UV(vL/vR/vT/vB)를
// 미리 계산해 유한차분 패스(curl / divergence / pressure / gradient)에 쓴다.
// ---------------------------------------------------------------------------

const BASE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;
  void main() {
    vUv = uv;
    vL = uv - vec2(texelSize.x, 0.0);
    vR = uv + vec2(texelSize.x, 0.0);
    vT = uv + vec2(0.0, texelSize.y);
    vB = uv - vec2(0.0, texelSize.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// Semi-Lagrangian ADVECTION(역추적): 이 파셀이 한 스텝 전에 있던 곳에서 소스 필드를
// 샘플링한다. 하드웨어 LinearFilter 가 이중선형 보간을 담당. dissipation 이 시간에 따라 감쇠.
const ADVECTION_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;
  varying vec2 vUv;
  void main() {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = texture2D(uSource, coord);
    float decay = 1.0 + dissipation * dt;
    gl_FragColor = result / decay;
  }
`

// SPLAT: 한 점 주변에 `color`(velocity xy 또는 dye) 가우시안 버스트를 더한다. 필드의 다른
// 버퍼로 read-modify-write(ping-pong)해 GL 블렌딩 없이 splat 이 가산 누적된다.
const SPLAT_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`

// CURL(vorticity ω = ∂v/∂x − ∂u/∂y).
const CURL_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uVelocity;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
  }
`

// VORTICITY CONFINEMENT: 수치 소산이 뭉개는 vortex 쪽으로 velocity 를 밀어 잉크를 생동감 있게.
const VORTICITY_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float curl;
  uniform float dt;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * dt;
    velocity = clamp(velocity, -1000.0, 1000.0);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`

// DIVERGENCE(반사 경계) — 압력 Poisson 방정식의 우변.
const DIVERGENCE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uVelocity;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vL.x < 0.0) { L = -C.x; }
    if (vR.x > 1.0) { R = -C.x; }
    if (vT.y > 1.0) { T = -C.y; }
    if (vB.y < 0.0) { B = -C.y; }
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`

// CLEAR(상수배) — 스텝마다 압력을 완만히 감쇠.
const CLEAR_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float value;
  varying vec2 vUv;
  void main() {
    gl_FragColor = value * texture2D(uTexture, vUv);
  }
`

// PRESSURE — Poisson 솔브 ∇²p = divergence 의 Jacobi 1 반복.
const PRESSURE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`

// GRADIENT SUBTRACT — 압력 gradient 를 빼 velocity 를 발산 0 부분으로 투영(최종 투영 단계).
const GRADIENT_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`

// DISPLAY — 원본(HeroScene3)의 바이올렛 램프를 그대로 적용(사용자 지시). dye density 를
// 딥 퍼플-블랙 베이스 위 바이올렛→일렉트릭 바이올렛→마젠타로 올리고, 진한 코어는 1.0 을
// 넘겨 additive 로 발광(toneMapped=false + NoToneMapping → bloom 없이 in-shader 발광).
// 테마 무관 고정색 — 자체 딥 다크 베이스라 라이트/다크 모두 같은 발광 바이올렛으로 렌더된다.
const DISPLAY_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uDye;
  uniform sampler2D uVelocity;
  uniform vec3 uColorBg;
  uniform vec3 uColorInk;
  varying vec2 vUv;

  void main() {
    float d = texture2D(uDye, vUv).r;
    float speed = length(texture2D(uVelocity, vUv).xy) * 0.02;

    // 라이트모드 기준의 "정확한 반전"(포토네거티브): 배경↔몸통↔코어가 테마에 따라 그대로 뒤집힌다.
    //  - 라이트: 흰 배경(uColorBg) → 검은 몸통(uColorInk) → 흰 코어(다시 uColorBg).
    //  - 다크:   검은 배경(uColorBg) → 흰 몸통(uColorInk) → 검은 코어(다시 uColorBg).
    // uColorBg=--color-bg, uColorInk=--color-brand 가 테마마다 서로 반전되어 두 모드가 딱 반대 대비가 된다.
    vec3 col = mix(uColorBg, uColorInk, smoothstep(0.0, 0.5, d)); // 배경 → 몸통(반대색)
    col = mix(col, uColorBg, smoothstep(0.55, 1.3, d));           // 코어는 배경색으로 복귀(라이트=흰/다크=검정)
    // 코어 강조: 배경색 방향으로 살짝 오버드라이브(라이트=흰 코어 발광 / 다크=검정 additive 라 무효 → 대비만).
    col += uColorBg * smoothstep(0.85, 1.6, d) * 0.6;

    gl_FragColor = vec4(col, 1.0);
  }
`

// ---------------------------------------------------------------------------
// FluidSolver — 모든 렌더 타깃·머티리얼·풀스크린 quad 를 소유하고, R3F 렌더러로
// 멀티패스 Navier-Stokes 스텝을 명령형으로 구동한다.
// ---------------------------------------------------------------------------

/** ping-pong 렌더 타깃 쌍(현재 필드를 읽고 다음을 쓴다). */
interface DoubleFBO {
  read: WebGLRenderTarget
  write: WebGLRenderTarget
  swap(): void
}

/** #rgb / #rrggbb hex 를 vec3(0..1)로 방어적으로 파싱. hex 가 아니면(키워드 등) fallback. */
function parseHexColor(
  raw: string,
  fallback: readonly [number, number, number]
): [number, number, number] {
  const s = raw.trim()
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(s)
  if (!m) return [fallback[0], fallback[1], fallback[2]]
  const hex = m[1]
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16) / 255,
      parseInt(hex[1] + hex[1], 16) / 255,
      parseInt(hex[2] + hex[2], 16) / 255,
    ]
  }
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ]
}

// @MX:ANCHOR: [AUTO] 유체 솔버의 패스 순서가 곧 Navier-Stokes 투영법이다 — advect →
// curl → vorticity → divergence → pressure(Jacobi) → gradient-subtract → advect dye.
// 패스를 재정렬하거나 누락하면 비압축성과 유체 룩이 무너진다. 여기서 생성한 모든 렌더
// 타깃과 머티리얼은 반드시 dispose() 에서 해제해야 한다(유체 시뮬레이션은 많은 FBO 를 할당).
// @MX:REASON: 엄격한 패스 순서와 수동 GPU 자원 수명을 가진 다중-FBO GPU 솔버 —
// 이 불변식은 어떤 단일 메서드에서도 보이지 않는다.
class FluidSolver {
  private readonly gl: WebGLRenderer
  private readonly scene: Scene
  private readonly camera: OrthographicCamera
  private readonly geometry: PlaneGeometry
  private readonly mesh: Mesh
  private readonly type: TextureDataType

  // 매 프레임 재할당 없이 제자리 변형되는 공유 유니폼 백킹 객체.
  private readonly texel = new Vector2(1, 1)
  private readonly splatPoint = new Vector2()
  private readonly splatColor = new Vector3()

  // CSS 토큰 유래 모노크롬 색 유니폼(applyColors 에서 갱신). 컴포넌트 저작 색 없음.
  private readonly colorBg = new Vector3(1, 1, 1)
  private readonly colorInk = new Vector3(0.067, 0.067, 0.067)
  private readonly colorHot = new Vector3(0.08, 0.09, 0.12)

  // 필드 렌더 타깃(resize 에서 생성/재생성).
  private velocity: DoubleFBO | null = null
  private dye: DoubleFBO | null = null
  private pressure: DoubleFBO | null = null
  private divergence: WebGLRenderTarget | null = null
  private curl: WebGLRenderTarget | null = null

  private aspect = 1
  ready = false

  // 패스 머티리얼.
  private readonly advectionMat: ShaderMaterial
  private readonly splatMat: ShaderMaterial
  private readonly curlMat: ShaderMaterial
  private readonly vorticityMat: ShaderMaterial
  private readonly divergenceMat: ShaderMaterial
  private readonly clearMat: ShaderMaterial
  private readonly pressureMat: ShaderMaterial
  private readonly gradientMat: ShaderMaterial
  private readonly displayMat: ShaderMaterial

  constructor(gl: WebGLRenderer) {
    this.gl = gl
    this.type = pickTargetType(gl)
    this.scene = new Scene()
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.geometry = new PlaneGeometry(2, 2)
    this.mesh = new Mesh(this.geometry)
    this.mesh.frustumCulled = false
    this.scene.add(this.mesh)

    const make = (
      frag: string,
      uniforms: ShaderMaterial["uniforms"]
    ): ShaderMaterial =>
      new ShaderMaterial({
        vertexShader: BASE_VERTEX,
        fragmentShader: frag,
        uniforms: { texelSize: { value: this.texel }, ...uniforms },
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      })

    this.advectionMat = make(ADVECTION_FRAG, {
      uVelocity: { value: null },
      uSource: { value: null },
      dt: { value: 0 },
      dissipation: { value: 0 },
    })
    this.splatMat = make(SPLAT_FRAG, {
      uTarget: { value: null },
      aspectRatio: { value: 1 },
      color: { value: this.splatColor },
      point: { value: this.splatPoint },
      radius: { value: SPLAT_RADIUS },
    })
    this.curlMat = make(CURL_FRAG, { uVelocity: { value: null } })
    this.vorticityMat = make(VORTICITY_FRAG, {
      uVelocity: { value: null },
      uCurl: { value: null },
      curl: { value: CURL_STRENGTH },
      dt: { value: 0 },
    })
    this.divergenceMat = make(DIVERGENCE_FRAG, { uVelocity: { value: null } })
    this.clearMat = make(CLEAR_FRAG, {
      uTexture: { value: null },
      value: { value: PRESSURE_DECAY },
    })
    this.pressureMat = make(PRESSURE_FRAG, {
      uPressure: { value: null },
      uDivergence: { value: null },
    })
    this.gradientMat = make(GRADIENT_FRAG, {
      uPressure: { value: null },
      uVelocity: { value: null },
    })
    this.displayMat = make(DISPLAY_FRAG, {
      uDye: { value: null },
      uVelocity: { value: null },
      uColorBg: { value: this.colorBg },
      uColorInk: { value: this.colorInk },
      uColorHot: { value: this.colorHot },
    })
  }

  /** CSS 토큰(--color-bg/--color-brand/--color-heading)을 읽어 색 유니폼을 갱신.
   *  마운트 시와 data-theme 변경 시 호출된다(REQ-BLOG-HERO-003). */
  applyColors(): void {
    if (typeof document === "undefined") return
    const cs = getComputedStyle(document.documentElement)
    const bg = parseHexColor(cs.getPropertyValue("--color-bg"), [1, 1, 1])
    const ink = parseHexColor(
      cs.getPropertyValue("--color-brand"),
      [0.067, 0.067, 0.067]
    )
    const hot = parseHexColor(cs.getPropertyValue("--color-heading"), ink)
    this.colorBg.set(bg[0], bg[1], bg[2])
    this.colorInk.set(ink[0], ink[1], ink[2])
    this.colorHot.set(hot[0], hot[1], hot[2])
  }

  /** 새 캔버스 크기에 맞춰 모든 필드 렌더 타깃을 (재)할당. */
  resize(width: number, height: number): void {
    this.aspect = width / Math.max(height, 1)
    const sim = resolution(SIM_RESOLUTION, width, height)
    const dye = resolution(DYE_RESOLUTION, width, height)

    this.disposeTargets()
    this.velocity = this.createDouble(sim.width, sim.height)
    this.dye = this.createDouble(dye.width, dye.height)
    this.pressure = this.createDouble(sim.width, sim.height)
    this.divergence = this.createSingle(sim.width, sim.height)
    this.curl = this.createSingle(sim.width, sim.height)

    // 이웃 텍셀 오프셋은 SIM 필드의 텍셀 크기로 정의(유한차분 패스는 모두 sim 해상도에서 실행).
    this.texel.set(1 / sim.width, 1 / sim.height)
    this.ready = true
  }

  private createSingle(w: number, h: number): WebGLRenderTarget {
    const rt = new WebGLRenderTarget(w, h, {
      type: this.type,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    })
    rt.texture.generateMipmaps = false
    return rt
  }

  private createDouble(w: number, h: number): DoubleFBO {
    const fbo: DoubleFBO = {
      read: this.createSingle(w, h),
      write: this.createSingle(w, h),
      swap() {
        const tmp = this.read
        this.read = this.write
        this.write = tmp
      },
    }
    return fbo
  }

  /** `material` 을 풀스크린 quad 로 `target`(null = 캔버스)에 렌더. */
  private blit(
    target: WebGLRenderTarget | null,
    material: ShaderMaterial
  ): void {
    this.mesh.material = material
    this.gl.setRenderTarget(target)
    this.gl.render(this.scene, this.camera)
  }

  /** UV (x,y)에 velocity (dx,dy) + dye 가우시안 버스트를 주입. */
  splat(
    x: number,
    y: number,
    dx: number,
    dy: number,
    dyeAmount: number,
    radius = SPLAT_RADIUS
  ): void {
    if (!this.velocity || !this.dye) return
    this.splatMat.uniforms.aspectRatio!.value = this.aspect
    this.splatMat.uniforms.radius!.value = radius
    this.splatPoint.set(x, y)

    // Velocity 버스트.
    this.splatColor.set(dx, dy, 0)
    this.splatMat.uniforms.uTarget!.value = this.velocity.read.texture
    this.blit(this.velocity.write, this.splatMat)
    this.velocity.swap()

    // Dye 버스트(density 를 필드에 저장, DISPLAY 가 모노크롬 잉크로 매핑).
    this.splatColor.set(dyeAmount, dyeAmount, dyeAmount)
    this.splatMat.uniforms.uTarget!.value = this.dye.read.texture
    this.blit(this.dye.write, this.splatMat)
    this.dye.swap()
  }

  /** 유체를 한 타임스텝 전진(전체 Navier-Stokes 투영법). */
  // @MX:NOTE: [AUTO] 패스 순서는 load-bearing: advect velocity → curl → vorticity
  // confinement → divergence → clear+Jacobi pressure → gradient subtract(투영) →
  // advect dye. 각 패스가 자기 필드를 ping-pong 한다.
  step(dt: number): void {
    const { velocity, dye, pressure, divergence, curl } = this
    if (!velocity || !dye || !pressure || !divergence || !curl) return

    // 1. velocity 자기-advection(velocity 소산 포함).
    this.advectionMat.uniforms.uVelocity!.value = velocity.read.texture
    this.advectionMat.uniforms.uSource!.value = velocity.read.texture
    this.advectionMat.uniforms.dt!.value = dt
    this.advectionMat.uniforms.dissipation!.value = VELOCITY_DISSIPATION
    this.blit(velocity.write, this.advectionMat)
    velocity.swap()

    // 2. curl, 3. vorticity confinement(swirl 디테일).
    this.curlMat.uniforms.uVelocity!.value = velocity.read.texture
    this.blit(curl, this.curlMat)
    this.vorticityMat.uniforms.uVelocity!.value = velocity.read.texture
    this.vorticityMat.uniforms.uCurl!.value = curl.texture
    this.vorticityMat.uniforms.dt!.value = dt
    this.blit(velocity.write, this.vorticityMat)
    velocity.swap()

    // 4. velocity 필드의 divergence.
    this.divergenceMat.uniforms.uVelocity!.value = velocity.read.texture
    this.blit(divergence, this.divergenceMat)

    // 5. pressure: 이전 필드 감쇠 후 Jacobi 반복 ∇²p = div.
    this.clearMat.uniforms.uTexture!.value = pressure.read.texture
    this.blit(pressure.write, this.clearMat)
    pressure.swap()
    this.pressureMat.uniforms.uDivergence!.value = divergence.texture
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      this.pressureMat.uniforms.uPressure!.value = pressure.read.texture
      this.blit(pressure.write, this.pressureMat)
      pressure.swap()
    }

    // 6. gradient subtract — velocity 필드를 발산 0 으로(투영).
    this.gradientMat.uniforms.uPressure!.value = pressure.read.texture
    this.gradientMat.uniforms.uVelocity!.value = velocity.read.texture
    this.blit(velocity.write, this.gradientMat)
    velocity.swap()

    // 7. 발산 0 이 된 velocity 를 따라 dye 를 advect(우아하게 페이드).
    this.advectionMat.uniforms.uVelocity!.value = velocity.read.texture
    this.advectionMat.uniforms.uSource!.value = dye.read.texture
    this.advectionMat.uniforms.dissipation!.value = DENSITY_DISSIPATION
    this.blit(dye.write, this.advectionMat)
    dye.swap()
  }

  /** dye 필드를 모노크롬 잉크로 매핑해 캔버스에 직접 렌더. */
  renderDisplay(): void {
    if (!this.dye || !this.velocity) return
    this.displayMat.uniforms.uDye!.value = this.dye.read.texture
    this.displayMat.uniforms.uVelocity!.value = this.velocity.read.texture
    this.blit(null, this.displayMat)
  }

  /** 프레임이 즉시 살아있도록 부드러운 잉크 구름을 seed(정적 reduced-motion 프레임이기도
   *  하다). 큰, velocity 0 의 dye 블롭. */
  seed(): void {
    const blobs: ReadonlyArray<readonly [number, number]> = [
      [0.36, 0.62],
      [0.62, 0.5],
      [0.5, 0.72],
      [0.42, 0.36],
      [0.7, 0.64],
      [0.28, 0.46],
      [0.58, 0.3],
    ]
    for (const [x, y] of blobs) {
      this.splat(x, y, 0, 0, DYE_AMOUNT * 1.5, 0.02)
    }
  }

  private disposeTargets(): void {
    for (const fbo of [this.velocity, this.dye, this.pressure]) {
      fbo?.read.dispose()
      fbo?.write.dispose()
    }
    this.divergence?.dispose()
    this.curl?.dispose()
    this.velocity = null
    this.dye = null
    this.pressure = null
    this.divergence = null
    this.curl = null
  }

  /** 모든 GPU 자원(렌더 타깃, 머티리얼, 지오메트리) dispose. */
  dispose(): void {
    this.ready = false
    this.disposeTargets()
    for (const mat of [
      this.advectionMat,
      this.splatMat,
      this.curlMat,
      this.vorticityMat,
      this.divergenceMat,
      this.clearMat,
      this.pressureMat,
      this.gradientMat,
      this.displayMat,
    ]) {
      mat.dispose()
    }
    this.geometry.dispose()
  }
}

/** GPU 가 렌더+필터 가능하면 half-float(feature-detect), 아니면 비크래시 UnsignedByte 폴백. */
function pickTargetType(gl: WebGLRenderer): TextureDataType {
  const ctx = gl.getContext()
  const canHalfFloat =
    ctx.getExtension("EXT_color_buffer_float") !== null ||
    ctx.getExtension("EXT_color_buffer_half_float") !== null
  return canHalfFloat ? HalfFloatType : UnsignedByteType
}

/** 텍셀이 ~정사각이 되도록 종횡비 스케일된 필드 해상도(splat 이 늘어지지 않게). */
function resolution(
  res: number,
  width: number,
  height: number
): { width: number; height: number } {
  const aspect = width / Math.max(height, 1)
  const ratio = aspect < 1 ? 1 / aspect : aspect
  const min = res
  const max = Math.round(res * ratio)
  return width > height
    ? { width: max, height: min }
    : { width: min, height: max }
}

interface FluidSimProps {
  /** 정적 모드(reduced-motion 또는 모바일/coarse): 정적 seed 프레임 1 장만, 솔버 루프
   *  없음, 포인터 핸들러 없음(REQ-BLOG-HERO-006). */
  readonly staticMode: boolean
  /** Hero `<section>` 요소. 포인터-stir 리스너가 여기(캔버스가 아니라)에 붙어 위에 쌓인
   *  scrim 이 커서를 가로채지 않는다(REQ-BLOG-HERO-004). */
  readonly hostRef: RefObject<HTMLElement | null>
  /** 부모(HeroFluid)가 data-theme 변경 시 색 재적용을 트리거하도록 노출하는 콜백 슬롯. */
  readonly applyColorsRef: MutableRefObject<(() => void) | null>
}

/**
 * 살아있는 GPU 유체. R3F 렌더러에 대해 FluidSolver 를 만들고, Hero 섹션 포인터 stir 를
 * 배선하고, 렌더 우선순위 1 로 매 프레임 솔버를 구동한다(R3F 가 렌더 루프를 우리에게
 * 넘겨 패스 + 모노크롬 DISPLAY 를 우리가 직접 캔버스에 렌더 — WYSIWYG sRGB, 컴포지터 없음).
 * 정적 모드에서는 솔버 루프·포인터 핸들러를 건너뛰고 정적 seed 프레임 1 장을 그린다(부모가
 * frameloop="demand" 로 두고 invalidate 로 프레임을 요청). 언마운트 시 모든 GPU 자원 dispose.
 */
function FluidSim({ staticMode, hostRef, applyColorsRef }: FluidSimProps) {
  const gl = useThree(s => s.gl)
  const size = useThree(s => s.size)
  const invalidate = useThree(s => s.invalidate)
  const solverRef = useRef<FluidSolver | null>(null)
  const seeded = useRef(false)

  // UV [0,1] 원시 포인터 상태 + 프레임당 누적 이동 delta(유체를 seed 하는 포인터 velocity).
  const pointer = useRef({ x: 0.5, y: 0.5, dx: 0, dy: 0, moved: false })
  const strength = useRef(0)
  const idle = useRef(0)

  // 현재 렌더러로 솔버를 만들고 색을 적용; 언마운트 시 모든 GPU 자원 dispose(REQ-006).
  useEffect(() => {
    const solver = new FluidSolver(gl)
    solver.applyColors()
    solverRef.current = solver
    seeded.current = false
    return () => {
      solver.dispose()
      solverRef.current = null
    }
  }, [gl])

  // 필드 렌더 타깃을 캔버스 크기에 맞춤(마운트에서도 실행). 정적 모드면 프레임 1 장 요청.
  useEffect(() => {
    solverRef.current?.resize(size.width, size.height)
    if (staticMode) invalidate()
  }, [size, staticMode, invalidate])

  // 부모(HeroFluid)의 MutationObserver 가 data-theme 변경 시 호출할 색 재적용 슬롯.
  // 정적 모드에선 재틴트가 보이도록 프레임 1 장도 요청한다.
  useEffect(() => {
    applyColorsRef.current = () => {
      solverRef.current?.applyColors()
      if (staticMode) invalidate()
    }
    return () => {
      applyColorsRef.current = null
    }
  }, [applyColorsRef, staticMode, invalidate])

  // 포인터 stir 는 Hero SECTION(hostRef)에 부착 — 위에 쌓인 scrim 이 커서를 가로채지 않는다.
  // 프레임당 UV delta 를 주입 velocity 로 누적. 정적 모드면 부착하지 않는다(방어).
  useEffect(() => {
    if (staticMode) return
    const host = hostRef.current
    if (!host) return
    const onPointerMove = (event: PointerEvent): void => {
      const rect = host.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const x = (event.clientX - rect.left) / rect.width
      // Y 뒤집기: DOM 원점은 좌상단, UV 원점은 좌하단.
      const y = 1 - (event.clientY - rect.top) / rect.height
      const p = pointer.current
      p.dx += x - p.x
      p.dy += y - p.y
      p.x = x
      p.y = y
      p.moved = true
    }
    const onPointerLeave = (): void => {
      pointer.current.moved = false
    }
    host.addEventListener("pointermove", onPointerMove)
    host.addEventListener("pointerleave", onPointerLeave)
    return () => {
      host.removeEventListener("pointermove", onPointerMove)
      host.removeEventListener("pointerleave", onPointerLeave)
    }
  }, [hostRef, staticMode])

  // 렌더 우선순위 1 — R3F 가 자동 렌더를 끄고 루프를 우리에게 넘긴다. 솔버 패스(FBO)와
  // 모노크롬 DISPLAY(캔버스)를 우리가 실행한다.
  useFrame((state, delta) => {
    const solver = solverRef.current
    if (!solver || !solver.ready) return
    const dt = Math.min(delta, 0.033)

    if (staticMode) {
      // 정적 경로: 한 번 seed 하고 정적 프레임을 그린다. 시뮬레이션 없음.
      if (!seeded.current) {
        solver.seed()
        seeded.current = true
      }
      solver.renderDisplay()
      return
    }

    if (!seeded.current) {
      solver.seed()
      seeded.current = true
    }

    const ease = 1 - Math.exp(-EASE_RATE * dt)
    const p = pointer.current

    if (p.moved && (p.dx !== 0 || p.dy !== 0)) {
      // 커서가 개입할 때 stir 힘을 램프인(프레임레이트 독립).
      strength.current += (1 - strength.current) * ease
      const force = SPLAT_FORCE * (0.35 + 0.65 * strength.current)
      solver.splat(p.x, p.y, p.dx * force, p.dy * force, DYE_AMOUNT)
      p.dx = 0
      p.dy = 0
      idle.current = 0
    } else {
      strength.current += (0 - strength.current) * ease
    }

    // 포인터 유휴 시 잔잔한 앰비언트 자동 splat(마우스 stir 가 주인공, 이건 느리고 옅다).
    idle.current += dt
    if (idle.current > IDLE_INTERVAL) {
      idle.current = 0
      const tm = state.clock.elapsedTime
      const ax = 0.5 + 0.34 * Math.sin(tm * 0.63)
      const ay = 0.5 + 0.28 * Math.cos(tm * 0.47)
      const av = 240
      solver.splat(
        ax,
        ay,
        Math.cos(tm * 1.3) * av,
        Math.sin(tm * 1.1) * av,
        DYE_AMOUNT * 0.7
      )
    }

    solver.step(dt)
    solver.renderDisplay()
  }, 1)

  return null
}

/** 저전력 GPU 를 위해 런타임 DPR 을 1.5 로 캡(REQ-BLOG-HERO-005 / AC-005-2). */
function DprGuard() {
  const setDpr = useThree(s => s.setDpr)
  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio, DPR_CAP))
  }, [setDpr])
  return null
}

interface HeroFluidProps {
  /** WebGL 컨텍스트가 복구 불가능하게 손실됐을 때 호출(부모가 플랫 폴백으로 격하). */
  readonly onUnrecoverable: () => void
  /** Hero `<section>` 요소 — 포인터-stir 와 IntersectionObserver 가 여기에 붙는다. */
  readonly hostRef: RefObject<HTMLElement | null>
}

/**
 * 모노크롬 유체 센터피스의 R3F Canvas 래퍼. 모든 three / R3F import 를 캡슐화해 lazy
 * 청크로 격리(초기 페이지 번들 미포함, AC-005-1). 솔버가 캔버스에 직접 렌더 — 컴포지터
 * 없음; DISPLAY 머티리얼의 저작 sRGB(toneMapped=false + NoToneMapping)가 그대로 나간다.
 * DPR 을 캡(AC-005-2)하고, 뷰포트 밖(IntersectionObserver) 또는 탭 숨김(visibilitychange)
 * 시 프레임루프를 정지(뷰포트 AND 탭 가시일 때만 실행, AC-005-3/4)하며, context-loss 를
 * preventDefault + 누적 N=3 격하로 처리(AC-006-2). reduced-motion / 모바일 coarse 는
 * 정적 seed 프레임(솔버·포인터 없음, AC-006-1). data-theme 변경 시 색 재틴트(AC-003-3).
 */
function HeroFluid({ onUnrecoverable, hostRef }: HeroFluidProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [hidden, setHidden] = useState<boolean>(() =>
    typeof document === "undefined" ? false : document.hidden
  )
  const [inView, setInView] = useState<boolean>(false)
  const [coarseStatic, setCoarseStatic] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false
    return window.matchMedia(STATIC_MEDIA_QUERY).matches
  })
  const lostCount = useRef(0)
  const applyColorsRef = useRef<(() => void) | null>(null)
  // onCreated 에서 등록한 webglcontextlost 리스너를 언마운트 시 대칭 해제하기 위한 정리 함수.
  const contextLostCleanup = useRef<(() => void) | null>(null)

  // 정적 모드 = reduced-motion 또는 모바일/coarse-pointer.
  const staticMode = reducedMotion || coarseStatic
  // 능동 루프는 정적이 아니고 뷰포트 AND 탭 가시일 때만(두 조건의 논리곱, AC-005-5).
  const loopActive = !staticMode && inView && !hidden
  const frameloop: "always" | "never" | "demand" = staticMode
    ? "demand"
    : loopActive
    ? "always"
    : "never"
  // 테스트 관찰용 pause 상태 속성(AC-005-3/4).
  const dataFrameloop = loopActive ? "running" : "never"

  // 탭 가시성(visibilitychange → document.hidden).
  useEffect(() => {
    const onVisibility = (): void => setHidden(document.hidden)
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  // 모바일/coarse-pointer 매체 쿼리 라이브 추적(REQ-006 / AC-006-1).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mql = window.matchMedia(STATIC_MEDIA_QUERY)
    const onChange = (e: MediaQueryListEvent): void =>
      setCoarseStatic(e.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  // 뷰포트 가시성(IntersectionObserver on Hero Section). 미지원 시 항상 가시로 폴백.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) setInView(entry.isIntersecting)
      },
      { threshold: 0 }
    )
    io.observe(host)
    return () => io.disconnect()
  }, [hostRef])

  // data-theme 변경 시 색 재-읽기 → 유체 재틴트(REQ-BLOG-HERO-003 / AC-003-3).
  useEffect(() => {
    if (
      typeof MutationObserver === "undefined" ||
      typeof document === "undefined"
    )
      return
    const target = document.documentElement
    const mo = new MutationObserver(() => {
      applyColorsRef.current?.()
    })
    mo.observe(target, { attributes: true, attributeFilter: ["data-theme"] })
    return () => mo.disconnect()
  }, [])

  // 언마운트 시 webglcontextlost 리스너 정리(onCreated 에서 등록) — 파일 내 다른 리스너
  // (pointer/visibility/matchMedia/IO/MO)와 동일한 대칭 해제 규율 유지(REQ-006 HARD).
  useEffect(() => {
    return () => {
      contextLostCleanup.current?.()
      contextLostCleanup.current = null
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      data-frameloop={dataFrameloop}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <Canvas
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
        dpr={[1, DPR_CAP]}
        frameloop={frameloop}
        // toneMapping: NoToneMapping — DISPLAY 머티리얼의 저작 sRGB 값이 프레임버퍼에 직행
        // (toneMapped=false, 컴포지터 없음). R3F 기본 ACESFilmicToneMapping 은 색을 어둡게
        // 하므로 NoToneMapping 으로 고정해 모노크롬 잉크가 CSS 토큰과 WYSIWYG 로 일치한다.
        gl={{
          antialias: false,
          powerPreference: "high-performance",
          alpha: true,
          toneMapping: NoToneMapping,
        }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement
          const onContextLost = (event: Event): void => {
            // 브라우저 기본 동작(복원 차단)을 막고, 반복 손실(누적 N=3) 시 정적 폴백으로 격하.
            event.preventDefault()
            lostCount.current += 1
            if (lostCount.current >= MAX_CONTEXT_LOSSES) onUnrecoverable()
          }
          canvas.addEventListener("webglcontextlost", onContextLost)
          contextLostCleanup.current = () =>
            canvas.removeEventListener("webglcontextlost", onContextLost)
        }}
      >
        <DprGuard />
        <FluidSim
          staticMode={staticMode}
          hostRef={hostRef}
          applyColorsRef={applyColorsRef}
        />
      </Canvas>
    </div>
  )
}

export default HeroFluid
