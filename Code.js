// ============================================
// 롯데제과 러시아법인 재고 관리 시스템 - Google Apps Script
// ============================================
// 이 코드를 Google Apps Script 편집기에 붙여넣으세요
// 배포: Apps Script 편집기 > 배포 > 새 배포 > 유형: 웹앱 > 액세스 권한: 모든 사용자

// ⚠️ 중요: 각 스프레드시트/폴더 ID를 여기에 입력하세요
const STOCK_DB_FOLDER_ID = '1TElkF4cwH42Iq9526MYcOeCyqEHfaEKx'; // Google Drive의 "Stock DB" 폴더 ID
const PRODUCT_REF_SPREADSHEET_ID = '1BjLRA823m6ODKcWbgN3UJMQv0CYO77ZmWXmRh1n9CZc'; // "LRKF stock management system_product ref" 스프레드시트 ID
const ADMIN_SPREADSHEET_ID = '1k2iWG7cZxPxak1bXns4CGCkm2PwS-dLHInd9W4Re-wQ'; // "LRKF stock management system_admin" 스프레드시트 ID

/**
 * GET 요청 처리 함수
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    // 사용자 인증 (로그인) - 토큰 검증 불필요
    if (action === 'login') {
      const username = e.parameter.username;
      const password = e.parameter.password;
      const result = authenticateUser(username, password);
      return createResponse(result.success ? 'success' : 'error', result.message, result.user);
    }

    // 디버깅: 폴더 내용 확인 (인증 불필요)
    if (action === 'debugFolder') {
      const data = debugFolderContents();
      return createResponse('success', '폴더 내용 확인', data);
    }

    // 인증 체크 (로그인 외 모든 요청)
    const authToken = e.parameter.token;
    if (!isValidToken(authToken)) {
      return createResponse('error', '인증 실패', null);
    }

    // 제품코드 마스터 데이터 가져오기
    if (action === 'getProductCodes') {
      const data = getProductCodesData();
      return createResponse('success', '제품코드 데이터 로드 성공', data);
    }

    // CP/NCP 목록 가져오기 (Product ref B열에서)
    if (action === 'getCPNCP') {
      const data = getCategoryList('CP/NCP');
      return createResponse('success', 'CP/NCP 목록 로드 성공', data);
    }

    // 판매지 목록 가져오기 (Product ref C열에서)
    if (action === 'getSalesRegion') {
      const data = getCategoryList('판매지');
      return createResponse('success', '판매지 목록 로드 성공', data);
    }

    // 카테고리 목록 가져오기 (Product ref D열에서)
    if (action === 'getCategoryMain') {
      const data = getCategoryMainList();
      return createResponse('success', '카테고리 목록 로드 성공', data);
    }

    // 브랜드 목록 가져오기 (Product ref E열에서)
    if (action === 'getCategoryRegion') {
      const data = getCategoryList('브랜드');
      return createResponse('success', '브랜드 목록 로드 성공', data);
    }

    // 맛 목록 가져오기 (Product ref F열에서)
    if (action === 'getCategoryTaste') {
      const data = getCategoryList('맛');
      return createResponse('success', '맛 목록 로드 성공', data);
    }

    // 패키지 목록 가져오기 (Product ref G열에서)
    if (action === 'getCategoryPackage') {
      const data = getCategoryList('패키지');
      return createResponse('success', '패키지 목록 로드 성공', data);
    }

    // 재고 현황 데이터 가져오기 (Google Drive의 최신 YYYYMMDD.xlsx 파일에서)
    if (action === 'getStock') {
      const data = getStockDataFromDrive();
      return createResponse('success', '재고 데이터 로드 성공', data);
    }

    return createResponse('error', '알 수 없는 요청', null);

  } catch (error) {
    Logger.log('오류 발생: ' + error.toString());
    return createResponse('error', error.toString(), null);
  }
}

/**
 * Google Drive의 Stock DB 폴더에서 최신 재고 파일 찾기
 * 지원 형식: 재고raw데이터_YYYYMMDD.xlsx, 재고raw데이터 YYYYMMDD.xlsx, YYYYMMDD.xlsx 등
 */
