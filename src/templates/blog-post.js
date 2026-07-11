import * as React from "react"
import { Link, graphql } from "gatsby"
import { GatsbyImage, getImage } from "gatsby-plugin-image"

import Layout from "../components/layout"
import Seo from "../components/seo"
import styled from "styled-components"
import Comment from "../components/Comment"
import dayjs from "dayjs"

const BlogPostTemplate = ({
  data: { previous, next, site, markdownRemark: post },
  location,
}) => {
  const siteTitle = site.siteMetadata?.title || `Title`
  // 상세 히어로 이미지: baseline localize 성공 시 GatsbyImage(webp/avif, blur-up),
  // 실패/부재 시 이미지 요소 없이 degrade(AC-003-4).
  const heroImage = getImage(post.localImage)

  return (
    <Layout location={location} title={siteTitle}>
      <article
        className="blog-post"
        itemScope
        itemType="http://schema.org/Article"
      >
        <header>
          <h1 itemProp="headline">{post.frontmatter.title}</h1>
          <p>{dayjs(post.frontmatter.date).format("YYYY-MM-DD")}</p>
        </header>
        {heroImage && (
          <GatsbyImage
            image={heroImage}
            alt=""
            className="blog-post-hero"
          />
        )}
        <section
          dangerouslySetInnerHTML={{ __html: post.html }}
          itemProp="articleBody"
        />
        <hr />
      </article>
      <nav className="blog-post-nav">
        <ul
          style={{
            display: `flex`,
            flexWrap: `wrap`,
            justifyContent: `space-between`,
            listStyle: `none`,
            padding: 0,
          }}
        >
          <li>
            {previous && (
              <CustomNextLink
                to={previous.fields.slug}
                rel="prev"
                className="controlPage"
              >
                {previous.frontmatter.title}
              </CustomNextLink>
            )}
          </li>
          <li>
            {next && (
              <CustomNextLink
                to={next.fields.slug}
                rel="next"
                className="controlPage"
              >
                {next.frontmatter.title}
              </CustomNextLink>
            )}
          </li>
        </ul>
      </nav>
      <Comment />
    </Layout>
  )
}

export const Head = ({ data: { markdownRemark: post } }) => {
  return (
    <Seo
      title={post.frontmatter.title}
      description={post.frontmatter.description || post.excerpt}
    />
  )
}

export default BlogPostTemplate

// 이전/다음 글 내비게이션: 히어로의 SocialLink/태그 칩과 같은 시각 언어(토큰 기반 칩/버튼).
// 하드코딩 black/white 제거 → 라이트/다크 모두에서 또렷하게 읽히는 탭 가능한 버튼.
// hover 는 브랜드색으로 반전(라이트=검정 배경/흰 글자, 다크=밝은 배경/어두운 글자).
const CustomNextLink = styled(Link)`
  display: block;
  text-decoration: none !important;
  color: var(--color-heading);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-family: var(--font-heading);
  font-weight: var(--fontWeight-bold);
  transition: background 0.18s, color 0.18s, border-color 0.18s;
  &:hover {
    background: var(--color-brand);
    color: var(--color-bg);
    border-color: var(--color-brand);
  }
`

export const pageQuery = graphql`
  query BlogPostBySlug(
    $id: String!
    $previousPostId: String
    $nextPostId: String
  ) {
    site {
      siteMetadata {
        title
      }
    }
    markdownRemark(id: { eq: $id }) {
      id
      excerpt(pruneLength: 160)
      html
      frontmatter {
        title
        date
        description
        img
      }
      localImage {
        childImageSharp {
          gatsbyImageData(
            width: 830
            placeholder: BLURRED
            formats: [AUTO, WEBP, AVIF]
          )
        }
      }
    }
    previous: markdownRemark(id: { eq: $previousPostId }) {
      fields {
        slug
      }
      frontmatter {
        title
      }
    }
    next: markdownRemark(id: { eq: $nextPostId }) {
      fields {
        slug
      }
      frontmatter {
        title
      }
    }
  }
`
