# INHERITANCE 개발 기록실

게임 소스를 수정하거나 배포하지 않는 별도 정적 대시보드와 증거 수집기입니다.
회차별 기획·변경·실행 로그·문서 원문·스크린샷·요청 상태를 보관합니다.

## 실행과 공개 범위
- 로컬 미리보기: `python dev-dashboard/serve.py`, 주소 `http://127.0.0.1:4181/`.
- 이 주소는 실행 환경 내부 주소이며 외부 사용자가 접속할 수 있는 호스팅 주소가 아닙니다.
- `dev-dashboard/site/`만 별도 정적 사이트로 제공하면 됩니다.
- Sites 스킬과 게시 도구가 현재 연결되지 않아 비공개 호스팅 URL은 발급하지 않았습니다. 해당 기능 연결 후 이 디렉터리를 별도 사이트로 게시해야 합니다.
- 게임의 Vite 입력, dist, public, gh-pages 설정은 변경하지 않습니다.
- `private/`와 `site/data/`는 gitignore 대상입니다. 요청 원문·증거는 공개 게임 저장소나 게임 페이지로 자동 전송되지 않습니다.
- 정적 파일 자체에 로그인 기능이 있는 것은 아닙니다. 비공개 접근 제어는 향후 호스팅 서비스에서 설정해야 합니다.

## 요청과 기획
텍스트 파일에서 승인 상태를 명시해 요청을 등록합니다.
```sh
python dev-dashboard/collect.py request --id REQ-EXAMPLE-001 --title "요청 제목" --text-file /tmp/request.txt --approval approved
```
큰 신규 범위는 `--approval needs_confirmation`으로 등록하며 승인 전 회차 실행을 막습니다.
원래 채팅의 정확한 전송 시각은 추정하지 않고 수집기 등록 시각을 별도로 기록합니다.

기획 JSON의 필드:
```json
{
  "id": "round-0002",
  "title": "승인된 다음 개선",
  "approval": "approved",
  "requests": ["REQ-EXAMPLE-001"],
  "planning": ["이번 회차에서 해결할 문제"],
  "changes": ["실제 구현한 변경"],
  "documents": ["docs/LIVING_WORLD.md"],
  "screenshots": ["release/survey.png"],
  "limitations": ["수동 플레이는 미실시"],
  "improvements": [
    {"text": "승인 범위 안의 후속 개선", "approval": "approved"},
    {"text": "큰 신규 범위", "approval": "needs_confirmation"}
  ]
}
```

게임 소스 작성은 이 개발 채팅에서 수행합니다. 기획에 적었다는 이유로 구현 완료를 선언하지 않습니다. 수집기는 새 게임 코드를 생성하는 에이전트나 상시 실행 데몬이 아닙니다.

## 회차 완료 경로
게임의 dist 서버(기본 4180)와 대시보드 서버(4181)를 실행한 후:
```sh
python dev-dashboard/collect.py collect --plan dev-dashboard/private/current-plan.json --checks --browser scripts/check_living_world.py --dashboard
python dev-dashboard/collect.py verify
```
- `--checks`: 실제 npm build 및 Vitest JSON/로그 수집.
- `--browser`: 지정된 허용 목록의 실제 브라우저 검사. 해당 검사 중 새로 저장된 이미지에만 현재 빌드 연결을 표시.
- `--dashboard`: 실제 기록실의 문서·이미지 확대·모바일·검색 검증.
- `--archive`: 기존 문서/이미지 가져오기. 검사를 새로 실행한 것으로 표시하지 않음.
- 같은 회차 ID는 재실행/덮어쓰기 불가. 새 ID로 다음 회차를 생성해야 함.
- 회차 파일은 읽기 전용으로 보존. `hashes.json`으로 변경 탐지. 암호학적으로 서명된 원격 감사 저장소를 대신하지 않음.
- 검사가 실패해도 실패 로그를 가진 회차가 남고 요청 상태를 수정 필요로 기록.
- 승인된 개선안만 `private/next-plan.json`으로 승계. 다음 회차의 ID/변경 기록/검토를 추가한 후 개발과 검증을 진행.
- 검사/수집 과정은 네트워크 업로드를 수행하지 않음.

요청의 게시 대기 상태를 기록할 때:
```sh
python dev-dashboard/collect.py status --id REQ-DASHBOARD-001 --state awaiting_publish --round round-0001
```
상태 변경도 시각과 함께 장부에 추가됩니다.

## 근거의 구분
과거 문서의 테스트 숫자는 문서 원문 안에 남으며 새 테스트 요약으로 재사용하지 않습니다.
수동 플레이 감상은 현재 미실시로 표시합니다. 자동 브라우저 조작은 수동 플레이가 아닙니다.
기존 이미지의 정확한 빌드를 알 수 없으면 원본 빌드 미확인으로 표시합니다.
이미지 시각은 파일 저장 시각이며 임의의 촬영 시각을 만들어 넣지 않습니다.

## 검증
`check_dashboard.py`는 실제 데이터, 문서 본문, 이미지 확대/Escape, 검색, 모바일 화면, 자동/수동 구분을 검사합니다.
`collect.py verify`는 보존된 모든 파일의 SHA-256을 검사합니다.
Sites 게시와 실사용자의 비공개 접근 권한 확인은 미완료입니다.

## 오프라인 검토 파일
수집 후 `python dev-dashboard/export.py`를 실행하면 release/INHERITANCE-development-dashboard.html을 만듭니다. 문서·로그·이미지가 포함된 단일 HTML이며 다운로드 후 브라우저로 열 수 있습니다. 네트워크 요청이나 외부 게시를 하지 않습니다.
