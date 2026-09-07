# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code(claude.ai/code)에게 제공하는 가이드입니다.

## 프로젝트 현재 상태

이 저장소에는 현재 제품 요구사항 문서(`PRD_태양광매출자동화.md`)만 존재합니다. 아직 애플리케이션 코드, 패키지 매니페스트, 스캐폴딩이 전혀 없습니다. 빌드할 대상이 없으므로 실행할 빌드/린트/테스트 명령도 없습니다. 실제 구현이 시작되면 실제 코드를 기반으로 한 명령어와 아키텍처 설명으로 이 파일을 갱신해야 합니다.

## 이 프로젝트의 정체

태양광 발전소 매출 청구 및 데이터 정리를 자동화하는 웹앱으로, 1인 운영자가 1~40개(향후 증가 가능) 발전소를 관리하는 것을 전제로 합니다. 기존 수기 엑셀 작업 방식을 두 가지 매출 흐름에 대해 대체합니다.

- **SMP** (계통한계가격) — 한전(KEPCO)이 매월 발행하는 요금안내를 기반으로 한 전력 판매 매출.
- **REC** (신재생에너지 공급인증서) — 인증서 판매 매출.

### 핵심 SMP 프로세스 (자동화 최우선 대상)
1. 한전이 매월 중순 계약번호(발전소)별로 "신재생에너지 요금안내" 메일을 발송함. **메일 수신월은 항상 전월 발전분에 대한 내용**이며, `billing_year_month`(귀속월)를 산출할 때 이 한 달 차이를 반드시 반영해야 함.
2. 앱이 **IMAP**(다음 메일, 일정 주기 폴링)으로 메일함에 접속해 대상 메일을 자동 탐지하고 PDF로 변환·저장함(수동 업로드 불필요).
3. PDF 텍스트를 파싱하여 발전소명, 주소, 용량(kW), 발전기간, 지침 값, 단가, 공급가액, VAT 등을 추출함.
   - **예외 처리**: PDF 파싱 실패 또는 발전소명 자동 매칭 실패 건은 `parse_status = 검토필요`로 별도 목록에 표시하고, 사용자가 수동으로 발전소 지정/값 보정을 하기 전까지는 해당 월 청구에서 누락 위험이 있는 것으로 취급함. 이 목록을 비우는 것이 매월 청구 완료의 전제 조건.
4. 사용자가 PDF를 직접 다운로드하여 거래처에 전달함(자동 발송 없음).
5. 추출된 SMP 데이터와 발전소 마스터 정보(종사업장번호, 별칭, 공급받는자 사업자정보)를 결합해 한전 세금계산서 등록양식(.xls)을 자동 생성함. 이때 고정된 `construction_order`(건설순서) 기준으로 **최대 10건씩 배치 분할**함.
6. 사용자가 생성된 파일을 홈택스/이자셈홈택스에 직접 업로드함(이 앱의 범위 밖). 업로드 자체는 시스템이 알 수 없으므로, 사용자가 배치 단위로 "발행완료" 여부를 웹앱에서 수동 체크해 `tax_invoice_status`를 갱신함. 마감은 통상 매월 25일 전후이며, 미준수 시 대금 미지급·가산세 위험이 있음 — 대시보드에 마감 D-day 카운트다운과 미발행 배치 경고를 상시 노출함.

### REC 프로세스
매월 대표(기준) 단가 1개를 입력하면 전체 발전소에 기본값으로 적용되고, 발전소별 수량은 사용자가 직접 입력하며, 필요 시 단가를 개별 발전소 단위로 오버라이드할 수 있음. REC의 세금계산서 발행 및 홈택스 업로드 파일 생성은 명시적으로 **범위 밖**임.

### 리포팅
SMP·REC 데이터를 발전소·월 단위로 결합하여 발전소별/거래처별/전체 통합 뷰를 제공하며, 청구 상태는 미청구 → SMP확정 → 확정(SMP+REC 모두 완료) 순으로 추적함.

## 명시적 범위 제외 사항

기능 추가 전 아래 사항을 반드시 확인할 것:
- SMP의 홈택스/이자셈홈택스 실제 업로드 자동화는 하지 않음(업로드용 파일 생성까지만 지원).
- REC는 세금계산서 발행이나 홈택스 파일 생성을 전혀 하지 않음(수량·단가 관리까지만 지원).
- 과거 이력 데이터(2015~2026) 마이그레이션은 범위 외(신규 시스템은 향후 데이터부터 축적).
- 거래처로의 이메일 자동 발송 기능은 없음(다운로드 후 사용자가 직접 발송).

