import * as React from "react"
import { Link } from "gatsby"
import styled from "styled-components"
import { profile } from "../data/profile"
import ThemeToggle from "./ThemeToggle"

// 앵커 내비게이션: 홈 섹션 id로 스무스 스크롤 이동.
// 홈이 아닌 페이지에서도 `/#about` 형태로 홈으로 이동 후 해당 섹션으로 스크롤한다.
// 스무스 스크롤은 style.css의 `html { scroll-behavior: smooth }`가 담당(AC-001-2).
const items = [
  { to: "/#about", label: "경력" },
  { to: "/#writing", label: "블로그" },
]

const Nav: React.FC<{ siteTitle: string }> = ({ siteTitle }) => {
  return (
    <Bar>
      <Brand to="/">{siteTitle || profile.name}</Brand>
      <Actions>
        <Links>
          {items.map(item => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </Links>
        <ThemeToggle />
      </Actions>
    </Bar>
  )
}

const Bar = styled.nav`
  max-width: var(--maxWidth-wrapper);
  width: 100%;
  margin: 0 auto;
  padding: var(--spacing-4) var(--spacing-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-4);
`

const Brand = styled(Link)`
  font-weight: var(--fontWeight-bold);
  font-family: var(--font-heading);
  font-size: var(--fontSize-1);
  letter-spacing: -0.01em;
  text-decoration: none;
  color: var(--color-heading);
`

// 헤더 우측 그룹: 앵커 링크 + 테마 토글을 한 줄에 배치(모바일 겹침 없음).
const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-5);

  @media (max-width: 30rem) {
    gap: var(--spacing-3);
  }
`

const Links = styled.div`
  display: flex;
  gap: var(--spacing-6);

  a {
    color: var(--color-text-light);
    text-decoration: none;
    font-family: var(--font-heading);
    font-size: var(--fontSize-0);
    font-weight: var(--fontWeight-bold);
    transition: color 0.18s;
  }

  a:hover {
    color: var(--color-brand);
  }

  @media (max-width: 30rem) {
    gap: var(--spacing-4);
  }
`

export default Nav
