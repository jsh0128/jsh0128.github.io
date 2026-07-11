import * as React from "react"
import styled from "styled-components"

type Theme = "light" | "dark"

// 라이트/다크 테마 토글. <html data-theme> 를 전환하고 localStorage 에 저장한다.
// SSR 안전: window/document 는 이벤트 핸들러와 useEffect 안에서만 접근한다.
// 최초 표시 상태는 no-flash 스크립트(gatsby-ssr.js)가 세팅한 현재 data-theme 에서 읽는다.
const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = React.useState<Theme>("light")

  React.useEffect(() => {
    const current = document.documentElement.dataset.theme
    if (current === "dark" || current === "light") {
      setTheme(current)
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
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      aria-pressed={isDark}
      title={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
    </Button>
  )
}

const SunIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path
      strokeLinecap="round"
      d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
    />
  </svg>
)

const MoonIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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

  svg {
    width: 18px;
    height: 18px;
    display: block;
  }
`

export default ThemeToggle
