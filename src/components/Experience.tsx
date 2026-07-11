import * as React from "react"
import styled, { keyframes } from "styled-components"
import { experiences } from "../data/profile"

// 경력(Experience): profile.ts의 경력을 역순(최신 우선) 세로 타임라인으로 렌더(AC-002-2).
const Experience: React.FC = () => {
  return (
    <Section id="about">
      <Header>
        <Kicker>EXPERIENCE</Kicker>
        <Heading>경력</Heading>
      </Header>

      <Timeline>
        {experiences.map(entry => {
          const isCurrent = /재직중|현재|present/i.test(entry.period)
          return (
            <Entry key={entry.company}>
              <Marker aria-hidden="true">
                {isCurrent && (
                  <>
                    <Ping $delay="0s" />
                    <Ping $delay="0.9s" />
                  </>
                )}
                <Dot $current={isCurrent} />
              </Marker>
              <Period>{entry.period}</Period>
              <Company>{entry.company}</Company>
              <Role>{entry.role}</Role>
              <Projects>
                {entry.projects.map(p => (
                  <Project key={p.name}>
                    <ProjectName>{p.name}</ProjectName>
                    <ProjectSummary>{p.summary}</ProjectSummary>
                    <Tags>
                      {p.stack.map(s => (
                        <Tag key={s}>{s}</Tag>
                      ))}
                    </Tags>
                  </Project>
                ))}
              </Projects>
            </Entry>
          )
        })}
      </Timeline>
    </Section>
  )
}

const Section = styled.section`
  padding: var(--spacing-16) var(--spacing-0);
`

const Header = styled.header`
  margin-bottom: var(--spacing-10);
`

const Kicker = styled.p`
  margin: var(--spacing-0) var(--spacing-0) var(--spacing-2);
  font-family: var(--font-heading);
  font-size: var(--fontSize-0);
  font-weight: var(--fontWeight-bold);
  letter-spacing: 0.14em;
  color: var(--color-brand);
`

const Heading = styled.h2`
  margin: var(--spacing-0);
  font-size: var(--fontSize-5);
  letter-spacing: -0.02em;
  color: var(--color-heading);
`

const Timeline = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-12);
  padding-left: var(--spacing-8);
  border-left: 1px solid var(--color-border);
`

const Entry = styled.div`
  position: relative;
`

// 타임라인 마커: 과거 회사는 회색 점, 현재 재직 회사만 파란 점 + 겹겹이 퍼지는 핑(radar) 애니메이션.
const Marker = styled.span`
  position: absolute;
  left: calc(-1 * var(--spacing-8) - 5px);
  top: 6px;
  width: 9px;
  height: 9px;
`

const ping = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  70% {
    opacity: 0;
  }
  100% {
    transform: scale(3.4);
    opacity: 0;
  }
`

const Ping = styled.span<{ $delay: string }>`
  position: absolute;
  inset: 0;
  border-radius: 100%;
  background: var(--color-brand);
  animation: ${ping} 2.4s ease-out infinite;
  animation-delay: ${props => props.$delay};

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`

const Dot = styled.span<{ $current: boolean }>`
  position: absolute;
  inset: 0;
  border-radius: 100%;
  background: ${props => (props.$current ? "var(--color-brand)" : "var(--color-border)")};
  box-shadow: 0 0 0 4px var(--color-bg);
  z-index: 1;
`

const Period = styled.p`
  margin: var(--spacing-0) var(--spacing-0) var(--spacing-2);
  font-family: var(--font-heading);
  font-size: var(--fontSize-0);
  font-weight: var(--fontWeight-bold);
  color: var(--color-text-light);
`

const Company = styled.h3`
  margin: var(--spacing-0) var(--spacing-0) var(--spacing-1);
  font-size: var(--fontSize-3);
  letter-spacing: -0.01em;
  color: var(--color-heading);
`

const Role = styled.p`
  margin: var(--spacing-0) var(--spacing-0) var(--spacing-6);
  font-family: var(--font-heading);
  font-size: var(--fontSize-0);
  color: var(--color-text-light);
`

const Projects = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
`

const Project = styled.div``

const ProjectName = styled.h4`
  margin: var(--spacing-0) var(--spacing-0) var(--spacing-2);
  font-size: var(--fontSize-1);
  color: var(--color-heading);
`

const ProjectSummary = styled.p`
  margin: var(--spacing-0) var(--spacing-0) var(--spacing-3);
  color: var(--color-text);
  font-size: var(--fontSize-1);
  line-height: var(--lineHeight-relaxed);
  word-break: keep-all;
`

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
`

const Tag = styled.span`
  font-family: var(--font-heading);
  font-size: 0.72rem;
  color: var(--color-text-light);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 3px 10px;
`

export default Experience
