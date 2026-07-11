import * as React from "react"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import Seo from "../components/seo"
import Hero from "../components/Hero"
import Experience from "../components/Experience"
import Writing from "../components/Writing"

// @MX:ANCHOR: [AUTO] 홈 진입점 — Hero/Experience/Writing 섹션 조합의 fan_in 지점.
// @MX:REASON: 다수 섹션 컴포넌트(Hero, Experience, Writing)가 이 페이지에서 단일
// 랜딩으로 합류한다(REQ-BLOG-UI-001). 섹션 순서·id(#home/#about/#writing) 계약을
// 여기서 보증한다. Hero는 풀블리드 100dvh 로 .landing 읽기 컬럼 밖에서 렌더링하고,
// Experience/Writing 만 좁은 .landing 컬럼(~46rem) 안에 담는다. Writing은 포트폴리오
// 콘텐츠에 종속된 보조 섹션으로 하단에 배치한다.
const BlogIndex = ({ data, location }) => {
  const siteTitle = data.site.siteMetadata?.title || `Title`
  const posts = data.allMarkdownRemark.nodes

  return (
    <Layout location={location} title={siteTitle}>
      <Hero />
      <div className="landing">
        <Experience />
        <Writing posts={posts} />
      </div>
    </Layout>
  )
}

export default BlogIndex

/**
 * Head export to define metadata for the page
 *
 * See: https://www.gatsbyjs.com/docs/reference/built-in-components/gatsby-head/
 */
export const Head = () => <Seo title="정성훈" />

export const pageQuery = graphql`
  {
    site {
      siteMetadata {
        title
      }
    }
    allMarkdownRemark(sort: { frontmatter: { date: DESC } }) {
      nodes {
        excerpt
        fields {
          slug
        }
        frontmatter {
          date
          title
          description
        }
        localImage {
          childImageSharp {
            gatsbyImageData(
              width: 480
              placeholder: BLURRED
              formats: [AUTO, WEBP, AVIF]
            )
          }
        }
      }
    }
  }
`
