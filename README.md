# PawNode MVP v0.1

Windows 노트북에서 **Tapo C120** 실시간 영상(HLS)과 **Petlibro** 급식을 제공하는 단일 노드 게이트웨이입니다.

## 장비

| 구분 | 모델 | 연동 |
|------|------|------|
| Camera | **Tapo C120** | RTSP → go2rtc → HLS |
| Feeder | Petlibro (PLAF 시리즈 등) | [petlibro API](https://github.com/jjjonesjr33/petlibro) |

```
Tapo C120 (RTSP)
      ↓
   go2rtc (HLS)
      ↓
Cloudflare Tunnel (선택)
      ↓
WordPress 스트리머 페이지

간식주기 버튼 → WordPress REST → PawNode `POST /api/feed` → Petlibro Cloud API
```

## 사전 요구

- Node.js 18+ (Petlibro API는 Node `fetch` 사용 — Python 불필요)
- go2rtc — `scripts/setup-go2rtc.ps1`으로 자동 설치 (Windows amd64)
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (외부 HLS 접속 시)

---

## STEP 1 — Tapo C120 RTSP 활성화

> 대상 모델: **Tapo C120** (실내 PTZ 카메라). RTSP 포트 `554`, 경로 `stream1`(1080p) / `stream2`(360p).

### Tapo 앱 설정 (C120)

1. Tapo 앱 → **기기** → C120 선택
2. **설정(⚙)** → **고급 설정** → **카메라 계정**
3. **카메라 계정 추가** — 사용자명/비밀번호 생성 (예: `pawcam` / `your-password`)
4. 같은 메뉴에서 **RTSP/ONVIF** → **RTSP 활성화**

> RTSP는 별도 계정이 필요합니다. Tapo 클라우드 로그인 비밀번호와 다릅니다.

### RTSP URL 형식 (C120)

```
rtsp://USERNAME:PASSWORD@CAMERA_IP:554/stream1
```

- `stream1` — 주 스트림 (1080p, MVP 권장)
- `stream2` — 서브 스트림 (360p, 저대역)

카메라 IP: Tapo 앱 → C120 → **기기 정보** → **IP 주소**

> C120은 Tapo 클라우드 계정과 **별도**인 **카메라 계정**으로 RTSP 인증합니다.

### VLC 테스트

1. VLC → **미디어** → **네트워크 스트림 열기**
2. RTSP URL 입력 후 **재생**
3. 실시간 영상이 보이면 성공

---

## STEP 2 — go2rtc 구성

### 1) `.env` 작성

```powershell
cd pawnode
copy .env.example .env
# .env 에 RTSP_URL 입력
```

### 2) go2rtc 설치 (Windows)

최신 [go2rtc](https://github.com/AlexxIT/go2rtc/releases) Windows amd64 바이너리를 자동 다운로드합니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-go2rtc.ps1
```

설치 결과: `pawnode/go2rtc/go2rtc.exe`

### 3) go2rtc 실행

`go2rtc.exe`가 없으면 `start-go2rtc.ps1`이 setup을 자동 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-go2rtc.ps1
```

실행 시 `.env`의 `RTSP_URL`로 `go2rtc/go2rtc.yaml`을 생성·갱신합니다.

### 4) 동작 확인

브라우저에서:

- Web UI: http://localhost:1984
- HLS: http://localhost:1984/api/stream.m3u8?src=tapo

VLC에서 HLS URL을 열어 재생을 확인합니다.

---

## STEP 3 — Node API

### 설치 및 실행

```powershell
cd pawnode
npm install
pip install -r python/requirements.txt
npm start
```

기본 포트: `http://127.0.0.1:3000`

### 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 노드 상태, go2rtc 연결 |
| GET | `/stream` | HLS URL 반환 |
| GET | `/devices` | 등록 Device 목록 |
| **POST** | **`/api/feed`** | **간식 요청 → Petlibro Cloud** |
| **GET** | **`/api/feed-status`** | **마지막 급식 / cooldown 조회** |
| POST | `/feed` | *(legacy)* `/api/feed` 와 동일 |

#### POST /api/feed

Request:

```json
{
  "streamer": "beemo",
  "viewer": "anonymous"
}
```

Flow: cooldown 검사 → log 생성 → `services/petlibro.js` → log 갱신 → JSON 응답

Success:

```json
{
  "success": true,
  "feed_id": 123,
  "remaining": 0
}
```

Cooldown active (HTTP 429):

```json
{
  "success": false,
  "message": "cooldown_active",
  "feed_id": 124,
  "remaining": 18,
  "last_feed": "2026-06-08T12:00:00.000Z"
}
```

기본 cooldown: **30초** (`FEED_COOLDOWN_SECONDS`)

Feed log (`data/feed-logs.jsonl`): `id`, `streamer`, `viewer`, `feed_time`, `status`, `response`

#### GET /api/feed-status?streamer=beemo

```json
{
  "last_feed": "2026-06-08T12:00:00.000Z",
  "cooldown_remaining": 0
}
```

#### Petlibro service (`services/petlibro.js`)

| Method | 설명 |
|--------|------|
| `feed(portion)` | Petlibro Cloud `manualFeeding` 호출 |
| `getStatus()` | 로그인·급식기 online 상태 |

`.env`:

```
PETLIBRO_EMAIL=your@email.com
PETLIBRO_PASSWORD=your-password
FEED_COOLDOWN_SECONDS=30
```

다중 스트리머 (`STREAMERS_JSON`):

```json
{
  "beemo": { "cooldown_seconds": 30 },
  "mochi": { "cooldown_seconds": 45 }
}
```

Ranking 확장: `data/ranking-events.jsonl` (weekly / monthly / donation 집계용)

#### GET /health

```json
{
  "status": "ok",
  "node_id": "beemo-node-1",
  "streamer_slug": "beemo",
  "go2rtc": { "online": true, "stream_ready": true },
  "petlibro": { "configured": true, "online": true, "device_sn": "..." }
}
```

#### GET /stream

```json
{
  "hls_url": "https://stream.example.com/api/stream.m3u8?src=tapo"
}
```

#### POST /feed (legacy)

`/api/feed` 와 동일. WordPress 구버전 연동용.

---

## STEP 4 — Petlibro

### API 참고 (Git)

PawNode 급식 스크립트는 아래 Home Assistant 연동 저장소의 Cloud API를 참고합니다.

- 저장소: [jjjonesjr33/petlibro](https://github.com/jjjonesjr33/petlibro)
- API 구현: [`custom_components/petlibro/api.py`](https://github.com/jjjonesjr33/petlibro/blob/dev/custom_components/petlibro/api.py) (dev 브랜치)
- Base URL: `https://api.us.petlibro.com` (US 리전)
- MVP 사용 엔드포인트:
  - `POST /member/auth/login` — 로그인
  - `POST /device/device/list` — 급식기 목록
  - `POST /device/device/manualFeeding` — 1회 급식

> 앱과 동시 로그인 제한이 있을 수 있습니다. [petlibro Wiki](https://github.com/jjjonesjr33/petlibro/wiki)의 Account Management 참고.

`.env`에 계정 정보를 설정합니다:

```
PETLIBRO_EMAIL=your@email.com
PETLIBRO_PASSWORD=your-password
PETLIBRO_DEVICE_SN=        # 비워두면 첫 번째 급식기 사용
PETLIBRO_REGION=US
```

### 수동 테스트

```powershell
python python/feed.py --email YOUR_EMAIL --password YOUR_PASSWORD --region US
```

MVP에서는 **1회 급식(manualFeeding)** 만 지원합니다.

---

## STEP 5 — Cloudflare Tunnel

go2rtc HLS(`:1984`)를 `https://stream.pawdomain.com`으로 외부 공개합니다.

상세 가이드: [`cloudflare/TUNNEL.md`](cloudflare/TUNNEL.md)

### 1) cloudflared 설치

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflared.ps1
```

### 2) Cloudflare 로그인 (1회)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/login-cloudflare.ps1
```

### 3) Tunnel 생성 + DNS 자동 연결

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-tunnel.ps1
```

기본값: `stream.pawdomain.com` → `http://127.0.0.1:1984`

### 4) Tunnel 실행 (go2rtc 실행 후)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-tunnel.ps1
```

### 5) 최종 HLS URL

```
https://stream.pawdomain.com/api/stream.m3u8?src=tapo
```

WordPress `wp-config.php`:

```php
define( 'PAWNODE_HLS_URL', 'https://stream.pawdomain.com/api/stream.m3u8?src=tapo' );
```

> PawNode API(`:3000`)는 Tunnel 대상이 아닙니다. WordPress 서버에서 로컬/LAN으로 호출합니다.

---

## STEP 6 — WordPress 연동

테마에 HLS 플레이어(`hls.js`)가 포함되어 있습니다.

1. `wp-config.php`에 `PAWNODE_HLS_URL` 설정
2. 스트리머 페이지 접속 → 더미 이미지 대신 실시간 영상 재생

---

## STEP 7 — 간식주기 연결

1. WordPress 관리 → **HappyPaws Core → Feed Settings** → 시뮬레이션 모드 **해제**
2. `wp-config.php`에 `PAWNODE_API_URL` 설정
3. 간식주기 버튼 → `POST /paws/v1/feed` → PawNode `POST /feed` → Petlibro

---

## 환경변수

| 변수 | 설명 |
|------|------|
| `NODE_ID` | 노드 식별자 |
| `STREAMER_SLUG` | 스트리머 slug (beemo) |
| `RTSP_URL` | Tapo RTSP URL |
| `PETLIBRO_EMAIL` | Petlibro 계정 |
| `PETLIBRO_PASSWORD` | Petlibro 비밀번호 |
| `HLS_PUBLIC_URL` | 외부 HLS URL (Tunnel) |
| `PORT` | Node API 포트 (기본 3000) |

---

## 로그

| 파일 | 내용 |
|------|------|
| `logs/feed.log` | 급식 요청/결과 |
| `logs/stream.log` | 스트림 URL 조회 |
| `logs/error.log` | 오류 |

---

## Windows 일괄 실행

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-all.ps1
```

---

## 완료 조건 체크리스트

- [ ] VLC에서 Tapo RTSP 재생
- [ ] go2rtc HLS 생성 (`/api/stream.m3u8?src=tapo`)
- [ ] Cloudflare Tunnel 외부 HLS 접속
- [ ] WordPress 스트리머 페이지 실시간 영상
- [ ] `POST /feed` 정상 응답
- [ ] Petlibro 실제 급식
- [ ] Windows 노트북에서 안정 실행
