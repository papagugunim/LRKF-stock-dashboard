// ============================================
// 롯데제과 러시아법인 재고 관리 시스템 - Google Apps Script
// ============================================
// 이 코드를 Google Apps Script 편집기에 붙여넣으세요
// 배포: Apps Script 편집기 > 배포 > 새 배포 > 유형: 웹앱 > 액세스 권한: 모든 사용자

// ⚠️ 중요: 각 스프레드시트/폴더 ID를 여기에 입력하세요
const STOCK_DB_FOLDER_ID = 'YOUR_STOCK_DB_FOLDER_ID_HERE'; // Google Drive의 "Stock DB" 폴더 ID
const PRODUCT_REF_SPREADSHEET_ID = 'YOUR_PRODUCT_REF_SPREADSHEET_ID_HERE'; // "LRKF stock management system_product ref" 스프레드시트 ID
const ADMIN_SPREADSHEET_ID = 'YOUR_ADMIN_SPREADSHEET_ID_HERE'; // "LRKF stock management system_admin" 스프레드시트 ID

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
 * Google Drive의 Stock DB 폴더에서 최신 YYYYMMDD.xlsx 파일 찾기
 */
function getLatestStockFile() {
  try {
    const folder = DriveApp.getFolderById(STOCK_DB_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.MICROSOFT_EXCEL);

    let latestFile = null;
    let latestDate = 0;

    // YYYYMMDD.xlsx 형식의 파일 중 가장 최신 파일 찾기
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      // 파일명이 YYYYMMDD.xlsx 형식인지 확인
      const match = fileName.match(/^(\d{8})\.xlsx$/);
      if (match) {
        const dateNum = parseInt(match[1]);
        if (dateNum > latestDate) {
          latestDate = dateNum;
          latestFile = file;
        }
      }
    }

    if (!latestFile) {
      throw new Error('Stock DB 폴더에 YYYYMMDD.xlsx 형식의 파일이 없습니다.');
    }

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
    const sheet = spreadsheet.getSheetByName('DB');

    if (!sheet) {
      throw new Error('DB 시트를 찾을 수 없습니다.');
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
        let categoryMain = refInfo['대분류'] || '';

        // Product ref에 대분류가 없으면 제품라인으로 판단
        if (!categoryMain || categoryMain === '기타') {
          if (productLine === 'Amante') categoryMain = '아망테';
          else if (productLine === 'Chocopie') categoryMain = '초코파이';
          else categoryMain = '기타';
        }

        groupedData[groupKey] = {
          '제품코드': code,
          '제품명': refInfo['제품명(한국어)'] || refInfo['제품명'] || row[colIndexes.shortName] || row[colIndexes.fullName] || '',
          '대분류': categoryMain,
          '중분류': refInfo['중분류'] || '기타',
          '유통기한': productionDate,
          '보관상태': row[colIndexes.location] || '',
          '보관창고': row[colIndexes.warehouse] || '',
          '재고': 0,
          '유통기한(%)': shelfLifePercent,
          '유통기한구간': shelfLifeRange,
          '지역': refInfo['지역분류'] || refInfo['지역'] || '내수용',
          '맛': refInfo['구분(맛)'] || refInfo['맛'] || '오리지날',
          '패키지': refInfo['구분(패키지)'] || refInfo['패키지'] || '기타'
        };
      }

      // 재고 합산
      groupedData[groupKey]['재고'] += stock;

      // 생산일자 수집
      if (batchNumber) {
        groupedData[groupKey].생산일자목록.push(batchNumber);
      }
    });

    // 배열로 변환
    Object.values(groupedData).forEach(item => {
      result.push(item);
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
