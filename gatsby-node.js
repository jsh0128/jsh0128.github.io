/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.com/docs/reference/config-files/gatsby-node/
 */

const path = require(`path`)
const {
  createFilePath,
  createRemoteFileNode,
} = require(`gatsby-source-filesystem`)

// Define the template for blog post
const blogPost = path.resolve(`./src/templates/blog-post.js`)

/**
 * @type {import('gatsby').GatsbyNode['createPages']}
 */
exports.createPages = async ({ graphql, actions, reporter }) => {
  const { createPage } = actions

  // Get all markdown blog posts sorted by date
  const result = await graphql(`
    {
      allMarkdownRemark(sort: { frontmatter: { date: ASC } }, limit: 1000) {
        nodes {
          id
          fields {
            slug
          }
        }
      }
    }
  `)

  if (result.errors) {
    reporter.panicOnBuild(
      `There was an error loading your blog posts`,
      result.errors
    )
    return
  }

  const posts = result.data.allMarkdownRemark.nodes

  // Create blog posts pages
  // But only if there's at least one markdown file found at "content/blog" (defined in gatsby-config.js)
  // `context` is available in the template as a prop and as a variable in GraphQL

  if (posts.length > 0) {
    posts.forEach((post, index) => {
      const previousPostId = index === 0 ? null : posts[index - 1].id
      const nextPostId = index === posts.length - 1 ? null : posts[index + 1].id

      createPage({
        path: post.fields.slug,
        component: blogPost,
        context: {
          id: post.id,
          previousPostId,
          nextPostId,
        },
      })
    })
  }
}

/**
 * @type {import('gatsby').GatsbyNode['onCreateNode']}
 */
// @MX:WARN: [AUTO] 빌드타임 네트워크 의존 danger zone — createRemoteFileNode가 원격 썸네일을
// 빌드 시점에 다운로드한다.
// @MX:REASON: 원격 호스트(GitHub) 불가/404/타임아웃 시 이미지 노드를 null 처리하여
// `gatsby build`가 abort되지 않도록 방어해야 한다(REQ-BLOG-UI-003 / AC-003-4 baseline).
exports.onCreateNode = async ({
  node,
  actions,
  getNode,
  createNodeId,
  cache,
  store,
}) => {
  const { createNodeField, createNode } = actions

  if (node.internal.type === `MarkdownRemark`) {
    // Normalize to NFC so Korean slugs match the filenames git stores on push
    // (core.precomposeUnicode converts pushed paths to NFC); otherwise NFD links 404.
    const value = createFilePath({ node, getNode }).normalize(`NFC`)

    createNodeField({
      name: `slug`,
      node,
      value,
    })

    // Baseline 이미지 경로(DECISION = BASELINE, plan.md §2.1):
    // frontmatter.img(원격 URL)를 빌드타임에 로컬 File 노드로 내려받아 GatsbyImage(webp/avif)로
    // 서빙한다. 실패는 null-guard로 흡수하여 빌드 그린 유지 → fields.localImage 미설정 시
    // Writing 카드는 텍스트 전용으로 degrade한다.
    const remoteUrl = node.frontmatter && node.frontmatter.img
    if (remoteUrl && /^https?:\/\//.test(remoteUrl)) {
      let fileNode = null
      try {
        fileNode = await createRemoteFileNode({
          url: remoteUrl,
          parentNodeId: node.id,
          createNode,
          createNodeId,
          cache,
          store,
        })
      } catch (err) {
        // 원격 호스트 불가/404: 빌드를 중단하지 않는다.
        fileNode = null
      }

      if (fileNode) {
        createNodeField({
          name: `localImage`,
          node,
          value: fileNode.id,
        })
      }
    }
  }
}

/**
 * @type {import('gatsby').GatsbyNode['createSchemaCustomization']}
 */
exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions

  // Explicitly define the siteMetadata {} object
  // This way those will always be defined even if removed from gatsby-config.js

  // Also explicitly define the Markdown frontmatter
  // This way the "MarkdownRemark" queries will return `null` even when no
  // blog posts are stored inside "content/blog" instead of returning an error
  createTypes(`
    type SiteSiteMetadata {
      author: Author
      siteUrl: String
      social: Social
    }

    type Author {
      name: String
      summary: String
    }

    type Social {
      twitter: String
    }

    type MarkdownRemark implements Node {
      frontmatter: Frontmatter
      fields: Fields
      localImage: File @link(from: "fields.localImage")
    }

    type Frontmatter {
      title: String
      description: String
      date: Date @dateformat
      img: String
    }

    type Fields {
      slug: String
      localImage: String
    }
  `)
}
