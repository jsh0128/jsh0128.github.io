---
title: react-hook-form
date: 2023-08-04 00:00:02
category: develop
thumbnail: { thumbnailSrc }
draft: false
img: https://github.com/jsh0128/Blog/assets/52942411/3b339438-454b-4266-8ef0-927c93122f86
---

![react-hook-form](https://github.com/jsh0128/Blog/assets/52942411/3b339438-454b-4266-8ef0-927c93122f86)
react-hook-form 동작 방식 등 기본적인 것들에 대해서 하는 글입니다 👏

react-hook-form은 렌더링 개선을 위해 만들어진 라이브러리입니다.
useState를 이용하여 Input의 value를 관리하면, input에 onChange를 걸게되며 onChange 실행 시 useState관리하는 컴포넌트가 **re-render** 됩니다. 이런 점을 해결하기 위해 나온 lib가 **react-hook-form**입니다 👍

react-hook-form 사용시 기본 모드로 사용하게 되면 register로 관리하게 되는데 register를 log 찍게 되면 name, ref, onChange, onBlur이 나오게 됩니다.
<img width="375" alt="image" src="https://github.com/jsh0128/Blog/assets/52942411/2c9c8ba3-2908-4a27-8dc9-2ef7f5ed2c48">

> 위의 사진을 참고하면 onBlur, onChange는 비동기입니다.
> TypeScript 사용시 Promise로 타입을 반환하여 async await을 사용하게 되면 비동기로 동작하게 됩니다 !

**register를 받아서 input에 전달하게 되면 onChange시에 렌더를 하지 않습니다.**
onChange시에 ref에 값을 전달 -> onSubmit 을 하게되면 ref에 있는 값을 들고옴.

input에 **useState**로 관리하면 onChange시 값을 변경하게 되면 **re-render**하는 반면 register로 관리하게 되면 상단에서 state를 관리해도 **re-render**가 일어나지 않기 때문에 성능면에서 더 좋은 이점을 챙길 수 있습니다.

극명하게 차이나는 시점은 아마 모달에서 input을 몇십개 이상 관리하는 컴포넌트에서 성능이 극명하게 차이가 난다고 생각합니다.

예를 들어 onClick을 할때 서버에 값을 보내야 되는 상황에 모달에 input이 몇십개가 넘는 상황이면 모달에서 useState 전체를 관리하게 될것입니다.
그럼 input 하나의 값을 변경할 때 마다 모달 전체가 rerender가 일어나게 되며 성능에 큰 이슈를 줄 수 있으며 웹 사이트 자체가 버벅거림을 느낄 수도 있습니다. 하지만 react-hook-form으로 관리하게 되면 이런 일을 미연에 방지할 수 있습니다.

하지만 react-hook-form도 단점이 없을 수 있다고 할 수는 없습니다. 만약 UI 라이브러리를 사용하게 되면, 당연히 호환성이 안맞을 수 있으며 사용에 있어 어려움을 겪을 수 있습니다. 더 극명한 예를 들게 된다면 MUI와 react-hook-form을 같이 쓰게 된다면 더 어려움을 느낄 수 있을 것 입니다.

왜냐하면 MUI 자체의 form을 지원하기 때문에(어떤식으로 동작하는지에 대한 이해는 없습니다.) React-hook-form과 사용함에 어려움이 있을 수 있습니다. 이부분에 유의하며 리렌더링 등 성능문제에 신경쓰며 개발해야 됩니다. 내가 현재 어떤 기술스택을 사용중인지 고려해보고 잘 도입해보시면 좋을 것 같습니다.

오늘 포스팅은 여기서 마치도록 하겠습니다. 감사합니다 :)
