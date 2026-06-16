---
title: I’m an open-source contributor.
date: 2026-03-16 00:00:00
category: develop
thumbnail: { thumbnailSrc }
draft: false
img: https://github.com/user-attachments/assets/89d3f480-a336-4f3e-88f2-db857c4ece2e
---

평소에 Sentry를 자주 쓰는데, 요즘 MCP를 많이 만지다 보니 자연스럽게 [getsentry/sentry-mcp](https://github.com/getsentry/sentry-mcp)에도 관심이 갔습니다. 그러다 딱 제가 잡을 만한 이슈를 하나 발견했고, 운 좋게 PR이 머지되어서 그 경험을 글로 남겨보려 합니다 😀

sentry-mcp는 LLM(Claude, GPT 등)이 Sentry를 도구처럼 쓸 수 있게 해주는 **MCP 서버**입니다. 내부적으로는 자연어 요청을 받아 LLM에게 "이걸 Sentry 쿼리 문법으로 바꿔줘" 하고 시키는 **embedded agent**가 들어있는데, 바로 이 부분에서 문제가 터지고 있었습니다.

## 문제 상황

이슈([#819](https://github.com/getsentry/sentry-mcp/issues/819))는 이랬습니다. **Anthropic(Claude) provider**를 켜두고 `search_issues`를 자연어로 부르면 매번 실패한다는 거였죠.

```
search_issues("latest unresolved issues")
→ Error: No object generated: could not parse the response.
```

사용자 입장에서는 그냥 **"Feature Unavailable"** 이라는 맥 빠지는 메시지만 보게 됩니다. 더 황당한 건 `list_issues` 같은 LLM을 안 거치는 도구들은 멀쩡히 동작한다는 점이었어요. 즉, **Claude를 거치는 순간에만** 터지는 문제였습니다.

<!-- 스크린샷: search_issues 호출 시 "Feature Unavailable" 뜨는 화면 -->

## 원인을 파보니

로그를 까보니 범인은 Claude의 응답 형태였습니다. 스키마대로 **raw JSON**만 뱉어야 하는데, Claude는 종종 친절하게(?) 설명을 곁들이거나 마크다운 코드블록으로 감싸서 응답하더라구요.

````
Based on the available fields, I can translate this query as follows:

```json
{"query": "is:unresolved", "sort": "date", "explanation": "Unresolved issues"}
```
````

그런데 이걸 받아 파싱하는 `rescueFromText()` 함수는 이렇게 생겨 있었습니다.

```typescript
function rescueFromText(text, schema) {
  try {
    const parsed = JSON.parse(text) // ← text 전체를 그대로 파싱
    const result = schema.safeParse(parsed)
    if (result.success) {
      return { rescued: result.data }
    }
  } catch {
    // JSON parse 실패
  }
  return null
}
```

`JSON.parse(text)`에 **prose가 섞인 문자열 전체**를 그대로 넣으니 당연히 터지고, 그게 `UserInputError`로 올라와 "Feature Unavailable"이 되는 거였습니다. 정작 응답 안에는 **멀쩡한 JSON이 들어있는데** 그걸 못 꺼내서 버리고 있던 셈이죠 😂

## JSON 후보를 여러 전략으로 추출

생각해보면 "전체를 한 번에 파싱"하는 게 너무 빡빡했습니다. 그래서 **JSON 후보(candidate)를 여러 방법으로 뽑아낸 뒤, 스키마를 통과하는 첫 번째 것을 쓰자**는 방향으로 바꿨습니다. `extractJsonCandidates()`를 새로 만들었어요.

````typescript
function extractJsonCandidates(text) {
  const candidates = new Set([text]) // 전략 0: 기존처럼 전체 파싱

  // 전략 1: 마크다운 코드블록(```json ... ``` / ``` ... ```)에서 추출
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g
  for (const match of text.matchAll(codeBlockRegex)) {
    candidates.add(match[1].trim())
  }

  // 전략 2: prose 안에 박힌 {...} 객체 추출
  for (const jsonObject of extractBalancedJsonObjects(text)) {
    candidates.add(jsonObject)
  }

  return Array.from(candidates)
}
````

그리고 `rescueFromText()`는 후보들을 순회하며 처음으로 파싱 + 스키마 검증을 통과하는 결과를 반환하도록 바꿨습니다.

```typescript
function rescueFromText(text, schema) {
  for (const candidate of extractJsonCandidates(text)) {
    try {
      const parsed = JSON.parse(candidate)
      const result = schema.safeParse(parsed)
      if (result.success) {
        return result.data
      }
    } catch {
      // 다음 후보 시도
    }
  }
  return null
}
```

기존 동작(전체 파싱)은 **전략 0으로 그대로 살려뒀기 때문에** 기존 케이스는 회귀 없이 동작하고, 거기에 코드블록/prose 케이스만 얹은 형태입니다.

## greedy regex의 함정

처음엔 prose 안의 객체를 뽑을 때 간단하게 정규식 `/\{[\s\S]*\}/` 를 썼습니다. 그런데 이게 **greedy**라서, 첫 `{` 부터 텍스트 맨 끝의 마지막 `}` 까지 통째로 잡아먹더라구요.

```
Here is the query: {"query": "is:unresolved"} See /api/{id}/results for details.
                    ↑ 여기부터                              ↑ 여기까지 다 매칭됨 😱
```

뒤따라오는 prose에 `/api/{id}/results` 같은 중괄호가 하나라도 있으면 매칭 범위가 실제 JSON을 넘어가서 `JSON.parse`가 또 터지는 거죠. 그래서 정규식 대신 **문자 단위로 brace depth를 추적**하는 `extractBalancedJsonObjects()`로 교체했습니다.

```typescript
function extractBalancedJsonObjects(text) {
  const objects = []
  let start = -1,
    depth = 0,
    inString = false,
    escaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (depth === 0) {
      if (ch === "{") {
        start = i
        depth = 1
      }
      continue
    }
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === "\\" && inString) {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue // 문자열 안의 중괄호는 무시

    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) {
        objects.push(text.slice(start, i + 1))
        start = -1
      }
    }
  }
  return objects
}
```

포인트는 두 가지입니다.

- **문자열 내부(`inString`)의 중괄호는 세지 않는다** `"explanation": "use {field} syntax"` 같은 값에 흔들리지 않게.
- **depth가 0으로 떨어지는 순간** 첫 번째 최상위 객체가 끝났다고 보고 거기서 잘라낸다.

이렇게 하니 뒤에 어떤 prose가 붙든 **딱 첫 번째 온전한 JSON 객체만** 정확히 떼어낼 수 있었습니다. 리뷰 과정에서 메인테이너(dcramer)와 Codex가 prose에 **짝 안 맞는 따옴표**(`The 5" pipe ...`)가 있는 케이스까지 짚어줘서, quote 추적을 후보 객체 내부로만 한정하는 식으로 한 번 더 단단하게 다듬었습니다 👍

## 테스트

회귀가 무서운 부분이라 케이스를 꼼꼼히 추가했습니다.

- ` ```json ``` ` 마크다운 코드블록 안의 JSON
- 언어 표기 없는 ` ``` ``` ` 코드블록 안의 JSON
- prose 한가운데 박힌 JSON 객체
- JSON 뒤에 `}` 포함 prose가 붙은 케이스(`/api/{id}/results`)
- JSON 앞에 중괄호(`{field}`)나 짝 안 맞는 따옴표가 있는 케이스

최종적으로 **757개 테스트 전부 통과**하면서 머지됐습니다 🎉

<!-- 스크린샷: CI 또는 로컬 테스트 전체 통과(757 passed) 결과 -->

## 마무리

이번 기여로 얻은 가장 큰 교훈은, **LLM 출력은 절대 곧이곧대로 믿으면 안 된다**는 점이었습니다. 스키마를 줘도, structured output을 켜도, 모델은 언제든 prose로 감싸거나 코드블록을 두를 수 있어요. 그래서 LLM 응답을 파싱하는 코드는 항상 **방어적으로** 여러 추출 전략을 두고, 정규식보다는 상태를 추적하는 파서로 짜는 게 안전하다는 걸 몸으로 배웠습니다.

작은 함수 하나였지만 실제 사용자가 겪던 "Feature Unavailable"을 없앤 거라 뿌듯했네요. 오픈소스 기여를 망설이고 계신 분이 있다면, 이렇게 **자기가 쓰는 도구의 버그 리포트부터** 들여다보는 걸 추천드립니다 :)

- 🔗 PR: <https://github.com/getsentry/sentry-mcp/pull/840>
- 🐛 Issue: <https://github.com/getsentry/sentry-mcp/issues/819>

오늘 포스팅은 여기서 마치도록 하겠습니다. 감사합니다 :)
