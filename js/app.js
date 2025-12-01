// ============================================
// 로그인 관리 & Google Sheets 연동
// ============================================

// Google Apps Script Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbwoZ6BVfvKwZg4GnVaPvuGHIS1K5bR_ROhcpHQZJk9hLoae0eSgcr4sBrNm9cxq8bttRA/exec';
const API_TOKEN = 'lotte-stock-2024'; // Admin 스프레드시트의 API_TOKEN과 일치해야 함

// 로그인 체크
function checkAuth() {
    const currentUser = localStorage.getItem('currentUser');
    const rememberMe = localStorage.getItem('rememberMe') === 'true';

    if (currentUser && rememberMe) {
        try {
            const userData = JSON.parse(currentUser);
            showDashboard(userData);
            return true;
        } catch (e) {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('rememberMe');
        }
    }

    const sessionUser = sessionStorage.getItem('sessionUser');
    if (sessionUser) {
        try {
            const userData = JSON.parse(sessionUser);
            showDashboard(userData);
            return true;
        } catch (e) {
            sessionStorage.removeItem('sessionUser');
        }
    }

    return false;
}

// 로그인 처리 (Google Sheets API 연동)
async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const errorElement = document.getElementById('loginError');
    const loginBtn = event.target.querySelector('button[type="submit"]');

    // 로딩 상태
    loginBtn.disabled = true;
    loginBtn.textContent = '로그인 중...';

    try {
        // Google Sheets API 호출
        const url = `${API_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            // 로그인 성공
            const userData = {
                username: result.data.username,
                name: result.data.name
            };

            if (rememberMe) {
                localStorage.setItem('currentUser', JSON.stringify(userData));
                localStorage.setItem('rememberMe', 'true');
            } else {
                sessionStorage.setItem('sessionUser', JSON.stringify(userData));
            }

            showDashboard(userData);
        } else {
            // 로그인 실패
            errorElement.textContent = result.message || '로그인에 실패했습니다.';
            errorElement.style.display = 'block';

            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 3000);

            loginBtn.disabled = false;
            loginBtn.textContent = '로그인';
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        errorElement.textContent = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
        errorElement.style.display = 'block';

        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 3000);

        loginBtn.disabled = false;
        loginBtn.textContent = '로그인';
    }
}

// 대시보드 표시
function showDashboard(userData) {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainDashboard').style.display = 'block';
    document.getElementById('currentUser').textContent = userData.name || userData.username;

    // 데이터 로드 (최초 1회만)
    if (stockData.length === 0) {
        // 모든 필터 로드 (Product ref에서)
        loadAllFilters();
        // 재고 데이터 로드
        loadStockData();
    }
}

// 로그아웃 처리
function handleLogout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('sessionUser');

    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainDashboard').style.display = 'none';

    // 폼 초기화
    document.getElementById('loginForm').reset();
}

// ============================================
// 다크모드 관리
// ============================================

// 다크모드 초기화
function initDarkMode() {
    const savedTheme = localStorage.getItem('theme');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeToggleLogin = document.getElementById('darkModeToggleLogin');

    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        if (darkModeToggle) {
            darkModeToggle.textContent = '라이트모드';
        }
        if (darkModeToggleLogin) {
            darkModeToggleLogin.textContent = '라이트모드';
        }
    }
}

// 다크모드 토글
function toggleDarkMode() {
    const currentTheme = document.body.getAttribute('data-theme');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeToggleLogin = document.getElementById('darkModeToggleLogin');

    if (currentTheme === 'dark') {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if (darkModeToggle) {
            darkModeToggle.textContent = '다크모드';
        }
        if (darkModeToggleLogin) {
            darkModeToggleLogin.textContent = '다크모드';
        }
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (darkModeToggle) {
            darkModeToggle.textContent = '라이트모드';
        }
        if (darkModeToggleLogin) {
            darkModeToggleLogin.textContent = '라이트모드';
        }
    }

    // 트리맵이 렌더링되어 있으면 다시 렌더링 (다크모드 색상 적용)
    if (treemapChart && filteredData.length > 0) {
        renderTreemap();
    }
}

// ============================================
// 재고 관리 (기존 코드)
// ============================================

// 전역 변수
let stockData = [];
let filteredData = [];
let productCodeMap = {}; // 제품코드 -> 한국어 제품명 매핑
let currentPage = 1;
let itemsPerPage = 100;
let sortColumn = null;
let sortDirection = 'asc';
let treemapChart = null; // ECharts 트리맵 인스턴스

// CSV 파싱 함수
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].replace(/^\uFEFF/, '').split(',');

    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, index) => {
            obj[header.trim()] = values[index] ? values[index].trim() : '';
        });
        return obj;
    });
}

// 숫자 포맷팅 (콤마 추가)
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 모스크바 시간으로 현재 날짜와 시각 가져오기
function getMoscowTime() {
    const now = new Date();

    // 모스크바 시간대로 변환 (Europe/Moscow)
    const moscowTime = new Date(now.toLocaleString('en-US', {
        timeZone: 'Europe/Moscow'
    }));

    const year = moscowTime.getFullYear();
    const month = String(moscowTime.getMonth() + 1).padStart(2, '0');
    const day = String(moscowTime.getDate()).padStart(2, '0');
    const hours = String(moscowTime.getHours()).padStart(2, '0');
    const minutes = String(moscowTime.getMinutes()).padStart(2, '0');
    const seconds = String(moscowTime.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} (모스크바)`;
}

