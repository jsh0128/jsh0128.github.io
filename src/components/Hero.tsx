import * as React from "react"
import styled from "styled-components"
import { profile } from "../data/profile"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"

// three/R3F 를 초기 페이지 번들에서 격리하기 위한 lazy 코드분할(REQ-BLOG-HERO-005 / AC-005-1).
// import("./HeroFluid") 는 활성화 시점(webglActive)에만 별도 청크로 로드된다.
const HeroFluid = React.lazy(() => import("./HeroFluid"))

// Hero.tsx(eager 번들)에 정의된 Error Boundary — lazy 청크 로드 실패나 WebGL 초기화 예외를
// 잡아 플랫 var(--color-bg) 폴백으로 격하한다(REQ-BLOG-HERO-006 / AC-006-4). eager 번들에
// 있어야 lazy 청크 자체의 로드 실패까지 포착할 수 있다. 실패 시 null 렌더 → Section 의
// 플랫 배경이 그대로 보인다.
interface FluidErrorBoundaryProps {
  readonly onError: () => void
  readonly children: React.ReactNode
}
class FluidErrorBoundary extends React.Component<
  FluidErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  componentDidCatch(): void {
    this.props.onError()
  }
  render(): React.ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

// @MX:NOTE: [AUTO] 풀스크린(뷰포트 높이) 히어로. 순수 CSS 로드 인트로(새로고침마다 재생).
// - 헤더 슬라이드다운은 src/style.css 의 introHeader 가 담당.
// - "프론트엔드 개발자" 타이틀: 흰 텍스트 + 브랜드 인디고 배경이 좌→우로 채워진다(background-size 0%→100%).
// easing = Expo.easeInOut → cubic-bezier(0.87, 0, 0.13, 1). JS 없음(SSR-safe), CLS-safe.
const Hero: React.FC = () => {
  const { name, title, intro, socials } = profile
  const links = socials.filter(s => Boolean(s.url))

  // 유체(HeroFluid)의 호스트가 되는 Section 참조 — 포인터-stir 와 IntersectionObserver 가
  // 여기 붙는다(REQ-BLOG-HERO-004/005).
  const sectionRef = React.useRef<HTMLElement>(null)
  const prefersReduced = usePrefersReducedMotion()
  // 인트로(title-fill ~1.2s) 완료 후에만 유체 캔버스를 마운트·페이드인(REQ-BLOG-HERO-002).
  const [webglActive, setWebglActive] = React.useState(false)
  // context-loss(N=3)/Error Boundary 격하 시 유체를 내려 플랫 var(--color-bg) 만 남긴다.
  const [unrecoverable, setUnrecoverable] = React.useState(false)

  // 새로고침 시 브라우저 스크롤 복원으로 하단에 착지하면 히어로 로드 인트로를 놓친다.
  // 홈 진입 시 스크롤 복원을 끄고 최상단으로 이동해 인트로(타이틀 좌→우 채움)가 항상 보이게 한다.
  // window 접근은 useEffect(클라이언트)에서만 → SSR-safe.
  // 마운트 1회 전용([] deps): usePrefersReducedMotion 은 OS reduced-motion 토글을 라이브
  // 추적하므로, 스크롤 복원/최상단 이동을 활성화 타이머와 묶으면 세션 중 OS 설정을 바꿀 때
  // window.scrollTo(0,0) 가 재실행되어 페이지가 최상단으로 튄다(REQ-BLOG-HERO-002).
  React.useEffect(() => {
    if (typeof window === "undefined") return
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual"
    }
    window.scrollTo(0, 0)
  }, [])

  // 인트로(title-fill ~1.2s) 완료 후에만 유체 캔버스를 마운트·페이드인(REQ-BLOG-HERO-002).
  // @MX:NOTE: [AUTO] 유체 활성화는 3-게이트다: (a) Title span onAnimationEnd(title-fill),
  // (b) 아래 setTimeout(1200) 폴백, (c) reduced-motion 즉시. reduced-motion 에선 title-fill 이
  // animation:none 이라 animationend 가 발생하지 않으므로 (c)/(b) 폴백이 필수다.
  // prefersReduced 변화에만 반응 — 스크롤 복원(위 마운트 1회 effect)과 분리한다.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    // (c) reduced-motion: 즉시 활성화(정적 seed 프레임). (b) 그 외: 1.2s 폴백.
    if (prefersReduced) {
      setWebglActive(true)
      return
    }
    const timer = window.setTimeout(() => setWebglActive(true), 1200)
    return () => window.clearTimeout(timer)
  }, [prefersReduced])

  return (
    <Section id="home" ref={sectionRef}>
      {webglActive && !unrecoverable && (
        <FluidLayer aria-hidden="true">
          <FluidErrorBoundary onError={() => setUnrecoverable(true)}>
            <React.Suspense fallback={null}>
              <HeroFluid
                hostRef={sectionRef}
                onUnrecoverable={() => setUnrecoverable(true)}
              />
            </React.Suspense>
          </FluidErrorBoundary>
        </FluidLayer>
      )}
      {/* 캔버스(z0)와 텍스트(z1) 사이 가독성 scrim. DOM 상 FluidLayer 뒤에 두어 캔버스 위에
          합성된다. pointer-events:none 으로 포인터-stir/링크 클릭을 막지 않는다. */}
      <Scrim aria-hidden="true" />

      <Content>
        <Name>{name}</Name>
        <Title>
          {/* onAnimationEnd 는 동작 전용(시각·DOM·CSS 불변) — (a) 인트로 완료 게이트. */}
          <span
            onAnimationEnd={e => {
              if (e.animationName === "title-fill") setWebglActive(true)
            }}
          >
            {title}
          </span>
        </Title>
        <Intro>{intro}</Intro>
        {links.length > 0 && (
          <Socials aria-label="소셜 링크">
            {links.map(s => (
              <SocialLink
                key={s.kind}
                href={s.url}
                target={s.kind === "email" ? undefined : "_blank"}
                rel={s.kind === "email" ? undefined : "noopener noreferrer"}
              >
                {s.label}
              </SocialLink>
            ))}
          </Socials>
        )}
      </Content>

      <ScrollCue aria-hidden="true">
        <span />
      </ScrollCue>
    </Section>
  )
}

