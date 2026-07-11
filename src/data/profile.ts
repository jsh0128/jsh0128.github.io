// @MX:NOTE: [AUTO] 경력/프로젝트/프로필 콘텐츠의 단일 소스(single source of truth).
// Hero/Experience/Projects/Footer 섹션이 모두 이 모듈을 소비한다. 동일 텍스트를 컴포넌트에
// 인라인 중복하지 않는다(REQ-BLOG-UI-002 / AC-002-1). 원본 문구는 research.md §1.

/** 소셜/연락 링크. label은 표시용, kind는 아이콘/접근성 분기용. */
export interface SocialLink {
  kind: "email" | "github" | "blog" | "linkedin"
  label: string
  /** URL이 없으면 렌더에서 생략된다(REQ-BLOG-UI-001 Optional). */
  url?: string
}

/** 한 회사 내 개별 프로젝트 요약. */
export interface ExperienceProject {
  name: string
  summary: string
  stack: string[]
}

/** 경력 항목(회사 단위). 역순(최신 우선)으로 배열에 담는다. */
export interface ExperienceEntry {
  company: string
  role: string
  period: string
  projects: ExperienceProject[]
}

export interface Profile {
  name: string
  title: string
  intro: string
  socials: SocialLink[]
}

export const profile: Profile = {
  name: "정성훈",
  title: "프론트엔드 개발자",
  intro:
    "B2B·B2C를 두루 경험하며 더 나은 사용자 경험을 고민하는 프론트엔드 개발자입니다.",
  socials: [
    {
      kind: "email",
      label: "Email",
      url: "mailto:wjdtjdgns0123@gmail.com",
    },
    {
      kind: "github",
      label: "GitHub",
      url: "https://github.com/jsh0128",
    },
    {
      kind: "linkedin",
      label: "LinkedIn",
      url: "https://www.linkedin.com/in/%EC%84%B1%ED%9B%88-%EC%A0%95-210691210/",
    },
  ],
}

// 역순 정렬(최신 우선): Cupist → Pluglink → Willog. 배열 순서로 역순을 보장한다(AC-002-2).
export const experiences: ExperienceEntry[] = [
  {
    company: "Cupist (큐피스트)",
    role: "Frontend",
    period: "2024.05 ~ 재직중",
    projects: [
      {
        name: "dotdotdot",
        summary:
          "AI 캐릭터 채팅 서비스. 서비스 a to z 개발, 채팅 구현 및 성능 개선, 탐색·검색 등 페이지, 웹 결제(Stripe, Paypal), WordPress + SEO를 담당했고 iOS/Android 앱을 출시했습니다.",
        stack: [
          "Next.js",
          "React",
          "React-Query",
          "Tailwind",
          "TypeScript",
          "React Native",
          "Expo",
          "Mixpanel",
        ],
      },
      {
        name: "Altcat",
        summary:
          "인플루언서 AI 이미지 서비스(종료). 서비스와 어드민 구현, 어드민 리디자인, 단일 게시물 구매·구독 기능을 개발했습니다.",
        stack: [
          "Next.js",
          "React",
          "React-Query",
          "Zustand",
          "Emotion",
          "TypeScript",
          "GA4",
          "Amplitude",
        ],
      },
    ],
  },
  {
    company: "주식회사 플러그링크 (Pluglink)",
    role: "Frontend",
    period: "2022.09 ~ 2024.02",
    projects: [
      {
        name: "Pling Connect / BM / CM",
        summary:
          "EV 충전 플랫폼. 프론트 배포 시스템 구축, atomic design 도입, react-query 최적화, react-hook-form 폼 렌더링 개선, SSG 배포를 진행했습니다. CM(운영관리)은 백오피스에서 B2B(딜라이브 CPO)로 확장했습니다.",
        stack: [
          "TypeScript",
          "Next.js (SSG)",
          "React",
          "React-Query",
          "Theme-UI",
        ],
      },
      {
        name: "Crunch Mode Dashboard",
        summary: "d3.js 기반 업무 지표 대시보드를 구현했습니다.",
        stack: ["TypeScript", "React", "d3.js"],
      },
    ],
  },
  {
    company: "주식회사 윌로그 (Willog)",
    role: "Frontend",
    period: "2021.10 ~ 2022.04",
    projects: [
      {
        name: "Bio",
        summary:
          "의약품 운송 이슈 트래킹 B2B 서비스(종근당 외 사용). 코드리뷰와 git flow를 도입했습니다.",
        stack: ["TypeScript", "React", "GraphQL", "Styled-Components", "MUI"],
      },
      {
        name: "RMS",
        summary:
          "OTQ 재고관리 백오피스. 팀 내 첫 TypeScript 도입 프로젝트였습니다.",
        stack: ["TypeScript", "React", "Recoil", "MobX"],
      },
      {
        name: "Marina",
        summary:
          "전기차 충전기 수입 배송 이슈 관리. Three.js로 2D 컨테이너를 3D로 시각화했습니다.",
        stack: ["TypeScript", "React", "Three.js", "Next.js"],
      },
    ],
  },
]
