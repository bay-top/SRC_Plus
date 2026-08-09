param(
  [string]$D1Name = "cardnews-db",
  [string]$R2Bucket = "cardnews-assets",
  [string]$Queue = "cardnews-jobs",
  [string]$DeadLetterQueue = "cardnews-jobs-dlq"
)

$ErrorActionPreference = "Stop"

Write-Host "[1/6] Node.js / npm 확인"
node --version
npm --version

Write-Host "[2/6] 의존성 설치"
npm install

Write-Host "[3/6] Cloudflare 로그인"
npx wrangler login
npx wrangler whoami

Write-Host "[4/6] Cloudflare 리소스 생성"
Write-Host "이미 존재한다는 오류가 나오면 해당 항목은 건너뛰어도 됩니다."
npx wrangler d1 create $D1Name
npx wrangler r2 bucket create $R2Bucket
npx wrangler queues create $Queue
npx wrangler queues create $DeadLetterQueue

Write-Host "[5/6] 다음 값을 안전한 개인 메모에 기록하세요."
Write-Host "- Cloudflare Account ID"
Write-Host "- 위 D1 생성 결과의 database_id"
Write-Host "토큰이나 비밀번호는 이 스크립트에 입력하지 않습니다."

Write-Host "[6/6] 공용 PC라면 반드시 로그아웃하세요."
Write-Host "  npx wrangler logout"
Write-Host "그리고 Cloudflare/GitHub 웹 로그아웃, 다운로드 폴더 삭제, 휴지통 비우기를 수행하세요."