// 최종 업데이트 시각 표시
function updateLastUpdateTime() {
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = getMoscowTime();
    }
}

// 제품코드 마스터 데이터 로드 (Google Sheets API)
// 참고: Product ref 스프레드시트는 선택사항입니다.
// Excel 데이터에 이미 모든 정보가 있으므로 없어도 작동합니다.
async function loadProductCodes() {
    try {
        const url = `${API_URL}?action=getProductCodes&token=${API_TOKEN}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.length > 0) {
            const products = result.data;

            // Product ref 스프레드시트의 실제 컬럼 이름에 맞춤
            products.forEach(product => {
                const code = product['제품코드'];
                const region = product['지역'] || '';
                const taste = product['맛'] || '';
                const packageType = product['패키지'] || '';

                if (code) {
                    productCodeMap[code] = {
                        region: region,
                        taste: taste,
                        packageType: packageType
                    };
                }
            });

            console.log('제품코드 매핑 완료:', Object.keys(productCodeMap).length, '개');
        } else {
            console.log('Product ref 데이터 없음 - Excel 데이터만 사용');
        }
    } catch (error) {
        console.warn('제품코드 로드 실패 (선택사항):', error);
        // Product ref가 없어도 계속 진행 (Excel 데이터만 사용)
    }
}

// 날짜 파싱 함수 (DDMMYYYY 또는 DMMYYYY 형식)
function parseProductionDate(dateStr) {
    if (!dateStr || dateStr === '-') return null;

    const str = dateStr.toString().trim();

    // 마지막 4자리 = 년도
    const year = str.slice(-4);
    // 그 앞 2자리 = 월
    const month = str.slice(-6, -4);
    // 나머지 = 일
    const day = str.slice(0, -6);

    if (!year || !month || !day) return null;

    // 날짜 형식으로 변환
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');

    return {
        formatted: `${year}-${paddedMonth}-${paddedDay}`,
        year: parseInt(year),
        isExpiry: parseInt(year) >= 2025 // 2025년 이상은 유통기한으로 추정
    };
}

// 날짜 표시 형식 생성
function formatProductionDate(dateStr) {
    const parsed = parseProductionDate(dateStr);
    if (!parsed) return '-';

    if (parsed.isExpiry) {
        return `유통기한: ${parsed.formatted}`;
    } else {
        return `생산: ${parsed.formatted}`;
    }
}

// 유통기한 구간 결정
function getShelfLifeRange(percentage) {
    if (percentage >= 90) return '90% 이상';
    if (percentage >= 80) return '80% 이상';
    if (percentage >= 70) return '70% 이상';
    return '70% 미만';
}

// 제품코드별로 그룹화하고 유통기한 구간별로 합산
function groupAndSumData(data) {
    const grouped = {};

    data.forEach(item => {
        const productCode = item['제품코드'];
        const shelfLifeRange = getShelfLifeRange(item.shelfLifeNum);
        const key = `${productCode}_${shelfLifeRange}`;

        if (!grouped[key]) {
            grouped[key] = {
                '제품코드': productCode,
                '제품명(한국어)': item['제품명(한국어)'],
                '지역분류': item['지역분류'],
                '대분류': item['대분류'],
                '중분류': item['중분류'],
                '보관창고': item['보관창고'],
                '유통기한구간': shelfLifeRange,
                '보관상태': item['보관상태'],
                stockNum: 0,
                shelfLifeSum: 0,
                shelfLifeCount: 0,
                생산일자목록: []
            };
        }

        // 재고 합산
        grouped[key].stockNum += item.stockNum;
        // 유통기한 합산 (평균 계산용)
        grouped[key].shelfLifeSum += item.shelfLifeNum;
        grouped[key].shelfLifeCount += 1;
        // 생산일자 수집
        if (item['생산일자']) {
            grouped[key].생산일자목록.push(item['생산일자']);
        }
    });

    // 생산일자를 정리 (가장 최근 것 표시)
    return Object.values(grouped).map(item => {
        // 날짜를 파싱하고 정렬
        const parsedDates = item.생산일자목록
            .map(d => parseProductionDate(d))
            .filter(d => d !== null)
            .sort((a, b) => {
                // 년도-월-일 순으로 정렬
                if (a.year !== b.year) return b.year - a.year;
                return b.formatted.localeCompare(a.formatted);
            });

        let displayDate = '-';
        if (parsedDates.length > 0) {
            const latest = parsedDates[0];
            displayDate = parsedDates.length > 1
                ? `${latest.formatted} 외 ${parsedDates.length - 1}건`
                : `${latest.formatted}`;
        }

        return {
            ...item,
            '생산일자': displayDate,
            shelfLifeNum: item.shelfLifeCount > 0 ? item.shelfLifeSum / item.shelfLifeCount : 0
        };
    });
}

// 제품 라인으로 대분류 결정
function getCategoryFromProductLine(productLine) {
    if (!productLine) return '기타';

    const line = productLine.toString().trim();
    if (line === 'Amante') return '아망테';
    if (line === 'Chocopie') return '초코파이';
    return '기타';
}

// 필터 동적 로드 범용 함수
async function loadFilterOptions(action, selectId, filterName) {
    try {
        const url = `${API_URL}?action=${action}&token=${API_TOKEN}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            const options = result.data;
            const select = document.getElementById(selectId);

            // 기존 옵션 제거 (전체 제외)
            while (select.options.length > 1) {
                select.remove(1);
            }

            // Product ref에서 가져온 옵션 추가
            options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                select.appendChild(optionElement);
            });

            console.log(`${filterName} 필터 로드 완료:`, options);
        }
    } catch (error) {
        console.error(`${filterName} 필터 로드 실패:`, error);
    }
}

