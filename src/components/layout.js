import * as React from "react"
import Nav from "./Nav"
import Footer from "./Footer"

// 레이아웃: 앵커 Nav(헤더) + 메인 + Footer를 모든 페이지에 통합한다.
const Layout = ({ location, title, children }) => {
  const rootPath = `${__PATH_PREFIX__}/`
  const isRootPath = location.pathname === rootPath

  return (
    <div className="global-wrapper" data-is-root-path={isRootPath}>
      <header className="global-header">
        <Nav siteTitle={title} />
      </header>
      <div className="global-center">
        <main className="global-main">{children}</main>
      </div>
      <Footer />
    </div>
  )
}

export default Layout
