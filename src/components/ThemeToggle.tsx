import * as React from "react"
import styled from "styled-components"

type Theme = "light" | "dark"

// 라이트/다크 테마 토글. <html data-theme> 를 전환하고 localStorage 에 저장한다.
// SSR 안전: window/document 는 이벤트 핸들러와 useEffect 안에서만 접근한다.
// 최초 표시 상태는 no-flash 스크립트(gatsby-ssr.js)가 세팅한 현재 data-theme 에서 읽는다.
const ThemeToggle: React.FC = () => {
  // @MX:NOTE: [AUTO] 표시 아이콘은 React state 와 완전히 분리되어 순수 CSS(data-theme)로
  // 결정된다. Sun/Moon 두 SVG 를 항상 함께 렌더하고 :root[data-theme] 로 하나만 노출하므로,
  // 무플래시 스크립트가 페인트 전에 세팅한 data-theme 기준으로 SSR·다크 로드 모두 첫
  // 페인트부터 올바른 아이콘이 보인다. 아이콘 자식 구조가 SSR·클라이언트 동일해져
  // 구조적 하이드레이션 불일치·플래시가 원천 제거된다(아이콘엔 suppressHydrationWarning 불필요).
  // state 는 aria-label/aria-pressed/title 속성 계산에만 쓰이며, 그 속성 불일치는
  // Button 의 suppressHydrationWarning 이 안전하게 덮는다(속성 불일치는 확실히 커버됨).
  const [theme, setTheme] = React.useState<Theme>(() =>
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light"
  )

  React.useEffect(() => {
    // 하이드레이션 직후 DOM 실제 테마와 재동기화(초기 렌더가 SSR 'light' 였던 경우 보정).
    const current = document.documentElement.dataset.theme
    if (current === "dark" || current === "light") {
      setTheme(current)
    }

    // cross-tab: 다른 탭에서 localStorage 'theme' 가 바뀌면 이 탭도 즉시 반영.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "theme") return
      const next = e.newValue
      if (next === "dark" || next === "light") {
        document.documentElement.dataset.theme = next
        setTheme(next)
      }
    }

    // OS 선호 변경: 사용자가 명시적 저장값을 두지 않은 경우에만 따라간다.
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const onMedia = (e: MediaQueryListEvent) => {
      let stored: string | null = null
      try {
        stored = window.localStorage.getItem("theme")
      } catch {
        /* 접근 불가 시 OS 선호를 따른다 */
      }
      if (stored === "dark" || stored === "light") return
      const next: Theme = e.matches ? "dark" : "light"
      document.documentElement.dataset.theme = next
      setTheme(next)
    }

    window.addEventListener("storage", onStorage)
    mql.addEventListener("change", onMedia)
    return () => {
      window.removeEventListener("storage", onStorage)
      mql.removeEventListener("change", onMedia)
    }
  }, [])

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    try {
      window.localStorage.setItem("theme", next)
    } catch {
      /* localStorage 접근 불가(프라이빗 모드 등)여도 전환은 동작 */
    }
    setTheme(next)
  }

  const isDark = theme === "dark"

  return (
    <Button
      type="button"
      onClick={toggle}
      suppressHydrationWarning
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      aria-pressed={isDark}
      title={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
    >
      <SunIcon className="icon-sun" />
      <MoonIcon className="icon-moon" />
    </Button>
  )
}

const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path
      strokeLinecap="round"
      d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
    />
  </svg>
)

const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-heading);
  cursor: pointer;
  transition: border-color 0.18s, color 0.18s, background 0.18s;

  &:hover {
    border-color: var(--color-brand);
    color: var(--color-brand);
  }

  &:focus-visible {
    outline: 2px solid var(--color-brand);
    outline-offset: 2px;
  }

  /* 아이콘 크기만 여기서 지정. 노출(display)은 전역 style.css 에서 <html data-theme>
     기준으로 결정한다 — styled-components(stylis)가 ':root[...] & .icon' 형태의
     & 중첩을 잘못 처리해 다크 오버라이드가 적용되지 않는 문제를 피하기 위함. */
  svg {
    width: 18px;
    height: 18px;
  }
`

export default ThemeToggle
