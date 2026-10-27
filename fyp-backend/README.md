# 진로 추천 서비스 백엔드

개인 졸업 프로젝트의 FastAPI API입니다. 프로젝트 전체 배경과 담당 범위는 [최상위 README](../README.md)에 정리했습니다.

## 주요 구성

| 영역 | 코드 |
| --- | --- |
| API 등록과 시작 시 자원 로딩 | [app/main.py](app/main.py) |
| DB 설정·엄격 모드 | [app/config.py](app/config.py) |
| TF-IDF 기반 역량 추출 | [app/services/skill_extractor.py](app/services/skill_extractor.py) |
| DB 역량명 매칭 | [app/services/nlp_extractor.py](app/services/nlp_extractor.py) |
| 직업·전공 추천 모델과 메타데이터 | [app/services/ml_recommender.py](app/services/ml_recommender.py) |

Llama 학습·추론 실험은 [별도 노트북](../Model/Train.ipynb)에서 수행합니다. API의 TF-IDF·DB 매칭 경로와 같은 기능으로 간주하지 않습니다.

## 실행에 필요한 자원

- Python 3.11 이상과 `requirements.txt` 의존성
- `.env.example`을 복사한 `.env`
- ESCO 및 직업·전공 추천용 MySQL 데이터와 테이블
- `app/ml_assets/job_recommender_fast.pkl`의 실제 모델 파일과 `skill_index.json`
- 추천 결과를 직업·역량·전공에 연결하는 메타데이터

추천 모델이 Git LFS 포인터로 내려온 경우 실제 모델 파일을 받아야 합니다. 학습·추천 자원의 준비 상태는 [app/ml_assets/](app/ml_assets/)와 [데이터 준비 스크립트](scripts/)에서 확인할 수 있습니다.

## 환경 변수

```bash
cp .env.example .env
python -m pip install -r requirements.txt
```

| 설정 | 역할 |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | 직업·역량 데이터용 MySQL 연결 |
| `ORM_DB_URL` 또는 `ORM_USE_MYSQL` | 인증·사용자 등 ORM 테이블의 저장소 선택 |
| `JWT_SECRET`, `JWT_ALGORITHM` | 인증 토큰 설정 |
| `CORS_ORIGINS` | 웹 화면에서 API 호출을 허용할 주소 |

직업·역량 데이터 접근과 인증용 ORM 저장소는 별도 설정 경로가 있습니다. 개발용 SQLite 설정만으로 MySQL 추천 데이터까지 준비되는 것은 아닙니다. `.env.example`과 [설정 코드](app/config.py)의 값을 함께 맞춰야 합니다.

현재 저장소에는 최상위 `docker-compose.yml`이나 `fyp-db/init/`가 없습니다. MySQL을 별도로 준비하고, [scripts/](scripts/)의 스키마·가져오기 스크립트를 사용하는 데이터 구성에 맞춰 적용합니다.

## 실행

`fyp-backend`에서 실행합니다.

```bash
uvicorn app.main:app --reload --port 8001
```

- API 문서: `http://127.0.0.1:8001/docs`
- 상태 확인: `http://127.0.0.1:8001/health/`
- DB 상태 확인: `http://127.0.0.1:8001/health/db`
- 웹 화면 API 주소: `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001`

앱 시작 단계에서 추천 모델과 메타데이터를 로딩합니다. 이 단계가 실패하면 상태 확인 API도 호출할 수 없으므로, 먼저 서버 시작 로그의 모델·DB 오류를 확인해야 합니다.

## API 영역

| 영역 | 예시 |
| --- | --- |
| 인증·사용자 | `/auth/register`, `/auth/login`, `/users/me` |
| 역량·직업 탐색 | `/api/skills/search`, `/api/jobs/{job_id}` |
| 추천 | `/recommend/nlp/extract-skills`, `/api/recommend/jobs` |
| 전공·학습 경로 | 전공·교육·학습 경로 관련 라우터 |
| 관리자 | `/admin/stats` |

전체 요청·응답은 실행한 서버의 `/docs`와 [라우터 코드](app/api/routes/)가 기준입니다.

## 테스트

```bash
python -m pytest
```

[tests/](tests/)에는 인증, 프로필, 역량 검색, 추천·전공 API 등의 테스트가 있습니다. DB·모델 자원과 테스트 fixture 구성을 확인한 뒤 실행합니다.

`JWT_SECRET`은 공백 없는 무작위 값으로 32바이트 이상 지정해야 합니다. 누락되거나 짧으면 설정 검증에서 시작을 중단합니다. 예를 들어 로컬에서 `python -c "import secrets; print(secrets.token_urlsafe(32))"`로 생성해 `.env`에 저장할 수 있습니다. 키를 바꾸면 기존 로그인 토큰은 다시 발급받아야 합니다.

### Administrator provisioning

Public registration rejects addresses configured as administrators. Create the account with `python -m scripts.create_admin --email admin@example.com` from the backend directory. Configure a strong `JWT_SECRET` before starting the service. Ordinary accounts do not have email verification; the administrator allowlist is not a substitute for verified identity.