// 개별 필터 로드 함수들
async function loadCategoryMainFilter() {
    await loadFilterOptions('getCategoryMain', 'categoryMainFilter', '대분류');
}

async function loadCategoryRegionFilter() {
    await loadFilterOptions('getCategoryRegion', 'regionFilter', '판매지');
}

async function loadCategoryTasteFilter() {
    await loadFilterOptions('getCategoryTaste', 'categoryFilter', '맛');
}

async function loadCategoryPackageFilter() {
    await loadFilterOptions('getCategoryPackage', 'productFilter', '봉');
}

async function loadCPNCPFilter() {
    await loadFilterOptions('getCPNCP', 'cpncpFilter', 'CP/NCP');
}

async function loadSalesRegionFilter() {
    await loadFilterOptions('getSalesRegion', 'salesRegionFilter', '판매지');
}

async function loadNoteFilter() {
    await loadFilterOptions('getNotes', 'noteFilter', '비고');
}

// 모든 필터 동시 로드
async function loadAllFilters() {
    // 초기에는 Product ref에서 모든 옵션 로드하지 않고
    // stockData 로드 후 updateDependentFilters()로 업데이트됨

    // 필터 로드 후 이벤트 리스너 재등록
    setupFilterListeners();
}

// 종속 필터 업데이트 (캐스케이딩 필터)
function updateDependentFilters() {
    // 현재 선택된 필터 값 가져오기
    const warehouseFilter = document.getElementById('warehouseFilter').value;
    const cpncpFilter = document.getElementById('cpncpFilter').value;
    const salesRegionFilter = document.getElementById('salesRegionFilter').value;
    const categoryMainFilter = document.getElementById('categoryMainFilter').value;
    const regionFilter = document.getElementById('regionFilter').value;
    const tasteFilter = document.getElementById('categoryFilter').value;
    const packageFilter = document.getElementById('productFilter').value;

    // 각 필터별로 사용 가능한 옵션 추출 및 업데이트

    // CP/NCP 필터 (보관창고에 종속)
    let cpncpData = stockData.filter(item => {
        if (item.stockNum <= 1) return false;
        return warehouseFilter === 'all' || item['보관창고'] === warehouseFilter;
    });
    updateFilterOptions('cpncpFilter', cpncpData, 'CP/NCP');

    // 판매지 필터 (보관창고, CP/NCP에 종속)
    let salesRegionData = stockData.filter(item => {
        if (item.stockNum <= 1) return false;
        const matchWarehouse = warehouseFilter === 'all' || item['보관창고'] === warehouseFilter;
        const matchCPNCP = cpncpFilter === 'all' || item['CP/NCP'] === cpncpFilter;
        return matchWarehouse && matchCPNCP;
    });
    updateFilterOptions('salesRegionFilter', salesRegionData, '판매지');

    // 카테고리 필터 (보관창고, CP/NCP, 판매지에 종속)
    let categoryData = stockData.filter(item => {
        if (item.stockNum <= 1) return false;
        const matchWarehouse = warehouseFilter === 'all' || item['보관창고'] === warehouseFilter;
        const matchCPNCP = cpncpFilter === 'all' || item['CP/NCP'] === cpncpFilter;
        const matchSalesRegion = salesRegionFilter === 'all' || item['판매지'] === salesRegionFilter;
        return matchWarehouse && matchCPNCP && matchSalesRegion;
    });
    updateFilterOptions('categoryMainFilter', categoryData, '대분류');

    // 브랜드 필터 (보관창고, CP/NCP, 판매지, 카테고리에 종속)
    let regionData = stockData.filter(item => {
        if (item.stockNum <= 1) return false;
        const matchWarehouse = warehouseFilter === 'all' || item['보관창고'] === warehouseFilter;
        const matchCPNCP = cpncpFilter === 'all' || item['CP/NCP'] === cpncpFilter;
        const matchSalesRegion = salesRegionFilter === 'all' || item['판매지'] === salesRegionFilter;
        const matchCategoryMain = categoryMainFilter === 'all' || item['대분류'] === categoryMainFilter;
        return matchWarehouse && matchCPNCP && matchSalesRegion && matchCategoryMain;
    });
    updateFilterOptions('regionFilter', regionData, '지역');

    // 맛 필터 (보관창고, CP/NCP, 판매지, 카테고리, 브랜드에 종속)
    let tasteData = stockData.filter(item => {
        if (item.stockNum <= 1) return false;
        const matchWarehouse = warehouseFilter === 'all' || item['보관창고'] === warehouseFilter;
        const matchCPNCP = cpncpFilter === 'all' || item['CP/NCP'] === cpncpFilter;
        const matchSalesRegion = salesRegionFilter === 'all' || item['판매지'] === salesRegionFilter;
        const matchCategoryMain = categoryMainFilter === 'all' || item['대분류'] === categoryMainFilter;
        const matchRegion = regionFilter === 'all' || item['지역'] === regionFilter;
        return matchWarehouse && matchCPNCP && matchSalesRegion && matchCategoryMain && matchRegion;
    });
    updateFilterOptions('categoryFilter', tasteData, '맛');

    // 패키지 필터 (보관창고, CP/NCP, 판매지, 카테고리, 브랜드, 맛에 종속)
    let packageData = stockData.filter(item => {
        if (item.stockNum <= 1) return false;
        const matchWarehouse = warehouseFilter === 'all' || item['보관창고'] === warehouseFilter;
        const matchCPNCP = cpncpFilter === 'all' || item['CP/NCP'] === cpncpFilter;
        const matchSalesRegion = salesRegionFilter === 'all' || item['판매지'] === salesRegionFilter;
        const matchCategoryMain = categoryMainFilter === 'all' || item['대분류'] === categoryMainFilter;
        const matchRegion = regionFilter === 'all' || item['지역'] === regionFilter;
        const matchTaste = tasteFilter === 'all' || item['맛'] === tasteFilter;
        return matchWarehouse && matchCPNCP && matchSalesRegion && matchCategoryMain && matchRegion && matchTaste;
    });
    updateFilterOptions('productFilter', packageData, '패키지');

    // 비고 필터 (보관창고, CP/NCP, 판매지, 카테고리, 브랜드, 맛, 패키지에 종속)
    let noteData = stockData.filter(item => {
        if (item.stockNum <= 1) return false;
        const matchWarehouse = warehouseFilter === 'all' || item['보관창고'] === warehouseFilter;
        const matchCPNCP = cpncpFilter === 'all' || item['CP/NCP'] === cpncpFilter;
        const matchSalesRegion = salesRegionFilter === 'all' || item['판매지'] === salesRegionFilter;
        const matchCategoryMain = categoryMainFilter === 'all' || item['대분류'] === categoryMainFilter;
        const matchRegion = regionFilter === 'all' || item['지역'] === regionFilter;
        const matchTaste = tasteFilter === 'all' || item['맛'] === tasteFilter;
        const matchPackage = packageFilter === 'all' || item['패키지'] === packageFilter;
        return matchWarehouse && matchCPNCP && matchSalesRegion && matchCategoryMain && matchRegion && matchTaste && matchPackage;
    });
    updateFilterOptions('noteFilter', noteData, '비고');
}

