/**
 * Implement Gatsby's SSR (Server Side Rendering) APIs in this file.
 *
 * See: https://www.gatsbyjs.com/docs/reference/config-files/gatsby-ssr/
 */
const React = require("react")

// No-flash 테마 초기화: body 페인트 전에 실행되는 블로킹 인라인 스크립트.
// localStorage 의 저장값 → 없으면 OS 선호(prefers-color-scheme) → data-theme 설정.
// try/catch 로 감싸 어떤 환경에서도 렌더를 막지 않는다.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`

/**
 * @type {import('gatsby').GatsbySSR['onRenderBody']}
 */
exports.onRenderBody = ({ setHtmlAttributes, setPreBodyComponents }) => {
  setHtmlAttributes({ lang: `ko` })
  setPreBodyComponents([
    React.createElement("script", {
      key: "theme-no-flash",
      dangerouslySetInnerHTML: { __html: themeInit },
    }),
  ])
}
