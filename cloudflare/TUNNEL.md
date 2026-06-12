# Cloudflare Tunnel — go2rtc HLS + PawNode API

| Host | Local service | Purpose |
|------|---------------|---------|
| `stream.chonkpaw.com` | `http://127.0.0.1:1984` | go2rtc HLS / WebRTC |
| `api.chonkpaw.com` | `http://127.0.0.1:3000` | PawNode feed API (WordPress → Petlibro) |

**Stream URL:**

```
https://stream.chonkpaw.com/api/stream.m3u8?src=tapo
```

**API health:**

```
https://api.chonkpaw.com/health
https://api.chonkpaw.com/api/feed-status?streamer=beemo
```

---

## 사전 조건

- Cloudflare에 `pawdomain.com` 존이 등록되어 있어야 합니다
- DNS가 Cloudflare 네임서버를 사용 중이어야 합니다
- go2rtc가 로컬에서 동작 중 (`scripts/start-go2rtc.ps1`)
- Windows PowerShell (관리자 권한 불필요)

---

## STEP 1 — cloudflared 설치

```powershell
cd pawnode
powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflared.ps1
```

설치 위치: `pawnode/cloudflare/cloudflared.exe`

---

## STEP 2 — Cloudflare 로그인 (1회)

브라우저가 열리면 `pawdomain.com`이 포함된 존을 선택합니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/login-cloudflare.ps1
```

성공 시: `C:\Users\<YOU>\.cloudflared\cert.pem` 생성

---

## STEP 3 — Tunnel 생성 + DNS 자동 연결

기본값: 터널명 `pawnode-stream`, 호스트 `stream.pawdomain.com`

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-tunnel.ps1
```

커스텀 도메인:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-tunnel.ps1 `
  -TunnelName pawnode-stream `
  -Hostname stream.pawdomain.com `
  -Go2rtcUrl http://127.0.0.1:1984
```

스크립트가 수행하는 작업:

1. `cloudflared tunnel create pawnode-stream`
2. `cloudflared tunnel route dns pawnode-stream stream.pawdomain.com`
3. `cloudflare/config.yml` 생성 (1984 포트 → ingress)
4. `.env`의 `HLS_PUBLIC_URL` 갱신
5. 최종 HLS URL 출력

---

## STEP 4 — Tunnel 실행

go2rtc 실행 후:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-tunnel.ps1
```

---

## STEP 5 — 외부 접속 확인

브라우저 또는 VLC:

```
https://stream.pawdomain.com/api/stream.m3u8?src=tapo
```

go2rtc Web UI (선택):

```
https://stream.pawdomain.com/
```

---

## STEP 6 — WordPress 설정

`wp-config.php`:

```php
define( 'PAWNODE_HLS_URL', 'https://stream.chonkpaw.com/api/stream.m3u8?src=tapo' );
define( 'PAWNODE_API_URL', 'https://api.chonkpaw.com' );
define( 'PAWNODE_HTTP_DEBUG', true ); // log outbound WP → PawNode HTTP
```

샘플: `docs/wp-config-pawnode.sample.php`

---

## PawNode API tunnel (Bluehost → local PC)

WordPress on Bluehost cannot reach `http://127.0.0.1:3000` on your PC.
Expose PawNode via `api.chonkpaw.com`.

### One-time DNS route (existing tunnel)

```powershell
cd pawnode
powershell -ExecutionPolicy Bypass -File scripts/route-api-dns.ps1
```

Or manually:

```powershell
cd pawnode\cloudflare
.\cloudflared.exe tunnel route dns b0b14858-a0cb-48c2-b6a1-edf5a88a300d api.chonkpaw.com
```

### config.yml ingress (already in repo)

```yaml
ingress:
  - hostname: stream.chonkpaw.com
    service: http://127.0.0.1:1984
  - hostname: api.chonkpaw.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

### Restart tunnel after config change

Foreground:

```powershell
# Stop with Ctrl+C if running, then:
powershell -ExecutionPolicy Bypass -File scripts/start-tunnel.ps1
```

Windows service:

```powershell
cd pawnode\cloudflare
.\cloudflared.exe service uninstall
.\cloudflared.exe service install
Restart-Service cloudflared
```

### Verify endpoints

```powershell
Invoke-WebRequest https://api.chonkpaw.com/health -UseBasicParsing
Invoke-WebRequest "https://api.chonkpaw.com/api/feed-status?streamer=beemo" -UseBasicParsing
```

---

## config.yml 구조 (legacy reference)

```yaml
tunnel: pawnode-stream
credentials-file: C:\Users\YOU\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: stream.pawdomain.com
    service: http://127.0.0.1:1984
    originRequest:
      noTLSVerify: true
  - hostname: api.pawdomain.com
    service: http://127.0.0.1:3000
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

> PawNode API (`:3000`) is exposed at `https://api.chonkpaw.com` for Bluehost WordPress only.
> Petlibro credentials stay on your local PawNode — never in wp-config.

---

## Windows 부팅 시 자동 실행 (선택)

Tunnel을 Windows 서비스로 등록:

```powershell
cd pawnode\cloudflare
.\cloudflared.exe service install
```

또는 작업 스케줄러에 `start-tunnel.ps1` 등록.

---

## 트러블슈팅

| 증상 | 해결 |
|------|------|
| DNS 연결 안 됨 | Cloudflare 대시보드 → DNS에 `stream` CNAME 확인 |
| 502 Bad Gateway | go2rtc 실행 여부 확인 (`http://127.0.0.1:1984/api`) |
| 로그인 실패 | `login-cloudflare.ps1` 재실행 |
| Tunnel 이름 충돌 | `-TunnelName` 다른 이름 사용 |

Tunnel 목록:

```powershell
.\cloudflare\cloudflared.exe tunnel list
```

---

## 보안 참고

- MVP에서는 go2rtc Web UI도 같은 호스트로 노출됩니다
- 운영 환경에서는 Cloudflare Access 또는 go2rtc 인증 추가를 권장합니다