// 필터 옵션 업데이트 헬퍼 함수
function updateFilterOptions(selectId, data, fieldName) {
    const select = document.getElementById(selectId);
    const currentValue = select.value;

    // 고유한 값 추출 (중복 제거 및 정렬)
    const uniqueValues = [...new Set(data.map(item => item[fieldName]))].filter(v => v && v !== '-').sort();

    // 기존 옵션 제거 (전체 제외)
    while (select.options.length > 1) {
        select.remove(1);
    }

    // 새 옵션 추가
    uniqueValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });

    // 이전 선택값이 새 옵션에 있으면 유지, 없으면 'all'로 리셋
    if (uniqueValues.includes(currentValue)) {
        select.value = currentValue;
    } else {
        select.value = 'all';
    }
}

// 필터 변경 핸들러 (종속 필터 업데이트 + 데이터 필터링)
function handleFilterChange() {
    updateDependentFilters();
    applyFilters();
}

// 필터 이벤트 리스너 설정
function setupFilterListeners() {
    // 기존 리스너 제거
    document.getElementById('warehouseFilter').removeEventListener('change', handleFilterChange);
    document.getElementById('cpncpFilter').removeEventListener('change', handleFilterChange);
    document.getElementById('salesRegionFilter').removeEventListener('change', handleFilterChange);
    document.getElementById('regionFilter').removeEventListener('change', handleFilterChange);
    document.getElementById('categoryMainFilter').removeEventListener('change', handleFilterChange);
    document.getElementById('categoryFilter').removeEventListener('change', handleFilterChange);
    document.getElementById('productFilter').removeEventListener('change', handleFilterChange);
    document.getElementById('noteFilter').removeEventListener('change', handleFilterChange);
    document.getElementById('searchInput').removeEventListener('input', applyFilters);
    document.getElementById('resetFiltersBtn').removeEventListener('click', resetFilters);

    // 새 리스너 등록
    document.getElementById('warehouseFilter').addEventListener('change', handleFilterChange);
    document.getElementById('cpncpFilter').addEventListener('change', handleFilterChange);
    document.getElementById('salesRegionFilter').addEventListener('change', handleFilterChange);
    document.getElementById('regionFilter').addEventListener('change', handleFilterChange);
    document.getElementById('categoryMainFilter').addEventListener('change', handleFilterChange);
    document.getElementById('categoryFilter').addEventListener('change', handleFilterChange);
    document.getElementById('productFilter').addEventListener('change', handleFilterChange);
    document.getElementById('noteFilter').addEventListener('change', handleFilterChange);
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);

    console.log('필터 이벤트 리스너 등록 완료');
}