function getLatestStockFile() {
  try {
    const folder = DriveApp.getFolderById(STOCK_DB_FOLDER_ID);
    const files = folder.getFiles();

    let latestFile = null;
    let latestDate = 0;

    // 다양한 파일명 형식에서 날짜 추출 및 최신 파일 찾기
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      // .xlsx 파일만 처리
      if (!fileName.toLowerCase().endsWith('.xlsx')) {
        continue;
      }

      Logger.log('파일 확인: ' + fileName);

      let dateNum = 0;

      // 패턴 1: 재고raw데이터_YYYYMMDD.xlsx 또는 재고raw데이터 YYYYMMDD.xlsx
      let match = fileName.match(/재고raw데이터[_\s]*(\d{8})\.xlsx$/i);
      if (match) {
        dateNum = parseInt(match[1]);
      }

      // 패턴 2: 재고raw데이터_YYYY-MM-DD.xlsx 또는 재고raw데이터 YYYY-MM-DD.xlsx
      if (!dateNum) {
        match = fileName.match(/재고raw데이터[_\s]*(\d{4})-(\d{2})-(\d{2})\.xlsx$/i);
        if (match) {
          dateNum = parseInt(match[1] + match[2] + match[3]);
        }
      }

      // 패턴 3: YYYYMMDD.xlsx (기존 형식)
      if (!dateNum) {
        match = fileName.match(/^(\d{8})\.xlsx$/);
        if (match) {
          dateNum = parseInt(match[1]);
        }
      }

      if (dateNum > latestDate) {
        latestDate = dateNum;
        latestFile = file;
        Logger.log('최신 파일 업데이트: ' + fileName + ' (날짜: ' + dateNum + ')');
      }
    }

    if (!latestFile) {
      throw new Error('Stock DB 폴더에 엑셀 파일이 없습니다.');
    }

    Logger.log('선택된 최신 파일: ' + latestFile.getName());
    return latestFile;
  } catch (error) {
    Logger.log('파일 찾기 오류: ' + error.toString());
    throw new Error('Stock DB 폴더 접근 실패: ' + error.toString());
  }
}

/**
 * Google Drive의 최신 재고 파일에서 데이터 가져오기
 */
