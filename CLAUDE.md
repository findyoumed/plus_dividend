# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개발 서버 실행

```powershell
# 가상환경 활성화 + 서버 시작 (Windows PowerShell)
.\.venv\Scripts\Activate.ps1
uvicorn backend.app:app --reload --port 8000

# 또는 한 번에
.\run.ps1
```

엑셀 분배금 파일이 있을 경우 환경변수 지정:
```powershell
$env:DIVIDENDS_EXCEL_PATH = "C:\Users\eugene\Downloads\PLUS 고배당주 분배금 지급현황_.xlsx"
uvicorn backend.app:app --reload --port 8000
```

브라우저: `http://localhost:8000/`  
API 문서: `http://localhost:8000/docs`

## 의존성 설치

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 아키텍처

### 전체 요청 흐름

```
브라우저
  └─ GET /api/chart?start=YYYY-MM-DD&end=YYYY-MM-DD
       └─ FastAPI (backend/app.py)
            ├─ get_ohlcv(start, end)          → FinanceDataReader (KRX 티커 161510)
            └─ get_dividends(start, end, ...)  → Excel 또는 CSV
       └─ ChartResponse JSON
  └─ TradingView Lightweight Charts 렌더링 (frontend/app.js)
```

### 백엔드 레이어 (`backend/`)

- **`app.py`**: FastAPI 앱. 유일한 엔드포인트 `GET /api/chart`. 정적 파일 마운트는 반드시 API 라우트 등록 이후에 위치해야 함 (순서 중요).
- **`data_service.py`**: FinanceDataReader로 OHLCV 조회. `(start, end)` 튜플을 키로 6시간 인메모리 캐시. 서버 재시작 시 캐시 초기화됨.
- **`dividends.py`**: 분배금 로딩 우선순위 — `DIVIDENDS_EXCEL_PATH` 환경변수 경로 엑셀 → `data/dividends_fallback.csv` 순서. 분배금 날짜가 휴일이면 직전 거래일로 snap 처리.
- **`config.py`**: 티커(`161510`), 기본 시작일, 파일 경로 중앙 관리.
- **`models.py`**: Pydantic 스키마 (`Candle`, `Dividend`, `ChartResponse`).

### 프론트엔드 (`frontend/`)

- **`app.js`**: 2단계 로딩 전략.
  - **Phase 1**: 초기 6개월 로드 → 즉시 렌더링
  - **Phase 2**: 백그라운드에서 2013년~현재 전체 로드 → 완료 후 스크롤이 API 없이 `setVisibleRange()`만으로 즉각 반응
  - 스크롤 다운 시 1개월씩 이전 데이터 표시. Phase 2 완료 전에는 API 호출, 완료 후에는 visible range 조작만.
- **`index.html`**: CDN으로 TradingView Lightweight Charts v4, Pretendard 폰트 로드. 빌드 스텝 없음.
- **`style.css`**: CSS 변수 기반 다크 테마. 한국 주식 색상 관례 (빨강=상승, 파랑=하락).

### 분배금 마커 색상 로직

금액이 변경될 때마다 색상이 교대 (`MARKER_COLORS = ['#22c55e', '#f59e0b']`). 동일 금액은 동일 색상 유지. `renderMarkers()`와 `buildDivMap()` 두 곳에서 동일 로직을 독립적으로 수행하므로 수정 시 두 함수 모두 변경해야 함.

## 분배금 데이터 업데이트

실제 데이터 출처: [plusetf.co.kr](https://www.plusetf.co.kr/product/detail?n=006273) → 분배금 지급현황 엑셀 다운로드

엑셀 형식: Row 0 = 제목행, Row 1 = 컬럼명(`지급기준일 / 지급예정일 / 분배금(원) / 누적배당누계액(원)`), Row 2~ = 데이터 (역순).

분배금 이력:
- 2013~2024.04: **연 1회** 지급 (매년 4월 말, 260~750원)
- 2024.05~현재: **월간** 지급 (63~86원/월)

## 배포

- **Vercel** (프론트엔드): `vercel.json`의 `outputDirectory: "frontend"`. `/api/*` 요청을 Render 백엔드로 rewrite. `RENDER_URL_HERE`를 실제 URL로 교체 필요.
- **Render** (백엔드): `render.yaml` 참조. Start command: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`. 무료 플랜은 15분 비활동 시 cold start 발생.
- `*.xlsx` 파일은 `.gitignore`에 포함되어 git에 올라가지 않음. 서버에서는 `data/dividends_fallback.csv`가 자동으로 사용됨.
