// ============================================
// 디버깅용 스크립트 - 설정 확인
// ============================================
// 이 함수들을 실행하여 설정이 올바른지 확인하세요

// ⚠️ 중요: 실제 ID로 업데이트하세요
const STOCK_DB_FOLDER_ID = '1wNmFQVXydCD7Ywxsi6UA2XPtZ5hxNtRS';
const PRODUCT_REF_SPREADSHEET_ID = '1BjLRA823m6ODKcWbgN3UJMQv0CYO77ZmWXmRh1n9CZc';
const ADMIN_SPREADSHEET_ID = '1k2iWG7cZxPxak1bXns4CGCkm2PwS-dLHInd9W4Re-wQ';

/**
 * 1. Admin 스프레드시트 확인
 */
function testAdminSpreadsheet() {
  try {
    Logger.log('=== Admin 스프레드시트 테스트 ===');
    Logger.log('스프레드시트 ID: ' + ADMIN_SPREADSHEET_ID);

    const spreadsheet = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
    Logger.log('✅ 스프레드시트 열기 성공: ' + spreadsheet.getName());

    // 모든 시트 이름 출력
    const sheets = spreadsheet.getSheets();
    Logger.log('전체 시트 개수: ' + sheets.length);
    sheets.forEach(sheet => {
      Logger.log('  - 시트 이름: "' + sheet.getName() + '"');
    });

    // admin 시트 찾기
    const adminSheet = spreadsheet.getSheetByName('admin');
    if (adminSheet) {
      Logger.log('✅ "admin" 시트 찾음');
      const data = adminSheet.getDataRange().getValues();
      Logger.log('데이터 행 수: ' + data.length);
      Logger.log('첫 행 (헤더): ' + JSON.stringify(data[0]));
    } else {
      Logger.log('❌ "admin" 시트를 찾을 수 없습니다!');
      Logger.log('💡 해결방법: 시트 이름을 "admin"으로 변경하세요');
    }

  } catch (error) {
    Logger.log('❌ 오류 발생: ' + error.toString());
    Logger.log('💡 스프레드시트 ID가 올바른지 확인하세요');
  }
}

/**
 * 2. Product Ref 스프레드시트 확인
 */
function testProductRefSpreadsheet() {
  try {
    Logger.log('=== Product Ref 스프레드시트 테스트 ===');
    Logger.log('스프레드시트 ID: ' + PRODUCT_REF_SPREADSHEET_ID);

    const spreadsheet = SpreadsheetApp.openById(PRODUCT_REF_SPREADSHEET_ID);
    Logger.log('✅ 스프레드시트 열기 성공: ' + spreadsheet.getName());

    // 모든 시트 이름 출력
    const sheets = spreadsheet.getSheets();
    Logger.log('전체 시트 개수: ' + sheets.length);
    sheets.forEach(sheet => {
      Logger.log('  - 시트 이름: "' + sheet.getName() + '"');
    });

    // product ref 시트 찾기
    const refSheet = spreadsheet.getSheetByName('product ref');
    if (refSheet) {
      Logger.log('✅ "product ref" 시트 찾음');
      const data = refSheet.getDataRange().getValues();
      Logger.log('데이터 행 수: ' + data.length);
      Logger.log('첫 행 (헤더): ' + JSON.stringify(data[0]));
    } else {
      Logger.log('❌ "product ref" 시트를 찾을 수 없습니다!');
      Logger.log('💡 해결방법: 시트 이름을 "product ref"로 변경하세요');
    }

  } catch (error) {
    Logger.log('❌ 오류 발생: ' + error.toString());
    Logger.log('💡 스프레드시트 ID가 올바른지 확인하세요');
  }
}

/**
 * 3. Stock DB 폴더 확인
 */
