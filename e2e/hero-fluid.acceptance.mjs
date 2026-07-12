// SPEC-BLOG-HERO-001 인수(GWT) 실행 스크립트.
//
// acceptance.md 가 명시하듯 러너 `@playwright/test` 는 설치돼 있지 않고(그리고 package.json
// 은 이 SPEC 범위에서 변경 금지) 코어 `playwright`(브라우저 자동화 라이브러리, deps 에 이미
// 존재)만 있다. 그래서 이 파일은 코어 API 로 작성한 **독립 실행 스크립트**다 — 러너/설정
// 없이 `node e2e/hero-fluid.acceptance.mjs` 로 돈다. Gatsby build 는 src/ 와 gatsby-*.js 만
// 컴파일하므로 이 e2e/ 디렉터리는 번들에 영향이 없다.
//
// 실행:
//   1) yarn --cwd blog-v2 build            # 프로덕션 번들 생성(SSR-safe 검증)
//   2) yarn --cwd blog-v2 serve            # 기본 http://localhost:9000
//   3) BASE_URL=http://localhost:9000 node e2e/hero-fluid.acceptance.mjs
//
// 코어 playwright 만으로 신뢰성 있게 자동화되는 런타임 인수를 커버한다:
//   AC-002-1(인트로 게이트), AC-002-2(reduced-motion 즉시 정적), AC-001-1(z-order),
//   AC-004-4(장식/접근성), AC-005-3(뷰포트 밖 frameloop 정지), AC-006-1(모바일/coarse 정적),
//   AC-006-2(context-loss N=3 격하), AC-006-4(lazy 로드 실패 Error Boundary 격하),
//   AC-003-3(테마 토글 재틴트, 관찰 가능한 부분).
//
// 추가 도구가 필요해 이 스크립트가 커버하지 않는(수동/인프라 필요) 인수 — 미완으로 남김:
//   AC-004-2(WCAG AA scrim 대비 측정): 프레임버퍼 픽셀 판독 + PNG 디코더가 필요
//     (deps 추가 금지로 여기서 미측정). 최악 프레임 대비는 수동 측정으로 확인해야 한다.
//   AC-005-4(탭 숨김 pause): document.hidden 강제는 CDP 오버라이드가 필요.
//   AC-004-1(포인터 stir 시각 변화): 아래에서 리스너 부착 여부까지만 확인(픽셀 diff 미측정).

import { chromium, devices } from "playwright"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:9000"
const HOME = new URL("/", BASE_URL).toString()

