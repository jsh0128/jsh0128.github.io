import * as React from "react"
import styled from "styled-components"
import { profile } from "../data/profile"

// @MX:NOTE: [AUTO] 풀스크린(뷰포트 높이) 히어로. 순수 CSS 로드 인트로(새로고침마다 재생).
// - 헤더 슬라이드다운은 src/style.css 의 introHeader 가 담당.
// - "프론트엔드 개발자" 타이틀: 흰 텍스트 + 브랜드 인디고 배경이 좌→우로 채워진다(background-size 0%→100%).
// easing = Expo.easeInOut → cubic-bezier(0.87, 0, 0.13, 1). JS 없음(SSR-safe), CLS-safe.
const Hero: React.FC = () => {
  const { name, title, intro, socials } = profile
  const links = socials.filter(s => Boolean(s.url))

  // 새로고침 시 브라우저 스크롤 복원으로 하단에 착지하면 히어로 로드 인트로를 놓친다.
  // 홈 진입 시 스크롤 복원을 끄고 최상단으로 이동해 인트로(타이틀 좌→우 채움)가 항상 보이게 한다.
  // window 접근은 useEffect(클라이언트)에서만 → SSR-safe.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual"
    }
    window.scrollTo(0, 0)
  }, [])

  return (
    <Section id="home">
      <Content>
        <Name>{name}</Name>
        <Title>
          <span>{title}</span>
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
