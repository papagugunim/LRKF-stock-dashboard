# 롯데제과 러시아법인 재고 관리 시스템 설정 가이드

이 문서는 Google Apps Script와 Google Sheets를 이용한 재고 관리 시스템 설정 방법을 안내합니다.

## 📋 목차

1. [Google 스프레드시트 생성](#1-google-스프레드시트-생성)
2. [Google Drive 폴더 생성](#2-google-drive-폴더-생성)
3. [Google Apps Script 설정](#3-google-apps-script-설정)
4. [웹 앱 배포](#4-웹-앱-배포)
5. [대시보드 설정](#5-대시보드-설정)

---

## 1. Google 스프레드시트 생성

### 1-1. LRKF stock management system_admin (관리자 계정 관리)

1. Google Sheets에서 새 스프레드시트 생성
2. 이름: `LRKF stock management system_admin`
3. 시트 이름을 `admin`으로 변경
4. 다음 구조로 데이터 입력:

| 타입 | 값1 | 값2 | 값3 |
|------|-----|-----|-----|
| API_TOKEN | lotte-stock-2024 | | |
| USER | admin | lotte2024 | 관리자 |
| USER | moscow | moscow123 | Moscow팀 |

**컬럼 설명:**
- 타입: `API_TOKEN` 또는 `USER`
- 값1: API_TOKEN인 경우 토큰 값, USER인 경우 사용자 ID
- 값2: USER인 경우 비밀번호
- 값3: USER인 경우 표시 이름

**스프레드시트 ID 복사:**
- URL에서 `/d/` 다음에 나오는 긴 문자열이 스프레드시트 ID입니다
- 예: `https://docs.google.com/spreadsheets/d/1ABC...XYZ/edit` → `1ABC...XYZ`
- 복사해두세요!
1k2iWG7cZxPxak1bXns4CGCkm2PwS-dLHInd9W4Re-wQ/edit?gid=0#gid=0


---

### 1-2. LRKF stock management system_product ref (제품 참조 데이터)

1. Google Sheets에서 새 스프레드시트 생성
2. 이름: `LRKF stock management system_product ref`
3. 시트 이름을 `product ref`로 변경
4. 다음 구조로 데이터 입력:

| 제품코드 | 대분류 | 중분류 | 지역 | 맛 | 패키지 |
|----------|--------|--------|------|-----|--------|
| 2105 | Candy | LotteCar | 내수용 | 오리지날 | 12봉 |
| 1673 | PIE | Chocopie | 내수용 | 오리지날 | 12봉 |
| 1679 | PIE | Chocopie | 내수용 | 바나나 | 6봉 |
| 2140 | PIE | Chocopie | 내수용 | 오리지날 | 4봉 |

**컬럼 설명:**
- 제품코드: Axapta에서 나오는 제품 코드
- 대분류: Excel 데이터에 있는 경우 자동 사용, 없으면 여기서 가져옴
- 중분류: Excel 데이터에 있는 경우 자동 사용, 없으면 여기서 가져옴
- 지역: 내수용, 벨라루스용, 카작용, 소머리 등
- 맛: 오리지날, 카카오, 바나나, 딸기, 치즈, 아망테 등
- 패키지: 4봉, 6봉, 12봉, 16봉, 48봉 등

**스프레드시트 ID 복사:**
- 위와 동일한 방법으로 스프레드시트 ID를 복사해두세요!
1BjLRA823m6ODKcWbgN3UJMQv0CYO77ZmWXmRh1n9CZc/edit?gid=0#gid=0

---

## 2. Google Drive 폴더 생성

### 2-1. Stock DB 폴더 생성

1. Google Drive에서 새 폴더 생성
2. 이름: `Stock DB`
3. 이 폴더에 Axapta에서 추출한 Excel 파일을 업로드합니다
4. 파일명 형식: `YYYYMMDD.xlsx` (예: `20241111.xlsx`)

**폴더 ID 복사:**
1. 폴더를 열고 URL을 확인합니다
2. `/folders/` 다음에 나오는 문자열이 폴더 ID입니다
3. 예: `https://drive.google.com/drive/folders/1ABC...XYZ` → `1ABC...XYZ`
4. 복사해두세요!
1wNmFQVXydCD7Ywxsi6UA2XPtZ5hxNtRS

**Excel 파일 형식:**
- 시트 이름: `DB`
- 컬럼: Код номенклатуры, Наименование номенклатуры, Краткое наименование, Склад, Номер партии, Местоположение, Физ. доступно, % годности, Наименование строки, Продукция линии

---

## 3. Google Apps Script 설정

### 3-1. Apps Script 프로젝트 생성

1. [Google Apps Script](https://script.google.com/) 접속
2. 새 프로젝트 생성
3. 프로젝트 이름: `LRKF Stock Management API`

### 3-2. Drive API 활성화

1. Apps Script 편집기 왼쪽 메뉴에서 **서비스(Services)** 클릭
2. **Drive API** 추가
3. 버전: v2
4. 식별자: Drive

### 3-3. 코드 붙여넣기

1. `google-apps-script.js` 파일의 전체 내용을 복사
2. Apps Script 편집기의 `Code.gs` 파일에 붙여넣기
3. 상단의 상수 값들을 업데이트:

```javascript
const STOCK_DB_FOLDER_ID = '여기에_Stock_DB_폴더_ID_입력';
const PRODUCT_REF_SPREADSHEET_ID = '여기에_product_ref_스프레드시트_ID_입력';
const ADMIN_SPREADSHEET_ID = '여기에_admin_스프레드시트_ID_입력';
```

4. 저장 (Ctrl+S 또는 Cmd+S)

### 3-4. 권한 승인

1. 편집기 상단의 함수 선택 드롭다운에서 `testGetLatestFile` 선택
2. **실행** 버튼 클릭
3. 권한 요청 창이 나타나면:
   - **권한 검토** 클릭
   - 계정 선택
   - **고급** 클릭
   - **[프로젝트 이름](안전하지 않음)으로 이동** 클릭
   - **허용** 클릭

---

## 4. 웹 앱 배포

### 4-1. 배포

1. Apps Script 편집기 오른쪽 상단의 **배포** 버튼 클릭
2. **새 배포** 선택
3. 설정:
   - **유형 선택**: 웹 앱
   - **설명**: v1.0 초기 배포
   - **실행 권한**: 나
   - **액세스 권한**: 모든 사용자
4. **배포** 클릭
5. **웹 앱 URL** 복사 (예: `https://script.google.com/macros/s/AKfy...xyz/exec`)
https://script.google.com/macros/s/AKfycbwoZ6BVfvKwZg4GnVaPvuGHIS1K5bR_ROhcpHQZJk9hLoae0eSgcr4sBrNm9cxq8bttRA/exec

AKfycbwoZ6BVfvKwZg4GnVaPvuGHIS1K5bR_ROhcpHQZJk9hLoae0eSgcr4sBrNm9cxq8bttRA


### 4-2. 배포 업데이트 (코드 수정 시)

1. Apps Script 편집기 오른쪽 상단의 **배포** 버튼 클릭
2. **배포 관리** 선택
3. 현재 배포 옆의 **편집** 버튼 클릭
4. **버전**: 새 버전 생성
5. **배포** 클릭

---

## 5. 대시보드 설정

### 5-1. API URL 업데이트

1. `js/app.js` 파일 열기
2. 상단의 `API_URL` 변수 업데이트:

```javascript
const API_URL = '여기에_웹_앱_URL_붙여넣기';
const API_TOKEN = 'lotte-stock-2024'; // admin 스프레드시트의 API_TOKEN과 일치해야 함
```

3. 저장

### 5-2. GitHub Pages 배포

1. GitHub 저장소 페이지로 이동
2. **Settings** > **Pages**
3. **Source**: Deploy from a branch
4. **Branch**: main (또는 master), 폴더: / (root)
5. **Save** 클릭
6. 몇 분 후 사이트 URL 확인 (예: `https://username.github.io/LRKF-stock-dashboard/`)

---

## 6. 테스트

### 6-1. Apps Script 테스트

1. Apps Script 편집기에서 `testGetStockData` 함수 선택
2. **실행** 버튼 클릭
3. 하단의 **실행 로그**에서 결과 확인
4. 오류가 없으면 성공!

### 6-2. 대시보드 테스트

1. GitHub Pages URL 접속
2. 로그인 페이지에서 계정 입력 (예: `admin` / `lotte2024`)
3. 재고 데이터가 정상적으로 로드되는지 확인
4. 필터 기능 테스트

---

## 🔧 문제 해결

### 오류: "Stock DB 폴더 접근 실패"
- STOCK_DB_FOLDER_ID가 올바른지 확인
- Drive API가 활성화되어 있는지 확인
- Google Drive에서 폴더 공유 권한 확인

### 오류: "DB 시트를 찾을 수 없습니다"
- Excel 파일의 시트 이름이 "DB"인지 확인
- 파일 형식이 .xlsx인지 확인

### 오류: "인증 실패"
- API_TOKEN이 일치하는지 확인 (js/app.js와 admin 스프레드시트)
- admin 스프레드시트 ID가 올바른지 확인
- 시트 이름이 "admin"인지 확인

### 로그인이 안 됨
- admin 스프레드시트의 사용자 정보 확인
- 타입이 "USER"로 되어 있는지 확인
- 대소문자 일치 여부 확인

---

## 📝 일일 업데이트 절차

1. Axapta에서 재고 데이터 추출
2. Excel 파일을 `YYYYMMDD.xlsx` 형식으로 저장 (예: `20241126.xlsx`)
3. Google Drive의 "Stock DB" 폴더에 업로드
4. 대시보드는 자동으로 최신 파일을 읽어옴 (새로고침 필요)

---

## 🎯 스프레드시트 구조 요약

### Admin 스프레드시트
- 시트명: `admin`
- 용도: 사용자 계정 및 API 토큰 관리

### Product Ref 스프레드시트
- 시트명: `product ref`
- 용도: 제품코드별 상세 정보 (지역, 맛, 패키지)

### Stock DB 폴더
- 용도: 일일 재고 데이터 Excel 파일 저장
- 파일명 형식: `YYYYMMDD.xlsx`
- 시트명: `DB`

---

## ✅ 체크리스트

설정 완료 여부를 확인하세요:

- [ ] Admin 스프레드시트 생성 및 ID 복사
- [ ] Product Ref 스프레드시트 생성 및 ID 복사
- [ ] Stock DB 폴더 생성 및 ID 복사
- [ ] Apps Script 프로젝트 생성
- [ ] Drive API 활성화
- [ ] Apps Script 코드 붙여넣기 및 ID 업데이트
- [ ] 권한 승인
- [ ] 웹 앱 배포 및 URL 복사
- [ ] js/app.js에 API URL 업데이트
- [ ] GitHub Pages 배포
- [ ] 테스트 완료

---

설정이 완료되었습니다! 🎉

문제가 발생하면 Apps Script 편집기의 **실행 로그**를 확인하거나, GitHub Issues에 문의하세요.
