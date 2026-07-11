import React, { useEffect, useRef } from "react"

// utterances 댓글 위젯의 테마를 사이트 테마(data-theme)에 맞춘다.
// - 마운트 시: document.documentElement.dataset.theme 을 읽어 github-dark/github-light 결정.
// - 토글 시: MutationObserver 로 data-theme 변화를 감지해 iframe 에 postMessage(set-theme) 전송.
// document/window 접근은 모두 useEffect(클라이언트) 내부 → SSR-safe.
export default function Comment() {
  const commentsEl = useRef(null)

  useEffect(() => {
    const utterancesTheme = () =>
      document.documentElement.dataset.theme === "dark"
        ? "github-dark"
        : "github-light"

    const scriptEl = document.createElement("script")
    scriptEl.async = true
    scriptEl.src = "https://utteranc.es/client.js"
    scriptEl.setAttribute("repo", "jsh0128/jsh0128.github.io")
    scriptEl.setAttribute("issue-term", "pathname")
    scriptEl.setAttribute("theme", utterancesTheme())
    scriptEl.setAttribute("crossorigin", "anonymous")
    commentsEl.current?.appendChild(scriptEl)

    // 사용자가 테마를 토글하면 이미 로드된 위젯에도 즉시 반영한다.
    const sendTheme = () => {
      const frame = document.querySelector(".utterances-frame")
      frame?.contentWindow?.postMessage(
        { type: "set-theme", theme: utterancesTheme() },
        "https://utteranc.es"
      )
    }

    const observer = new MutationObserver(sendTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })
  }, [])

  return <div ref={commentsEl} />
}