function getStockDataFromDrive() {
  try {
    // 최신 파일 찾기
    const file = getLatestStockFile();
    Logger.log('최신 파일: ' + file.getName());

    // Excel 파일을 임시 스프레드시트로 변환
    const resource = {
      title: 'temp_stock_' + new Date().getTime(),
      mimeType: MimeType.GOOGLE_SHEETS
    };

    const tempFile = Drive.Files.copy(resource, file.getId(), {
      convert: true
    });

    // 임시 스프레드시트 열기
    const spreadsheet = SpreadsheetApp.openById(tempFile.id);

    // 사용 가능한 시트 목록 확인
    const sheets = spreadsheet.getSheets();
    const sheetNames = sheets.map(s => s.getName());
    Logger.log('사용 가능한 시트: ' + sheetNames.join(', '));

    // 'DB' 시트 찾기
    let sheet = spreadsheet.getSheetByName('DB');

    // 'DB' 시트가 없으면 첫 번째 시트 사용
    if (!sheet) {
      Logger.log('DB 시트를 찾을 수 없음. 첫 번째 시트 사용: ' + sheetNames[0]);
      sheet = sheets[0];
    }

    if (!sheet) {
      throw new Error('시트를 찾을 수 없습니다. 사용 가능한 시트: ' + sheetNames.join(', '));
    }

    // 데이터 읽기
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    // 컬럼 인덱스 찾기
    const colIndexes = {
      code: headers.indexOf('Код номенклатуры'),
      fullName: headers.indexOf('Наименование номенклатуры'),
      shortName: headers.indexOf('Краткое наименование'),
      warehouse: headers.indexOf('Склад'),
      batchNumber: headers.indexOf('Номер партии'),
      location: headers.indexOf('Местоположение'),
      stock: headers.indexOf('Физ. доступно'),
      shelfLife: headers.indexOf('% годности'),
      category: headers.indexOf('Наименование строки'),
      productLine: headers.indexOf('Продукция линии')
    };

    // Product ref 데이터 가져오기 (제품코드별 추가 정보)
    const productRefData = getProductRefMap();

    // 데이터 변환
    const result = [];
    const groupedData = {}; // 제품코드 + 유통기한 구간별 그룹화

    rows.forEach(row => {
      if (!row[colIndexes.code]) return; // 빈 행 제외

      const code = row[colIndexes.code].toString();
      const stock = parseFloat(row[colIndexes.stock]) || 0;

      // 재고량이 1 이하인 항목 제외 (소수점 재고 포함)
      if (stock <= 1) return;

      const shelfLifePercent = parseFloat(row[colIndexes.shelfLife]) || 0;
      const batchNumber = row[colIndexes.batchNumber] ? row[colIndexes.batchNumber].toString() : '';

      // 유통기한 변환 (DDMMYYYY → YYYY-MM-DD)
      const productionDate = convertBatchNumberToDate(batchNumber);

      // 유통기한 구간 계산
      const shelfLifeRange = getShelfLifeRange(shelfLifePercent);

      // 그룹화 키: 제품코드 + 유통기한 구간
      const groupKey = `${code}_${shelfLifeRange}`;

      if (!groupedData[groupKey]) {
        // Product ref에서 추가 정보 가져오기 (우선순위: Product Ref 사용)
        const refInfo = productRefData[code] || {};

        // 제품라인 기반 대분류 결정
        const productLine = row[colIndexes.productLine] || '';
        let categoryMain = refInfo['카테고리'] || '';

        // Product ref에 카테고리가 없으면 제품라인으로 판단
        if (!categoryMain || categoryMain === '기타') {
          if (productLine === 'Amante') categoryMain = '아망테';
          else if (productLine === 'Chocopie') categoryMain = '초코파이';
          else categoryMain = '기타';
        }

        groupedData[groupKey] = {
          '제품코드': code,
          'CP/NCP': refInfo['CP/NCP'] || '-',
          '판매지': refInfo['판매지'] || '내수용',
          '제품명': refInfo['제품명'] || row[colIndexes.shortName] || row[colIndexes.fullName] || '',
          '대분류': categoryMain,
          '중분류': '기타',
          '유통기한': productionDate,
          '보관상태': row[colIndexes.location] || '',
          '보관창고': row[colIndexes.warehouse] || '',
          '재고': 0,
          '유통기한(%)': shelfLifePercent,
          '유통기한구간': shelfLifeRange,
          '지역': refInfo['브랜드'] || '내수용',
          '맛': refInfo['맛'] || '오리지날',
          '패키지': refInfo['패키지'] || '기타',
          '비고': refInfo['비고'] || '',
          '생산일자목록': []
        };
      }

      // 재고 합산
      groupedData[groupKey]['재고'] += stock;

      // 생산일자 수집
      if (batchNumber) {
        groupedData[groupKey].생산일자목록.push(batchNumber);
      }
    });

    // 배열로 변환 (재고가 1보다 큰 항목만)
    Object.values(groupedData).forEach(item => {
      if (item['재고'] > 1) {
        result.push(item);
      }
    });

    // 임시 파일 삭제
    DriveApp.getFileById(tempFile.id).setTrashed(true);

    Logger.log(`데이터 변환 완료: ${result.length}개 항목`);
    return result;

  } catch (error) {
    Logger.log('재고 데이터 로드 오류: ' + error.toString());
    throw new Error('재고 데이터 로드 실패: ' + error.toString());
  }
}

/**
 * 배치번호를 날짜로 변환 (DDMMYYYY → YYYY-MM-DD)
 */
function convertBatchNumberToDate(batchNumber) {
  if (!batchNumber || batchNumber.length !== 8) {
    return '';
  }

  try {
    const day = batchNumber.substring(0, 2);
    const month = batchNumber.substring(2, 4);
    const year = batchNumber.substring(4, 8);
    return `${year}-${month}-${day}`;
  } catch (error) {
    return '';
  }
}

/**
 * 유통기한 퍼센트를 구간으로 변환
 */
function getShelfLifeRange(percent) {
  if (percent >= 80) return '80% 이상';
  if (percent >= 60) return '60~80%';
  if (percent >= 40) return '40~60%';
  if (percent >= 20) return '20~40%';
  return '20% 미만';
}

/**
 * Product ref 데이터를 Map 형태로 가져오기
 */