## 계획된 아키텍처 (PRD 9장 기준, 아직 미구현)

- **프레임워크**: Next.js (React + TypeScript), API Routes로 백엔드 로직 처리. 1단계는 로컬 실행, 4단계에서 클라우드(예: Vercel)로 배포.
- **DB**: 1단계 SQLite → 2단계 PostgreSQL/Supabase, **Prisma ORM**을 사용해 DB 전환을 설정 변경만으로 가능하게 함.
- **IMAP**: 메일 폴링에 `imapflow` 사용(다음 메일, 앱 비밀번호 인증).
- **PDF 파싱**: `pdf-parse` 또는 `pdfjs-dist` — 한전 PDF는 고정 양식이므로 텍스트 추출 후 정규식 기반 파싱으로 충분함.
- **엑셀 생성**: `exceljs` — 출력물은 한전 지정 .xls 세금계산서 양식의 컬럼 구조와 정확히 일치해야 함.
- **UI**: Tailwind CSS + shadcn/ui + TanStack Table(월별 컬럼이 많고 정렬·필터가 필요한 넓은 표) + Recharts + React Hook Form/Zod(비기능 요구사항에 따라 필수값 누락 시 저장/생성 차단) + lucide-react.

### 내비게이션 구조
상단 헤더에 메뉴 버튼(대시보드 / 발전소관리 / SMP / REC / 리포트 / 세금계산서)을 배치하며, 각 메뉴는 **완전히 새로운 화면으로 전환**됨(한 화면 내 탭/아코디언 방식 지양). 각 화면은 하나의 목적만 담당함. 표는 헤더 고정(sticky header)과 숫자 우측 정렬을 적용함. 현재 위치는 항상 헤더에서 강조 표시됨.

### 디자인 방향
딱딱한 ERP 느낌이 아닌, "오늘의집" 스타일의 차분하고 포근한 블루 톤: 소프트 블루 배경, 진한 네이비 포인트 컬러, Pretendard 폰트, 12~16px radius의 카드형 레이아웃, 은은한 soft shadow, 넉넉한 여백, 친근한 존댓말 마이크로카피, 숫자는 고정폭 폰트 등으로 가독성 유지.

## 데이터 모델 (초안, PRD 6장)

핵심 엔티티 5개 — 전체 필드 목록은 PRD 참조. `plant_id + billing_year_month` 조합은 `SmpMonthly`, `RecMonthly` 양쪽 모두 유니크 제약:
- `PlantMaster` — 발전소 식별정보, 한전 계약번호/종사업장번호, 별칭, 공급받는자(소유주) 사업자정보, `construction_order`(세금계산서 배치 분할 기준).
- `SmpMonthly` — 발전소·귀속월별 1행, PDF에서 추출된 데이터, `parse_status`(정상/검토필요), `tax_invoice_status`, `batch_id`(FK → `InvoiceBatch`, nullable) 포함. `source_pdf_path`는 로컬 경로가 아닌 스토리지 키로 취급(클라우드 전환 대비).
- `RecMonthly` — 발전소·귀속월별 1행, 수량 × 단가(단가는 `RecMonthlyDefault`에서 기본값 상속, 발전소별 오버라이드 가능).
- `RecMonthlyDefault` — 귀속월별 대표(기준) REC 단가 이력.
- `InvoiceBatch` — 특정 귀속월에 대해 생성된 세금계산서 배치(1차/2차... 순번). 포함 발전소 목록은 별도로 들고 있지 않고 `SmpMonthly.batch_id` 역참조로 조회(양방향 참조로 인한 정합성 문제 방지).

## 보안 관련 원칙

IMAP 앱 비밀번호 등 자격증명은 DB에 평문으로 저장하지 않고 환경변수/OS 자격증명 관리자 등으로 분리 보관한다(PRD §7). 사업자번호 등 민감정보를 다루므로 로컬(1단계) 환경에서도 접근 통제를 고려해야 함.

## 핵심 용어

- **계약번호**: 한전이 발전소(계약) 단위로 부여하는 고유번호.
- **종사업장번호**: 세금계산서 발행 시 필수 입력값으로, 발전소별로 상이함.
- **발전소 별칭**: 세금계산서 비고란에 사용하는 내부 관리용 짧은 이름으로, 한전 공식명과 다를 수 있음.
- **귀속월**: PDF 내 "발전기간"을 기준으로 산출하며, 메일 수신일과는 다름(항상 한 달 차이).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
