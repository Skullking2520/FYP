# 진로 추천 서비스 웹 화면

개인 졸업 프로젝트의 Next.js 프론트엔드입니다. 사용자 경험과 역량을 입력하고 직업·전공·학습 경로를 탐색하는 화면을 제공합니다.

[프로젝트 전체 소개](../README.md) · [백엔드 실행 안내](../fyp-backend/README.md)

## 주요 화면

- 가입·로그인과 사용자 프로필
- 경험·학업·역량 입력
- 직업·전공 추천과 상세 탐색
- 학습 경로와 관리자 화면

페이지 구현은 [src/app/](src/app/), API 연결은 [src/lib/](src/lib/)에서 확인할 수 있습니다.

## 실행 순서

먼저 별도 터미널에서 백엔드와 필요한 DB·모델 자원을 준비합니다.

```bash
cd ../fyp-backend
uvicorn app.main:app --reload --port 8001
```

`fyp-ui`에서 환경 변수를 준비합니다.

```bash
cp .env.example .env.local
```

`.env.local`의 API 주소를 백엔드와 맞춥니다.

```env
UPSTREAM_API_BASE_URL=http://127.0.0.1:8001
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
```

```bash
npm ci
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 백엔드가 시작되지 않았거나 DB·모델 자원이 준비되지 않으면 인증·추천 요청도 정상 처리되지 않습니다.

## 확인 명령

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

명령은 [package.json](package.json)에 정의돼 있습니다. 백엔드에 전달하는 필드와 API 경로는 [BACKEND_REQUESTS.md](BACKEND_REQUESTS.md)도 함께 참고하세요.

서버 프록시는 `UPSTREAM_API_BASE_URL`을 먼저 사용하고, 없으면 `API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL` 순서로 읽습니다. 서로 다른 주소가 남아 있으면 브라우저 요청과 프록시의 대상이 달라질 수 있습니다. `NEXT_PUBLIC_*` 변수에는 비밀키를 넣지 않습니다.