function getProductRefMap() {
  try {
    const sheet = SpreadsheetApp.openById(PRODUCT_REF_SPREADSHEET_ID).getSheetByName('product ref');
    if (!sheet) {
      Logger.log('product ref 시트를 찾을 수 없습니다.');
      return {};
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    // 헤더 정보 로그
    Logger.log('Product ref 헤더: ' + JSON.stringify(headers));

    const productMap = {};

    rows.forEach(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });

      // 제품코드를 키로 사용
      const code = obj['제품코드'];
      if (code) {
        productMap[code.toString()] = obj;
      }
    });

    return productMap;
  } catch (error) {
    Logger.log('Product ref 데이터 로드 오류: ' + error.toString());
    return {};
  }
}

/**
 * 제품코드 마스터 데이터 가져오기 (호환성 유지)
 */
function getProductCodesData() {
  try {
    const sheet = SpreadsheetApp.openById(PRODUCT_REF_SPREADSHEET_ID).getSheetByName('product ref');
    if (!sheet) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    return rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
  } catch (error) {
    Logger.log('제품코드 데이터 로드 오류: ' + error.toString());
    return [];
  }
}

/**
 * Product ref에서 카테고리 목록 가져오기 (C열)
 */
function getCategoryMainList() {
  return getCategoryList('카테고리');
}

/**
 * Product ref에서 특정 컬럼의 고유값 목록 가져오기 (범용 함수)
 */
function getCategoryList(columnName) {
  try {
    const sheet = SpreadsheetApp.openById(PRODUCT_REF_SPREADSHEET_ID).getSheetByName('product ref');
    if (!sheet) {
      Logger.log('product ref 시트를 찾을 수 없습니다.');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    // 컬럼 인덱스 찾기
    const columnIndex = headers.indexOf(columnName);

    if (columnIndex === -1) {
      Logger.log(columnName + ' 컬럼을 찾을 수 없습니다.');
      return [];
    }

    // 중복 제거를 위한 Set 사용
    const categorySet = new Set();

    rows.forEach(row => {
      const category = row[columnIndex];
      if (category && category !== '') {
        categorySet.add(category.toString());
      }
    });

    // 배열로 변환하고 정렬
    const categories = Array.from(categorySet).sort();

    Logger.log(columnName + ' 목록: ' + categories.join(', '));
    return categories;

  } catch (error) {
    Logger.log(columnName + ' 목록 로드 오류: ' + error.toString());
    return [];
  }
}

/**
 * 사용자 인증
 */
function authenticateUser(username, password) {
  try {
    const adminSheet = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID).getSheetByName('admin');
    if (!adminSheet) {
      throw new Error('admin 시트를 찾을 수 없습니다.');
    }

    const data = adminSheet.getDataRange().getValues();

    // 사용자 정보 찾기
    for (let i = 1; i < data.length; i++) {
      const userType = data[i][0]; // 타입 (예: USER)
      const storedUsername = data[i][1];
      const storedPassword = data[i][2];
      const displayName = data[i][3];

      if (userType === 'USER' && storedUsername === username && storedPassword === password) {
        return {
          success: true,
          message: '로그인 성공',
          user: {
            username: username,
            name: displayName
          }
        };
      }
    }

    return {
      success: false,
      message: '아이디 또는 비밀번호가 올바르지 않습니다',
      user: null
    };
  } catch (error) {
    Logger.log('인증 오류: ' + error.toString());
    return {
      success: false,
      message: '인증 시스템 오류: ' + error.toString(),
      user: null
    };
  }
}

/**
 * 토큰 검증
 */
function isValidToken(token) {
  const validToken = getValidToken();
  return token === validToken;
}

/**
 * 유효한 토큰 가져오기
 */
function getValidToken() {
  try {
    const adminSheet = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID).getSheetByName('admin');
    if (!adminSheet) {
      return 'lotte-stock-2024'; // 기본 토큰
    }

    const data = adminSheet.getDataRange().getValues();

    // API_TOKEN 찾기
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'API_TOKEN') {
        return data[i][1];
      }
    }

    return 'lotte-stock-2024'; // 기본 토큰
  } catch (error) {
    Logger.log('토큰 조회 오류: ' + error.toString());
    return 'lotte-stock-2024'; // 기본 토큰
  }
}

/**
 * 응답 생성
 */