// 재고 데이터 로드 (Google Sheets API)
async function loadStockData() {
    try {
        // Google Drive에서 재고 데이터 가져오기
        // 참고: Product ref 병합은 백엔드(Google Apps Script)에서 이미 처리됨
        const url = `${API_URL}?action=getStock&token=${API_TOKEN}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            // 백엔드에서 파일 정보와 데이터를 함께 받음
            const responseData = result.data;

            // 데이터가 객체 형태인 경우 (fileName, fileDate, data 포함)
            let stockArray = [];
            let fileInfo = null;

            if (responseData.data && Array.isArray(responseData.data)) {
                stockArray = responseData.data;
                fileInfo = {
                    fileName: responseData.fileName || '',
                    fileDate: responseData.fileDate || '',
                    sheetName: responseData.sheetName || 'DB'
                };
            } else if (Array.isArray(responseData)) {
                // 이전 버전 호환성 (배열만 반환하는 경우)
                stockArray = responseData;
            }

            // 파일 이름 표시
            if (fileInfo && fileInfo.fileName) {
                document.getElementById('dataFileName').textContent = fileInfo.fileName;
            }

            // 백엔드에서 이미 그룹화되고 Product ref가 병합된 데이터를 받음
            // 필요한 숫자 필드만 추가 파싱
            stockData = stockArray.map(item => {
                // 백엔드에서 보낸 실제 유통기한(%) 값을 사용
                const shelfLifeNum = parseFloat(item['유통기한(%)']) || 0;

                return {
                    ...item,
                    stockNum: parseFloat(item['재고']) || 0,
                    shelfLifeNum: shelfLifeNum
                };
            });

            // 재고량이 1 이하인 항목 제외 (소수점 재고 포함)
            stockData = stockData.filter(item => item.stockNum > 1);

            // 초기 종속 필터 업데이트
            updateDependentFilters();

            // 초기 로드 시 필터 적용 (기본값: LProduct)
            applyFilters();
        } else {
            throw new Error(result.message || '재고 데이터 로드 실패');
        }
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        alert('데이터를 불러오는데 실패했습니다: ' + error.message);
    }
}

// 요약 정보 업데이트
function updateSummary() {
    console.log('updateSummary 호출됨, filteredData 개수:', filteredData.length);

    const totalStock = filteredData.reduce((sum, item) => sum + item.stockNum, 0);

    // 제품코드 기준으로 고유한 SKU 개수 계산
    const uniqueProductCodes = new Set(filteredData.map(item => item['제품코드']));
    const productCount = uniqueProductCodes.size;

    // 평균 유통기한 계산 (가중 평균: 재고량 고려)
    const totalWeightedShelfLife = filteredData.reduce((sum, item) => sum + (item.shelfLifeNum * item.stockNum), 0);
    const avgShelfLife = filteredData.length > 0 ? totalWeightedShelfLife / totalStock : 0;

    // 경고 제품: 80% 미만 유통기한의 재고량 합산
    const warningStock = filteredData
        .filter(item => item.shelfLifeNum < 80)
        .reduce((sum, item) => sum + item.stockNum, 0);

    console.log('계산된 값:', {
        totalStock: Math.round(totalStock),
        productCount,
        avgShelfLife: avgShelfLife.toFixed(1),
        warningStock: Math.round(warningStock)
    });

    // DOM 요소 확인 및 업데이트
    const totalStockEl = document.getElementById('totalStock');
    const productCountEl = document.getElementById('productCount');
    const avgShelfLifeEl = document.getElementById('avgShelfLife');
    const warningCountEl = document.getElementById('warningCount');

    console.log('DOM 요소 확인:', {
        totalStockEl: totalStockEl !== null,
        productCountEl: productCountEl !== null,
        avgShelfLifeEl: avgShelfLifeEl !== null,
        warningCountEl: warningCountEl !== null
    });

    if (totalStockEl) totalStockEl.textContent = formatNumber(Math.round(totalStock));
    if (productCountEl) productCountEl.textContent = productCount;
    if (avgShelfLifeEl) {
        const newValue = filteredData.length > 0 ? avgShelfLife.toFixed(1) : '-';
        console.log('avgShelfLife 업데이트:', avgShelfLifeEl.textContent, '->', newValue);
        avgShelfLifeEl.textContent = newValue;
    }
    if (warningCountEl) {
        const newValue = formatNumber(Math.round(warningStock));
        console.log('warningCount 업데이트:', warningCountEl.textContent, '->', newValue);
        warningCountEl.textContent = newValue;
    }
}

// 재고 상태 배지 생성
function getStatusBadge(status) {
    const statusClass = status === 'Good' ? 'good' : 'warning';
    return `<span class="status-badge ${statusClass}">${status}</span>`;
}

// 유통기한 배지 생성
function getShelfLifeBadge(shelfLifeRange, shelfLifeNum) {
    let className = '';
    let emoji = '';

    if (shelfLifeNum < 60) {
        className = 'shelf-life-danger';
        emoji = ' ⚠️';
    } else if (shelfLifeNum < 80) {
        className = 'shelf-life-warning';
        emoji = '';
    } else {
        className = 'shelf-life-good';
        emoji = '';
    }

    return `<span class="shelf-life-badge ${className}">${shelfLifeRange}${emoji}</span>`;
}

// 재고 바 차트 생성
function createStockBar(stock, maxStock) {
    const percentage = (stock / maxStock) * 100;
    let barClass = 'high';

    if (percentage < 30) barClass = 'low';
    else if (percentage < 60) barClass = 'medium';

    return `
        <div class="stock-bar">
            <div class="stock-bar-fill ${barClass}" style="width: ${percentage}%"></div>
        </div>
    `;
}

// 유통기한 바 생성
function createShelfLifeBar(percentage) {
    let barClass = 'high';
    if (percentage < 40) barClass = 'low';
    else if (percentage < 70) barClass = 'medium';

    return `
        <div class="shelf-life">
            <div class="shelf-life-bar">
                <div class="shelf-life-fill ${barClass}" style="width: ${percentage}%"></div>
            </div>
            <span class="shelf-life-text">${percentage.toFixed(1)}%</span>
        </div>
    `;
}

// ============================================
// 트리맵 시각화
// ============================================

// 유통기한에 따른 색상 반환
function getColorByShelfLife(shelfLifePercent) {
    if (shelfLifePercent >= 90) return '#52c41a'; // 녹색 (90%+)
    if (shelfLifePercent >= 80) return '#faad14'; // 노란색 (80-90%)
    if (shelfLifePercent >= 60) return '#ff7a45'; // 주황색 (60-80%)
    return '#f5222d'; // 빨간색 (0-60%)
}

// 트리맵 데이터 준비
function prepareTreemapData() {
    // 대분류별로 그룹화
    const categoryGroups = {};

    filteredData.forEach(item => {
        const category = item['대분류'] || '기타';

        if (!categoryGroups[category]) {
            categoryGroups[category] = [];
        }

        categoryGroups[category].push({
            name: `${item['제품코드']}\n${item['지역']} ${item['맛']} ${item['패키지']}`,
            value: item.stockNum,
            shelfLife: item.shelfLifeNum,
            itemStyle: {
                color: getColorByShelfLife(item.shelfLifeNum)
            },
            label: {
                formatter: function(params) {
                    const lines = params.name.split('\n');
                    const stock = Math.round(params.value);
                    const shelfLife = params.data.shelfLife.toFixed(0);
                    return `${lines[0]}\n${lines[1]}\n${formatNumber(stock)}박스\n${shelfLife}%`;
                }
            },
            productCode: item['제품코드'],
            region: item['지역'],
            taste: item['맛'],
            package: item['패키지']
        });
    });

    // ECharts treemap 형식으로 변환
    const treemapData = Object.keys(categoryGroups).map(category => {
        const items = categoryGroups[category];
        const totalStock = items.reduce((sum, item) => sum + item.value, 0);

        return {
            name: category,
            value: totalStock,
            children: items
        };
    });

    return treemapData;
}

// 트리맵 렌더링
function renderTreemap() {
    const chartDom = document.getElementById('treemapChart');

    if (!chartDom) {
        console.error('treemapChart 요소를 찾을 수 없습니다');
        return;
    }

    // 기존 차트가 있으면 제거
    if (treemapChart) {
        treemapChart.dispose();
    }

    // 새 차트 인스턴스 생성
    treemapChart = echarts.init(chartDom);

    // 데이터 준비
    const data = prepareTreemapData();

    // 다크모드 확인
    const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDarkMode ? '#ecf0f1' : '#2c3e50';
    const borderColor = isDarkMode ? '#34495e' : '#555';

    // 차트 옵션 설정
    const option = {
        tooltip: {
            formatter: function(params) {
                if (params.treePathInfo && params.treePathInfo.length > 1) {
                    const item = params.data;
                    return `
                        <strong>${params.name}</strong><br/>
                        재고량: ${formatNumber(Math.round(params.value))} 박스<br/>
                        유통기한: ${item.shelfLife ? item.shelfLife.toFixed(1) : 0}%<br/>
                        카테고리: ${params.treePathInfo[1].name}
                    `;
                } else {
                    return `
                        <strong>${params.name}</strong><br/>
                        총 재고량: ${formatNumber(Math.round(params.value))} 박스
                    `;
                }
            }
        },
        series: [
            {
                type: 'treemap',
                data: data,
                roam: false,
                breadcrumb: {
                    show: false
                },
                label: {
                    show: true,
                    fontSize: 11,
                    lineHeight: 14,
                    overflow: 'truncate',
                    ellipsis: '...',
                    color: textColor
                },
                upperLabel: {
                    show: true,
                    height: 30,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#fff',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)'
                },
                itemStyle: {
                    borderColor: isDarkMode ? '#34495e' : '#fff',
                    borderWidth: 2,
                    gapWidth: 2
                },
                levels: [
                    {
                        itemStyle: {
                            borderColor: borderColor,
                            borderWidth: 4,
                            gapWidth: 4
                        },
                        upperLabel: {
                            show: true
                        }
                    },
                    {
                        colorSaturation: [0.35, 0.5],
                        itemStyle: {
                            gapWidth: 2,
                            borderColorSaturation: 0.6
                        }
                    }
                ]
            }
        ]
    };

    // 차트 렌더링
    treemapChart.setOption(option);

    // 클릭 이벤트: 클릭한 제품으로 테이블 필터링
    treemapChart.on('click', function(params) {
        if (params.data && params.data.productCode) {
            // 제품코드로 검색
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = params.data.productCode;
                applyFilters();
            }
        }
    });

    // 윈도우 리사이즈 대응
    window.addEventListener('resize', function() {
        if (treemapChart) {
            treemapChart.resize();
        }
    });
}

// 테이블 렌더링
function renderTable() {
    const tableBody = document.getElementById('stockTableBody');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 40px;">데이터가 없습니다.</td></tr>';
        return;
    }

    tableBody.innerHTML = pageData.map(item => `
        <tr>
            <td>${item['제품코드']}</td>
            <td>${item['CP/NCP'] || '-'}</td>
            <td>${item['판매지'] || '-'}</td>
            <td>${item['대분류'] || '-'}</td>
            <td>${item['지역'] || '-'}</td>
            <td>${item['맛'] || '-'}</td>
            <td>${item['패키지'] || '-'}</td>
            <td>${item['비고'] || '-'}</td>
            <td>${getStatusBadge(item['보관상태'])}</td>
            <td><span class="stock-number">${formatNumber(Math.round(item.stockNum))}</span></td>
            <td>${getShelfLifeBadge(item['유통기한구간'], item.shelfLifeNum)}</td>
        </tr>
    `).join('');

    updatePagination();
}

// 페이지네이션 업데이트
function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;

    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

// 커스텀 정렬 함수 (지역 → 맛 → 패키지)
function customSort(a, b) {
    // 정렬 순서 정의
    const regionOrder = ['내수용', '벨라루스용', '카작용', '소머리'];
    const tasteOrder = ['오리지날', '카카오', '바나나', '치즈', '딸기', '아망테'];
    const packageOrder = ['48봉', '16봉', '12봉', '6봉', '4봉'];

    // 1차: 지역
    const regionA = regionOrder.indexOf(a['지역']);
    const regionB = regionOrder.indexOf(b['지역']);
    if (regionA !== regionB) {
        return (regionA === -1 ? 999 : regionA) - (regionB === -1 ? 999 : regionB);
    }

    // 2차: 맛
    const tasteA = tasteOrder.indexOf(a['맛']);
    const tasteB = tasteOrder.indexOf(b['맛']);
    if (tasteA !== tasteB) {
        return (tasteA === -1 ? 999 : tasteA) - (tasteB === -1 ? 999 : tasteB);
    }

    // 3차: 패키지
    const packageA = packageOrder.indexOf(a['패키지']);
    const packageB = packageOrder.indexOf(b['패키지']);
    return (packageA === -1 ? 999 : packageA) - (packageB === -1 ? 999 : packageB);
}

// 필터링
function applyFilters() {
    console.log('applyFilters 호출됨');

    const warehouseFilter = document.getElementById('warehouseFilter').value;
    const cpncpFilter = document.getElementById('cpncpFilter').value;
    const salesRegionFilter = document.getElementById('salesRegionFilter').value;
    const regionFilter = document.getElementById('regionFilter').value;
    const categoryMainFilter = document.getElementById('categoryMainFilter').value; // 대분류 필터
    const tasteFilter = document.getElementById('categoryFilter').value; // 맛 필터
    const packageFilter = document.getElementById('productFilter').value; // 패키지(봉) 필터
    const noteFilter = document.getElementById('noteFilter').value; // 비고 필터
    const searchText = document.getElementById('searchInput').value.toLowerCase();

    console.log('필터 값:', { warehouseFilter, cpncpFilter, salesRegionFilter, regionFilter, categoryMainFilter, tasteFilter, packageFilter, noteFilter, searchText });

    filteredData = stockData.filter(item => {
        // 재고량이 1 이하인 항목 제외 (소수점 재고 포함)
        if (item.stockNum <= 1) return false;

        const matchWarehouse = warehouseFilter === 'all' || item['보관창고'] === warehouseFilter;
        const matchCPNCP = cpncpFilter === 'all' || item['CP/NCP'] === cpncpFilter;
        const matchSalesRegion = salesRegionFilter === 'all' || item['판매지'] === salesRegionFilter;
        const matchRegion = regionFilter === 'all' || item['지역'] === regionFilter;
        const matchCategoryMain = categoryMainFilter === 'all' || item['대분류'] === categoryMainFilter;
        const matchTaste = tasteFilter === 'all' || item['맛'] === tasteFilter;
        const matchPackage = packageFilter === 'all' || item['패키지'] === packageFilter;
        const matchNote = noteFilter === 'all' || item['비고'] === noteFilter;
        const matchSearch = searchText === '' ||
            item['제품명'].toLowerCase().includes(searchText) ||
            item['제품코드'].toLowerCase().includes(searchText);

        return matchWarehouse && matchCPNCP && matchSalesRegion && matchRegion && matchCategoryMain && matchTaste && matchPackage && matchNote && matchSearch;
    });

    // 커스텀 정렬 적용
    filteredData.sort(customSort);

    currentPage = 1;
    updateSummary();
    renderTable();
    renderTreemap();
}

// 필터 초기화
function resetFilters() {
    console.log('필터 초기화 버튼 클릭됨');

    // 모든 select 필터를 "전체"로 초기화
    document.getElementById('warehouseFilter').value = 'LProduct';
    document.getElementById('cpncpFilter').value = 'all';
    document.getElementById('salesRegionFilter').value = 'all';
    document.getElementById('regionFilter').value = 'all';
    document.getElementById('categoryMainFilter').value = 'all';
    document.getElementById('categoryFilter').value = 'all';
    document.getElementById('productFilter').value = 'all';
    document.getElementById('noteFilter').value = 'all';

    // 검색 입력 초기화
    document.getElementById('searchInput').value = '';

    // 종속 필터 업데이트
    updateDependentFilters();

    // 필터 적용
    applyFilters();
}

// 정렬
function sortTable(column) {
    console.log('정렬 클릭:', column);

    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }

    const columnMap = {
        'code': '제품코드',
        'cpncp': 'CP/NCP',
        'salesRegion': '판매지',
        'categoryMain': '대분류',
        'region': '지역',
        'taste': '맛',
        'package': '패키지',
        'note': '비고',
        'status': '보관상태',
        'stock': 'stockNum',
        'shelfLife': '유통기한구간'
    };

    const sortKey = columnMap[column];

    filteredData.sort((a, b) => {
        let aVal = a[sortKey];
        let bVal = b[sortKey];

        // null/undefined 처리
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';

        // 숫자 정렬
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // 문자열 정렬
        const aStr = aVal.toString();
        const bStr = bVal.toString();

        if (sortDirection === 'asc') {
            return aStr.localeCompare(bStr);
        } else {
            return bStr.localeCompare(aStr);
        }
    });

    // 정렬 아이콘 업데이트
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
    });

    const activeHeader = document.querySelector(`th[data-column="${column}"]`);
    if (activeHeader) {
        activeHeader.classList.add(sortDirection);
    }

    renderTable();
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', () => {
    // 다크모드 초기화 (로그인 전에도 적용)
    initDarkMode();

    // 로그인 상태 체크
    const isLoggedIn = checkAuth();

    // 로그인 폼 이벤트
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // 로그아웃 버튼 이벤트
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // 다크모드 토글 버튼 이벤트 (메인 대시보드)
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }

    // 다크모드 토글 버튼 이벤트 (로그인 페이지)
    const darkModeToggleLogin = document.getElementById('darkModeToggleLogin');
    if (darkModeToggleLogin) {
        darkModeToggleLogin.addEventListener('click', toggleDarkMode);
    }

    // 로그인되지 않은 경우 여기서 종료
    if (!isLoggedIn) {
        return;
    }

    // 최종 업데이트 시각 표시
    updateLastUpdateTime();

    // 필터 이벤트
    document.getElementById('warehouseFilter').addEventListener('change', applyFilters);
    document.getElementById('regionFilter').addEventListener('change', applyFilters);
    document.getElementById('categoryMainFilter').addEventListener('change', applyFilters);
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
    document.getElementById('productFilter').addEventListener('change', applyFilters);
    document.getElementById('searchInput').addEventListener('input', applyFilters);

    // 필터 초기화 버튼
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);

    // 페이지네이션 이벤트
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    document.getElementById('itemsPerPage').addEventListener('change', (e) => {
        itemsPerPage = parseInt(e.target.value);
        currentPage = 1;
        renderTable();
    });

    // 정렬 이벤트
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-column');
            sortTable(column);
        });
    });
});
