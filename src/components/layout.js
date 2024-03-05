import * as React from "react"
import { Link } from "gatsby"
import styled from "styled-components"

const Layout = ({ location, title, children }) => {
  const rootPath = `${__PATH_PREFIX__}/`
  const isRootPath = location.pathname === rootPath

  const header = (
    <Link className="header-link-home" to="/">
      {title}
    </Link>
  )

  return (
    <Container className="global-wrapper" data-is-root-path={isRootPath}>
      <header className="global-header">
        <div className="global-header-center">{header}</div>
      </header>
      <div className="global-center">
        <main className="global-main">{children}</main>
      </div>
    </Container>
  )
}

const Container = styled.div`
  header > a {
    color: black;
  }
`

export default Layout
