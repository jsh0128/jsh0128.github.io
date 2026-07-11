import * as React from "react"
import { Link } from "gatsby"
import { GatsbyImage, getImage } from "gatsby-plugin-image"
import styled from "styled-components"
import dayjs from "dayjs"

// 블로그(Writing): 포트폴리오 콘텐츠에 종속된 보조 섹션. 최근 글을 작고 차분한
// 카드 목록으로 렌더한다(경력/프로젝트보다 시각적으로 덜 강조).
//
// @MX:NOTE: [AUTO] 썸네일 처리 — 원격 배너 이미지는 텍스트가 담겨 있어 cover 크롭 시
// 좌우 글자가 잘린다. 고정 비율 박스 + object-fit: contain(objectFit="contain")으로
// 잘림 없이 표시하고, gatsbyImageData에서 aspectRatio 강제 크롭을 제거했다.
// GatsbyImage는 기본 loading="lazy"라 접힘 아래 썸네일은 뷰포트 근처에서만 로드된다.
const Writing = ({ posts }) => {
  return (
    <Section id="writing">
      <Header>
        <Kicker>WRITING</Kicker>
        <Heading>블로그</Heading>
        <Subtitle>개발하며 마주한 경험과 개념을 정리합니다.</Subtitle>
      </Header>

      {posts.length === 0 ? (
        <Empty>아직 작성된 글이 없습니다.</Empty>
      ) : (
        <Grid>
          {posts.map(post => {
            const title = post.frontmatter.title || post.fields.slug
            const image = getImage(post.localImage)

            return (
              <Card key={post.fields.slug} to={post.fields.slug}>
                <Thumb className={image ? "" : "is-empty"}>
                  {image && (
                    <GatsbyImage image={image} alt="" objectFit="contain" />
                  )}
                </Thumb>
                <Body>
                  <CardTitle>{title}</CardTitle>
                  <Date>
                    {dayjs(post.frontmatter.date).format("YYYY.MM.DD")}
                  </Date>
                </Body>
              </Card>
            )
          })}
        </Grid>
      )}
    </Section>
  )
}

const Section = styled.section`
  padding: var(--spacing-16) var(--spacing-0) var(--spacing-8);
  border-top: 1px solid var(--color-border);
`

const Header = styled.header`
  margin-bottom: var(--spacing-8);
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
  margin: var(--spacing-0) var(--spacing-0) var(--spacing-2);
  font-size: var(--fontSize-4);
  letter-spacing: -0.02em;
  color: var(--color-heading);
`

const Subtitle = styled.p`
  margin: var(--spacing-0);
  color: var(--color-text-light);
  font-size: var(--fontSize-1);
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-4);

  @media (min-width: 34rem) {
    grid-template-columns: 1fr 1fr;
  }

  @media (min-width: 52rem) {
    grid-template-columns: 1fr 1fr 1fr;
  }
`

const Card = styled(Link)`
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.18s, box-shadow 0.18s;

  &:hover {
    border-color: var(--color-brand);
    box-shadow: 0 6px 18px -12px rgba(20, 24, 31, 0.22);
  }
`

// 고정 16:9 박스 + contain → 배너 텍스트가 잘리지 않으며 공간을 미리 확보해 CLS를 막는다.
const Thumb = styled.div`
  aspect-ratio: 16 / 9;
  width: 100%;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);

  .gatsby-image-wrapper {
    width: 100%;
    height: 100%;
  }

  &.is-empty {
    display: none;
  }
`

const Body = styled.div`
  padding: var(--spacing-4);
`

const CardTitle = styled.h3`
  margin: var(--spacing-0) var(--spacing-0) var(--spacing-2);
  font-size: var(--fontSize-1);
  line-height: var(--lineHeight-normal);
  color: var(--color-heading);
  word-break: keep-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const Date = styled.small`
  color: var(--color-text-light);
  font-family: var(--font-heading);
  font-size: var(--fontSize-0);
`

const Empty = styled.p`
  color: var(--color-text-light);
`

export default Writing
