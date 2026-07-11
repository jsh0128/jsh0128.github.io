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

    // @MX:NOTE: [AUTO] 로드 레이스 대응 — iframe 로드 도중 테마를 토글하면
    // MutationObserver 의 set-theme 가 아직 없는 iframe 으로 날아가 stale 로 고정된다.
    // utterances 는 준비되면 { type: "resize" } 를 postMessage 하므로, 그 handshake
    // 시점에 현재 테마를 재전송해 최종 테마를 반영한다. origin 은 utteranc.es 로 고정.
    const onMessage = event => {
      if (event.origin !== "https://utteranc.es") return
      if (event.data && event.data.type === "resize") sendTheme()
    }
    window.addEventListener("message", onMessage)

    return () => {
      observer.disconnect()
      window.removeEventListener("message", onMessage)
    }
  }, [])

  return <div ref={commentsEl} />
}