// 풀블리드 뷰포트-높이 섹션. .global-main(max-width 56rem) 폭 제약을 벗어나려고
// width:100vw + margin-left:calc(50% - 50vw). 높이는 헤더(sticky 57px)+메인 패딩(12px)=69px 를
// 빼서, 히어로(+하단 ScrollCue)가 첫 화면 안에 정확히 들어오게 한다.
const Section = styled.section`
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  min-height: calc(100vh - 69px); /* 구형 브라우저 폴백 */
  min-height: calc(100dvh - 69px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: var(--spacing-16) var(--spacing-6);
  background: var(--color-bg);

  @media (max-width: 40rem) {
    padding: var(--spacing-12) var(--spacing-5);
  }
`

// 유체 캔버스 레이어(z0). Section overflow:hidden 에 클립되고 Content(z1) 뒤에 깔린다.
// 마운트 시 0→1 페이드인. reduced-motion 이면 즉시 1(정적).
const FluidLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0;
  animation: hero-fluid-in 0.8s ease 0.05s forwards;

  @keyframes hero-fluid-in {
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
  }
`

// 가독성 scrim(z0, 캔버스 위·텍스트 아래). 중앙 리딩 컬럼 위로 var(--color-bg) 알파가
// 가장 짙고(≈0.88) 섹션 가장자리로 갈수록 옅어져, 텍스트 뒤 합성 배경이 --color-bg 에
// 가깝게 유지된다 → 최악 프레임에서도 Hero 텍스트가 WCAG AA 대비를 지킨다(AC-004-2).
// 장식: aria-hidden + pointer-events:none 로 포인터-stir/링크 클릭을 절대 막지 않는다.
const Scrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  /* 폴백: color-mix 미지원 구형 브라우저는 아래 그라디언트 선언이 무효화되어 드롭되고,
     이 솔리드 var(--color-bg) 가 남아 텍스트 가독성을 보장한다(유체는 가려지지만 안전 격하).
     color-mix 지원 브라우저에선 다음 background 가 오버라이드해 가장자리 투명 그라디언트가 살아난다. */
  background: var(--color-bg);
  background: radial-gradient(
    130% 100% at 50% 45%,
    color-mix(in srgb, var(--color-bg) 88%, transparent) 0%,
    color-mix(in srgb, var(--color-bg) 70%, transparent) 40%,
    color-mix(in srgb, var(--color-bg) 34%, transparent) 100%
  );
`

