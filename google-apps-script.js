// ============================================
// 롯데제과 러시아법인 재고 관리 시스템 - Google Apps Script
// ============================================
// 이 코드를 "LRKF stock management system" 스프레드시트의 Apps Script 편집기에 붙여넣으세요
// 배포: Apps Script 편집기 > 배포 > 새 배포 > 유형: 웹앱 > 액세스 권한: 모든 사용자

// ⚠️ 중요: Admin 스프레드시트 ID를 여기에 입력하세요
const ADMIN_SPREADSHEET_ID = 'YOUR_ADMIN_SPREADSHEET_ID_HERE'; // LRKF stock management system admin의 스프레드시트 ID

/**
 * 스프레드시트를 열 때 자동으로 실행되는 함수
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📦 재고관리')
    .addItem('📊 재고 통계 보기', 'showStockStats')
    .addItem('🔄 데이터 새로고침', 'refreshData')
    .addToUi();
}

/**
 * GET 요청 처리 함수
 * 웹 앱에서 데이터를 불러올 때 호출됩니다
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    // 인증 체크
    const authToken = e.parameter.token;
    if (!isValidToken(authToken)) {
      return createResponse('error', '인증 실패', null);
    }

    // 제품코드 마스터 데이터 가져오기
    if (action === 'getProductCodes') {
      const data = getProductCodesData();
      return createResponse('success', '제품코드 데이터 로드 성공', data);
    }

    // 재고 현황 데이터 가져오기
    if (action === 'getStock') {
      const data = getStockData();
      return createResponse('success', '재고 데이터 로드 성공', data);
    }

    // 사용자 인증 (로그인)
    if (action === 'login') {
      const username = e.parameter.username;
      const password = e.parameter.password;
      const result = authenticateUser(username, password);
      return createResponse(result.success ? 'success' : 'error', result.message, result.user);
    }

    return createResponse('error', '알 수 없는 요청', null);

  } catch (error) {
    Logger.log('오류 발생: ' + error.toString());
    return createResponse('error', error.toString(), null);
  }
}

/**
 * POST 요청 처리 함수
 * 재고 데이터 업데이트 시 호출됩니다
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // 인증 체크
    if (!isValidToken(data.token)) {
      return createResponse('error', '인증 실패', null);
    }

    // 재고 업데이트
    if (data.action === 'updateStock') {
      updateStockData(data.stockData);
      return createResponse('success', '재고 데이터가 업데이트되었습니다', null);
    }

    return createResponse('error', '알 수 없는 요청', null);

  } catch (error) {
    Logger.log('오류 발생: ' + error.toString());
    return createResponse('error', error.toString(), null);
  }
}

/**
 * 제품코드 마스터 데이터 가져오기
 */
function getProductCodesData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('제품코드마스터');
  const data = sheet.getDataRange().getValues();

  // 헤더를 제외한 데이터 반환
  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

/**
 * 재고 현황 데이터 가져오기
 */
function getStockData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('재고현황');
  const data = sheet.getDataRange().getValues();

  // 헤더를 제외한 데이터 반환
  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

/**
 * 재고 데이터 업데이트
 */
function updateStockData(stockData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('재고현황');

  // 기존 데이터 삭제 (헤더 제외)
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }

  // 새 데이터 추가
  if (stockData && stockData.length > 0) {
    const headers = Object.keys(stockData[0]);
    const rows = stockData.map(item => headers.map(header => item[header]));

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
  }
}

/**
 * Admin 스프레드시트 가져오기
 */
function getAdminSpreadsheet() {
  try {
    return SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  } catch (error) {
    Logger.log('Admin 스프레드시트 접근 실패: ' + error.toString());
    throw new Error('Admin 스프레드시트에 접근할 수 없습니다. ID를 확인하세요.');
  }
}

/**
 * 사용자 인증
 */
function authenticateUser(username, password) {
  try {
    const adminSheet = getAdminSpreadsheet().getSheetByName('설정');
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
 * 토큰 검증 (간단한 버전)
 */
function isValidToken(token) {
  // 실제 환경에서는 더 강력한 토큰 검증 필요
  // 현재는 기본 토큰만 확인
  const validToken = getValidToken();
  return token === validToken;
}

/**
 * 유효한 토큰 가져오기
 */
function getValidToken() {
  try {
    const adminSheet = getAdminSpreadsheet().getSheetByName('설정');
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
 * 재고 통계 보기
 */
function showStockStats() {
  const stockData = getStockData();

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

  const ui = SpreadsheetApp.getUi();
  ui.alert('재고 통계', message, ui.ButtonSet.OK);
}

/**
 * 데이터 새로고침
 */
function refreshData() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '데이터 새로고침',
    '데이터를 새로고침하시겠습니까?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    SpreadsheetApp.flush();
    ui.alert('완료', '데이터가 새로고침되었습니다.', ui.ButtonSet.OK);
  }
}
