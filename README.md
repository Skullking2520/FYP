# AI 진로 추천 서비스

사용자의 경험과 역량을 직업·전공 정보에 연결하는 개인 졸업 프로젝트입니다.

| 항목 | 내용 |
| --- | --- |
| 수행 배경 | Asia Pacific University of Technology & Innovation 개인 졸업 프로젝트 |
| 개발자 | 현준수 |
| 범위 | 역량 추출 학습 실험, 표준 역량 연결, 추천 API, 웹 화면 |
| 구성 | 모델 학습 노트북 · FastAPI 백엔드 · Next.js 프론트엔드 |

## 해결하려던 문제

자유롭게 작성한 경험을 추천에 사용하려면, 표현이 다른 역량을 공통 기준에 연결해야 합니다. 이 프로젝트에서는 ESCO 직업·역량 데이터를 사용해 입력 경험과 직업·전공 정보를 연결했습니다.

## 직접 수행한 작업

- 부족한 역량 추출 학습 데이터를 합성·선별해 학습 실험을 구성했습니다.
- Llama 3.2 1B Instruct에 4비트 QLoRA를 적용했습니다.
- 전체 역량을 입력에 한 번에 나열하는 방식의 제약을 확인하고, 후보 생성과 ESCO 역량 연결을 분리해 실험했습니다.
- 사용자 정보, 역량, 직업·전공 추천을 다루는 API와 웹 화면을 구성했습니다.

## 어디서부터 볼 수 있나요?

| 영역 | 설명 | 시작 위치 |
| --- | --- | --- |
| 학습 실험 | Llama 3.2 1B의 4비트 양자화·LoRA 학습과 추론 실험 | [Model/Train.ipynb](Model/Train.ipynb) |
| 추천 API | 사용자·역량·직업·전공 데이터와 추천 기능 | [백엔드 안내](fyp-backend/README.md) |
| 웹 화면 | 가입·로그인, 경험 입력, 직업·전공 탐색과 추천 화면 | [프론트엔드 안내](fyp-ui/README.md) |

학습 실험과 현재 웹앱의 실행 경로는 구분됩니다. 현재 백엔드에는 TF-IDF 기반 역량 추출, DB 역량명 매칭과 별도 추천 모델을 읽는 경로가 포함돼 있습니다. 웹앱의 모든 요청에서 미세조정한 Llama를 호출하는 구조는 아닙니다.

## 실행 준비

로컬 API 안내 포트는 **8001**, 웹 화면은 **3000**으로 통일합니다.

1. 백엔드의 Python 의존성과 환경 변수를 준비합니다.
2. ESCO·직업·전공 데이터와 MySQL 테이블, 추천 모델 자원을 준비합니다.
3. 백엔드를 실행한 뒤 웹 화면의 `NEXT_PUBLIC_API_BASE_URL`을 맞춥니다.

```bash
# 저장소 루트에서, 각각 다른 터미널 사용
cd fyp-backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

```bash
cd fyp-ui
npm ci
npm run dev
```

현재 체크아웃에는 최상위 Docker Compose와 전체 DB 초기화 묶음이 포함돼 있지 않습니다. API는 시작 시 추천 모델과 데이터를 읽으므로, 의존성 설치만으로 전체 기능이 준비되지는 않습니다. 필요한 설정과 자원은 [백엔드 안내](fyp-backend/README.md)를 참고하세요.

## 학습 실험 재현 조건

학습 노트북은 CUDA·bitsandbytes·Transformers·PEFT를 사용하는 실험입니다. 학습 데이터 경로, 출력 경로와 어댑터 경로를 실행 환경에 맞게 지정해야 합니다. 학습용 JSONL과 어댑터 가중치는 현재 저장소 목록에 포함돼 있지 않습니다.

## 기술

Python · PyTorch · Transformers · PEFT · QLoRA · FastAPI · SQLAlchemy · MySQL · Next.js · TypeScript