function createResponse(status, message, data) {
  const response = {
    status: status,
    message: message,
    data: data,
    timestamp: new Date().toISOString()
  };

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 재고 통계 보기 (수동 실행용)
 */
function showStockStats() {
  try {
    const stockData = getStockDataFromDrive();

    let totalStock = 0;
    const productCounts = {};

    stockData.forEach(item => {
      const stock = parseFloat(item['재고']) || 0;
      totalStock += stock;

      const category = item['대분류'] || '기타';
      productCounts[category] = (productCounts[category] || 0) + 1;
    });

    let message = `📊 재고 통계\n\n`;
    message += `전체 재고량: ${totalStock.toFixed(0)} 박스\n`;
    message += `제품 종류: ${stockData.length} SKU\n\n`;
    message += `카테고리별 제품 수:\n`;

    Object.entries(productCounts).forEach(([category, count]) => {
      message += `  • ${category}: ${count}개\n`;
    });

    Logger.log(message);
    return message;
  } catch (error) {
    Logger.log('통계 생성 오류: ' + error.toString());
    return '통계 생성 실패: ' + error.toString();
  }
}

/**
 * 테스트 함수 - 최신 파일 확인
 */
function testGetLatestFile() {
  try {
    const file = getLatestStockFile();
    Logger.log('최신 파일명: ' + file.getName());
    Logger.log('파일 ID: ' + file.getId());
    Logger.log('생성일: ' + file.getDateCreated());
    Logger.log('수정일: ' + file.getLastUpdated());
  } catch (error) {
    Logger.log('테스트 실패: ' + error.toString());
  }
}

/**
 * 테스트 함수 - 재고 데이터 로드
 */
function testGetStockData() {
  try {
    const data = getStockDataFromDrive();
    Logger.log('데이터 개수: ' + data.length);
    if (data.length > 0) {
      Logger.log('첫 번째 항목: ' + JSON.stringify(data[0]));
    }
  } catch (error) {
    Logger.log('테스트 실패: ' + error.toString());
  }
}

/**
 * 테스트 함수 - Product ref 데이터 확인
 */
function testProductRefMapping() {
  Logger.log('=== 테스트 시작 ===');

  try {
    Logger.log('1. Product ref 데이터 로드 시작');
    const productRefData = getProductRefMap();

    Logger.log('2. Product ref 데이터 개수: ' + Object.keys(productRefData).length);

    // 샘플 제품코드들 확인
    const testCodes = ['2141', '2142', '1684', '112', '113'];

    Logger.log('3. 샘플 제품코드 확인 시작');
    testCodes.forEach(code => {
      const refInfo = productRefData[code];
      if (refInfo) {
        Logger.log('제품코드 ' + code + ': 대분류=' + refInfo['대분류'] + ', 지역=' + refInfo['지역'] + ', 맛=' + refInfo['맛'] + ', 패키지=' + refInfo['패키지']);
      } else {
        Logger.log('제품코드 ' + code + ': 매칭 안됨');
      }
    });

    // 전체 키 목록 출력 (처음 10개만)
    const allKeys = Object.keys(productRefData);
    Logger.log('4. 전체 제품코드 개수: ' + allKeys.length);
    Logger.log('5. 처음 10개 제품코드: ' + allKeys.slice(0, 10).join(', '));

    Logger.log('=== 테스트 완료 ===');
    return '테스트 성공: ' + allKeys.length + '개 제품코드 로드됨';

  } catch (error) {
    Logger.log('=== 에러 발생 ===');
    Logger.log('에러 메시지: ' + error.toString());
    Logger.log('에러 스택: ' + error.stack);
    return '테스트 실패: ' + error.toString();
  }
}

/**
 * 디버깅용: 폴더 내용 전체 확인
 */
function debugFolderContents() {
  try {
    const folder = DriveApp.getFolderById(STOCK_DB_FOLDER_ID);
    const files = folder.getFiles();
    const result = [];

    while (files.hasNext()) {
      const file = files.next();
      result.push({
        name: file.getName(),
        id: file.getId(),
        mimeType: file.getMimeType(),
        size: file.getSize(),
        created: file.getDateCreated(),
        updated: file.getLastUpdated()
      });
    }

    return {
      folderId: STOCK_DB_FOLDER_ID,
      folderName: folder.getName(),
      fileCount: result.length,
      files: result
    };
  } catch (error) {
    return {
      error: error.toString(),
      folderId: STOCK_DB_FOLDER_ID
    };
  }
}