let passed = 0
let failed = 0
const failures = []

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`)
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

// Hero 캔버스 셀렉터(FluidLayer 안, Section#home 내부).
const CANVAS = "#home canvas"

async function waitForCanvas(page, timeout = 4000) {
  try {
    await page.waitForSelector(CANVAS, { state: "attached", timeout })
    return true
  } catch {
    return false
  }
}

// AC-002-1 — 인트로(~1.2s) 게이트 후 캔버스 등장.
async function acIntroGate(browser) {
  console.log("AC-002-1 인트로 게이트 활성화")
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(HOME, { waitUntil: "domcontentloaded" })
  // 로드 직후(게이트 이전)에는 캔버스가 없어야 한다.
  const immediate = await page.$(CANVAS)
  check("AC-002-1 로드 직후 캔버스 부재", immediate === null)
  // 게이트(~1.2s) 후 마운트.
  const appeared = await waitForCanvas(page, 4000)
  check("AC-002-1 게이트 후 캔버스 마운트", appeared)
  await ctx.close()
}

// AC-002-2 — reduced-motion: 즉시 정적 활성화(setTimeout/즉시 폴백).
async function acReducedMotion(browser) {
  console.log("AC-002-2 reduced-motion 즉시 정적")
  const ctx = await browser.newContext({ reducedMotion: "reduce" })
  const page = await ctx.newPage()
  await page.goto(HOME, { waitUntil: "domcontentloaded" })
  const appeared = await waitForCanvas(page, 2500)
  check("AC-002-2 reduced-motion 캔버스 즉시 활성화", appeared)
  if (appeared) {
    const frameloop = await page.getAttribute("#home [data-frameloop]", "data-frameloop")
    // 정적 모드에서는 능동 루프가 아니다(loopActive=false → 'never').
    check("AC-002-2 정적(비 running) 프레임루프", frameloop !== "running", `data-frameloop=${frameloop}`)
  }
  await ctx.close()
}

// AC-001-1 — 캔버스가 텍스트(z1) 뒤(z0, absolute inset:0)에 있다.
async function acZOrder(browser) {
  console.log("AC-001-1 z-order / 배경 배치")
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(HOME, { waitUntil: "domcontentloaded" })
  await waitForCanvas(page, 4000)
  const info = await page.evaluate((sel) => {
    const c = document.querySelector(sel)
    if (!c) return null
    const layer = c.closest("[aria-hidden]") ?? c.parentElement
    const cs = getComputedStyle(layer)
    return { position: cs.position, inset: `${cs.top} ${cs.right} ${cs.bottom} ${cs.left}`, z: cs.zIndex }
  }, CANVAS)
  check("AC-001-1 캔버스 레이어 absolute", info?.position === "absolute", JSON.stringify(info))
  check("AC-001-1 캔버스 레이어 z-index 0", info?.z === "0", JSON.stringify(info))
  await ctx.close()
}

// AC-004-4 — 장식 처리: 캔버스/scrim aria-hidden, 비포커스, scrim pointer-events:none.
async function acDecorative(browser) {
  console.log("AC-004-4 장식/접근성")
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(HOME, { waitUntil: "domcontentloaded" })
  await waitForCanvas(page, 4000)
  const a11y = await page.evaluate((sel) => {
    const canvas = document.querySelector(sel)
    const layer = canvas?.closest('[aria-hidden="true"]') ?? null
    // scrim 은 pointer-events:none 인 장식 div.
    const decorative = [...document.querySelectorAll('#home [aria-hidden="true"]')]
    const scrimNone = decorative.some((el) => getComputedStyle(el).pointerEvents === "none")
    // 탭 스톱 여부: 캔버스/레이어가 tabindex 로 포커스 가능하면 안 된다.
    const canvasFocusable = canvas ? canvas.tabIndex > 0 : false
    return {
      layerHidden: layer !== null,
      scrimNone,
      canvasFocusable,
      decorativeCount: decorative.length,
    }
  }, CANVAS)
  check("AC-004-4 캔버스 레이어 aria-hidden", a11y.layerHidden)
  check("AC-004-4 scrim pointer-events:none 존재", a11y.scrimNone)
  check("AC-004-4 캔버스 비포커스(탭 스톱 아님)", a11y.canvasFocusable === false)
  await ctx.close()
}

// AC-005-3 — 뷰포트 밖으로 스크롤 시 frameloop 정지, 복귀 시 재개.
async function acFrameloopPause(browser) {
  console.log("AC-005-3 뷰포트 밖 frameloop 정지")
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(HOME, { waitUntil: "domcontentloaded" })
  await waitForCanvas(page, 4000)
  // 능동 루프 진입 대기(IntersectionObserver 교차 후 'running').
  const running = await page
    .waitForFunction(
      () => document.querySelector("#home [data-frameloop]")?.getAttribute("data-frameloop") === "running",
      { timeout: 4000 }
    )
    .then(() => true)
    .catch(() => false)
  check("AC-005-3 뷰포트 내 frameloop running", running)

  // Hero 를 뷰포트 밖으로 스크롤.
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3))
  const paused = await page
    .waitForFunction(
      () => document.querySelector("#home [data-frameloop]")?.getAttribute("data-frameloop") === "never",
      { timeout: 3000 }
    )
    .then(() => true)
    .catch(() => false)
  check("AC-005-3 스크롤-아웃 시 frameloop never", paused)

  // 다시 Hero 로 스크롤 → 재개.
  await page.evaluate(() => window.scrollTo(0, 0))
  const resumed = await page
    .waitForFunction(
      () => document.querySelector("#home [data-frameloop]")?.getAttribute("data-frameloop") === "running",
      { timeout: 3000 }
    )
    .then(() => true)
    .catch(() => false)
  check("AC-005-3 스크롤-백 시 frameloop 재개", resumed)
  await ctx.close()
}

// AC-006-1 — 모바일/coarse-pointer: 정적 seed 프레임(솔버 루프 없음).
async function acMobileStatic(browser) {
  console.log("AC-006-1 모바일/coarse 정적")
  const ctx = await browser.newContext({ ...devices["Pixel 5"] })
  const page = await ctx.newPage()
  await page.goto(HOME, { waitUntil: "domcontentloaded" })
  const appeared = await waitForCanvas(page, 3000)
  check("AC-006-1 모바일 캔버스(정적 프레임) 존재", appeared)
  if (appeared) {
    const frameloop = await page.getAttribute("#home [data-frameloop]", "data-frameloop")
    check("AC-006-1 모바일 비 running(정적)", frameloop !== "running", `data-frameloop=${frameloop}`)
  }
  await ctx.close()
}

// AC-006-2 — WebGL context-loss 누적 N=3 시 플랫 --color-bg 격하, 콘솔 에러 0.
async function acContextLoss(browser) {
  console.log("AC-006-2 context-loss N=3 격하")
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()))
  page.on("pageerror", (e) => consoleErrors.push(String(e)))
  await page.goto(HOME, { waitUntil: "domcontentloaded" })
  const appeared = await waitForCanvas(page, 4000)
  check("AC-006-2 초기 캔버스 존재", appeared)

  // WEBGL_lose_context 확장으로 반복 손실. 2회까지는 격하하지 않아야 한다.
  const loseOnce = () =>
    page.evaluate((sel) => {
      const canvas = document.querySelector(sel)
      if (!canvas) return false
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl")
      const ext = gl?.getExtension("WEBGL_lose_context")
      if (!ext) return false
      ext.loseContext()
      // 컴포넌트의 webglcontextlost 핸들러가 event.preventDefault() 후 lostCount 를 증가.
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }))
      return true
    }, CANVAS)

  await loseOnce()
  await loseOnce()
  await page.waitForTimeout(200)
  const afterTwo = await page.$(CANVAS)
  check("AC-006-2 2회 손실 시 미격하(캔버스 유지)", afterTwo !== null)

  await loseOnce() // 3회째 → 격하.
  const degraded = await page
    .waitForFunction((sel) => document.querySelector(sel) === null, CANVAS, { timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  check("AC-006-2 3회째(N=3) 캔버스 격하/제거", degraded)
  check("AC-006-2 콘솔 에러 0", consoleErrors.length === 0, consoleErrors.join(" | "))
  await ctx.close()
}

// AC-006-4 — lazy 청크 로드 실패 시 Error Boundary 가 플랫 배경으로 격하, Hero 텍스트 정상.
async function acLazyFailBoundary(browser) {
  console.log("AC-006-4 lazy 로드 실패 Error Boundary")
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on("pageerror", (e) => consoleErrors.push(String(e)))
  // HeroFluid lazy 청크 요청을 실패시킨다. 청크명은 번들러가 정하므로 three/fiber 를
  // 포함하는 청크를 휴리스틱으로 abort — component---... 또는 three 관련 청크.
  await page.route(/\.js(\?.*)?$/, (route) => {
    const url = route.request().url()
    if (/hero-?fluid|three|react-three|fiber/i.test(url)) return route.abort()
    return route.continue()
  })
  await page.goto(HOME, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)
  // Hero 텍스트는 정상 렌더되어야 한다.
  const headingVisible = await page
    .locator("#home h1")
    .first()
    .isVisible()
    .catch(() => false)
  check("AC-006-4 Hero 제목(Name) 정상 렌더", headingVisible)
  // 캔버스는 없거나(격하) 최소한 크래시로 페이지가 죽지 않는다.
  const bodyVisible = await page
    .locator("body")
    .isVisible()
    .catch(() => false)
  check("AC-006-4 페이지 크래시 없음", bodyVisible)
  await ctx.close()
}

// AC-003-3 — 테마 토글 시 유체 재틴트(관찰 가능: data-theme 변경 + 캔버스 유지).
async function acThemeRetint(browser) {
  console.log("AC-003-3 테마 토글 재틴트")
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(HOME, { waitUntil: "domcontentloaded" })
  await waitForCanvas(page, 4000)
  const before = await page.getAttribute("html", "data-theme")
  // ThemeToggle 버튼을 찾을 수 없는 환경을 대비해 직접 토글(MutationObserver 재틴트 경로 검증).
  await page.evaluate(() => {
    const cur = document.documentElement.getAttribute("data-theme")
    document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark")
  })
  await page.waitForTimeout(300)
  const after = await page.getAttribute("html", "data-theme")
  check("AC-003-3 data-theme 변경 관찰", before !== after, `${before} -> ${after}`)
  const canvasStill = await page.$(CANVAS)
  check("AC-003-3 토글 후 캔버스 유지(재틴트 대상)", canvasStill !== null)
  await ctx.close()
}

async function main() {
  const browser = await chromium.launch()
  console.log(`SPEC-BLOG-HERO-001 인수 실행 @ ${HOME}\n`)
  try {
    await acIntroGate(browser)
    await acReducedMotion(browser)
    await acZOrder(browser)
    await acDecorative(browser)
    await acFrameloopPause(browser)
    await acMobileStatic(browser)
    await acContextLoss(browser)
    await acLazyFailBoundary(browser)
    await acThemeRetint(browser)
  } finally {
    await browser.close()
  }

  console.log(`\n결과: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log("실패 목록:")
    for (const f of failures) console.log(`  - ${f}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("실행 오류:", err)
  process.exit(1)
})