// 중앙 읽기 컬럼(~46rem). 텍스트는 좌측 정렬 리딩 컬럼 유지.
const Content = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: var(--maxWidth-landing);
`

const Name = styled.h1`
  margin: var(--spacing-0) var(--spacing-0) var(--spacing-4);
  font-size: clamp(2.986rem, 8vw, 5.25rem);
  line-height: var(--lineHeight-none);
  letter-spacing: -0.03em;
  color: var(--color-heading-black);
`

// "프론트엔드 개발자": 흰 텍스트 위로, 파란(브랜드) 배경이 좌→우로 채워진다.
// background-size 0%→100% (background-position 기본 left) 로 좌측부터 파랑이 차오르며
// 흰 글자가 드러난다. reduced-motion 이면 처음부터 100%(꽉 찬 파란 배경).
const Title = styled.p`
  margin: var(--spacing-0) var(--spacing-0) var(--spacing-6);

  span {
    display: inline-block;
    /* 항상 브랜드 블록과 대비되는 텍스트: 라이트=흰 글자/검정 블록, 다크=어두운 글자/밝은 블록. */
    color: var(--color-bg);
    font-family: var(--font-heading);
    font-weight: var(--fontWeight-bold);
    font-size: clamp(1.2rem, 3.2vw, 1.728rem);
    line-height: 1.35;
    padding: 0.18em 0.55em;
    background-image: linear-gradient(var(--color-brand), var(--color-brand));
    background-repeat: no-repeat;
    background-position: left center;
    background-size: 0% 100%;
    animation: title-fill 0.7s cubic-bezier(0.87, 0, 0.13, 1) 0.5s both;
  }

  @keyframes title-fill {
    to {
      background-size: 100% 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    span {
      background-size: 100% 100%;
      animation: none;
    }
  }
`

const Intro = styled.p`
  max-width: 38rem;
  margin: var(--spacing-0) var(--spacing-0) var(--spacing-8);
  color: var(--color-text);
  font-size: clamp(1.05rem, 2.4vw, 1.2rem);
  line-height: var(--lineHeight-relaxed);
`

const Socials = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-3);
`

const SocialLink = styled.a`
  display: inline-flex;
  align-items: center;
  color: var(--color-heading);
  text-decoration: none;
  font-family: var(--font-heading);
  font-size: var(--fontSize-0);
  font-weight: var(--fontWeight-bold);
  padding: var(--spacing-2) var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  /* 토큰 기반 표면색 → 라이트/다크 모두에서 은은한 칩으로 읽힘(과거 rgba 흰색은 다크에서 깨짐). */
  background: var(--color-surface);
  transition: border-color 0.18s, color 0.18s, background 0.18s;

  &:hover {
    color: var(--color-brand);
    border-color: var(--color-brand);
    background: var(--color-brand-soft);
  }
`

// 하단 스크롤 큐(장식). 인트로 뒤 나타난다. 모션 최소화 선호 시 정적.
const ScrollCue = styled.div`
  position: absolute;
  left: 50%;
  bottom: var(--spacing-8);
  transform: translateX(-50%);
  z-index: 1;
  width: 22px;
  height: 34px;
  border: 2px solid var(--color-border);
  border-radius: 12px;
  display: flex;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  animation: hero-cue-in 0.6s ease 1.4s both;

  @keyframes hero-cue-in {
    to {
      opacity: 1;
    }
  }

  span {
    display: block;
    width: 3px;
    height: 7px;
    margin-top: 6px;
    border-radius: 2px;
    background: var(--color-brand);
    animation: hero-scroll-cue 1.6s ease-in-out 1.8s infinite;
  }

  @keyframes hero-scroll-cue {
    0% {
      opacity: 0;
      transform: translateY(0);
    }
    40% {
      opacity: 1;
    }
    80% {
      opacity: 0;
      transform: translateY(10px);
    }
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    opacity: 1;
    animation: none;

    span {
      animation: none;
    }
  }

  @media (max-width: 40rem) {
    display: none;
  }
`

export default Hero