function testStockDBFolder() {
  try {
    Logger.log('=== Stock DB 폴더 테스트 ===');
    Logger.log('폴더 ID: ' + STOCK_DB_FOLDER_ID);

    const folder = DriveApp.getFolderById(STOCK_DB_FOLDER_ID);
    Logger.log('✅ 폴더 열기 성공: ' + folder.getName());

    // 폴더 내 파일 목록
    const files = folder.getFiles();
    let fileCount = 0;
    let xlsxCount = 0;

    while (files.hasNext()) {
      const file = files.next();
      fileCount++;
      Logger.log('파일 ' + fileCount + ': ' + file.getName());

      // YYYYMMDD.xlsx 형식 체크
      const match = file.getName().match(/^(\d{8})\.xlsx$/);
      if (match) {
        xlsxCount++;
        Logger.log('  ✅ YYYYMMDD.xlsx 형식 파일');
      }
    }

    Logger.log('전체 파일 수: ' + fileCount);
    Logger.log('YYYYMMDD.xlsx 형식 파일 수: ' + xlsxCount);

    if (xlsxCount === 0) {
      Logger.log('❌ YYYYMMDD.xlsx 형식의 파일이 없습니다!');
      Logger.log('💡 해결방법: 파일명을 "20241126.xlsx" 형식으로 변경하세요');
    }

  } catch (error) {
    Logger.log('❌ 오류 발생: ' + error.toString());
    Logger.log('💡 폴더 ID가 올바른지 확인하세요');
  }
}

/**
 * 4. 전체 테스트 실행
 */
function runAllTests() {
  Logger.log('========================================');
  Logger.log('전체 설정 테스트 시작');
  Logger.log('========================================\n');

  testAdminSpreadsheet();
  Logger.log('\n');

  testProductRefSpreadsheet();
  Logger.log('\n');

  testStockDBFolder();
  Logger.log('\n');

  Logger.log('========================================');
  Logger.log('테스트 완료');
  Logger.log('========================================');
}

/**
 * 5. 최신 Stock 파일에서 시트 이름 확인
 */
function testStockFileSheets() {
  try {
    Logger.log('=== Stock 파일 시트 테스트 ===');

    // 최신 파일 찾기
    const folder = DriveApp.getFolderById(STOCK_DB_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.MICROSOFT_EXCEL);

    let latestFile = null;
    let latestDate = 0;

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
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
      Logger.log('❌ YYYYMMDD.xlsx 형식의 파일을 찾을 수 없습니다');
      return;
    }

    Logger.log('최신 파일: ' + latestFile.getName());

    // 임시로 스프레드시트로 변환
    const resource = {
      title: 'temp_test_' + new Date().getTime(),
      mimeType: MimeType.GOOGLE_SHEETS
    };

    const tempFile = Drive.Files.copy(resource, latestFile.getId(), {
      convert: true
    });

    const spreadsheet = SpreadsheetApp.openById(tempFile.id);
    Logger.log('✅ Excel 파일 변환 성공');

    // 모든 시트 이름 출력
    const sheets = spreadsheet.getSheets();
    Logger.log('전체 시트 개수: ' + sheets.length);
    sheets.forEach(sheet => {
      Logger.log('  - 시트 이름: "' + sheet.getName() + '"');
    });

    // DB 시트 찾기
    const dbSheet = spreadsheet.getSheetByName('DB');
    if (dbSheet) {
      Logger.log('✅ "DB" 시트 찾음');
      const data = dbSheet.getDataRange().getValues();
      Logger.log('데이터 행 수: ' + data.length);
      Logger.log('첫 행 (헤더): ' + JSON.stringify(data[0]));
    } else {
      Logger.log('❌ "DB" 시트를 찾을 수 없습니다!');
      Logger.log('💡 해결방법: Excel 파일의 시트 이름을 "DB"로 변경하세요');
    }

    // 임시 파일 삭제
    DriveApp.getFileById(tempFile.id).setTrashed(true);
    Logger.log('임시 파일 삭제 완료');

  } catch (error) {
    Logger.log('❌ 오류 발생: ' + error.toString());
  }
}
