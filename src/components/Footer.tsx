import * as React from "react"
import styled from "styled-components"
import { profile } from "../data/profile"

// Footer: © 정성훈 + 소셜. URL이 있는 링크만 렌더(REQ-BLOG-UI-001 Optional).
const Footer: React.FC = () => {
  const { name, socials } = profile
  const links = socials.filter(s => Boolean(s.url))
  const year = new Date().getFullYear()

  return (
    <Wrapper>
      {links.length > 0 && (
        <Socials>
          {links.map(s => (
            <a
              key={s.kind}
              href={s.url}
              target={s.kind === "email" ? undefined : "_blank"}
              rel={s.kind === "email" ? undefined : "noopener noreferrer"}
            >
              {s.label}
            </a>
          ))}
        </Socials>
      )}
      <Copy>
        © {year} {name}
      </Copy>
    </Wrapper>
  )
}

const Wrapper = styled.footer`
  border-top: 1px solid var(--color-border);
  margin-top: var(--spacing-12);
  padding: var(--spacing-10) var(--spacing-0);
  text-align: center;
`

const Socials = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-4);
  justify-content: center;
  margin-bottom: var(--spacing-4);

  a {
    color: var(--color-text-light);
    text-decoration: none;
    font-family: var(--font-heading);
    font-size: var(--fontSize-0);
    transition: color 0.18s;
  }

  a:hover {
    color: var(--color-brand);
  }
`

const Copy = styled.p`
  margin: var(--spacing-0);
  color: var(--color-text-light);
  font-size: var(--fontSize-0);
`

export default Footer
