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

    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        if (darkModeToggle) {
            darkModeToggle.textContent = '☀️';
        }
    }
}

// 다크모드 토글
function toggleDarkMode() {
    const currentTheme = document.body.getAttribute('data-theme');
    const darkModeToggle = document.getElementById('darkModeToggle');

    if (currentTheme === 'dark') {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if (darkModeToggle) {
            darkModeToggle.textContent = '🌙';
        }
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (darkModeToggle) {
            darkModeToggle.textContent = '☀️';
        }
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

// 재고 데이터 로드 (Google Sheets API)
async function loadStockData() {
    try {
        // Google Drive에서 재고 데이터 가져오기
        // 참고: Product ref 병합은 백엔드(Google Apps Script)에서 이미 처리됨
        const url = `${API_URL}?action=getStock&token=${API_TOKEN}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            // 백엔드에서 이미 그룹화되고 Product ref가 병합된 데이터를 받음
            // 필요한 숫자 필드만 추가 파싱
            stockData = result.data.map(item => {
                // 유통기한 구간을 숫자로 변환 (필터링 및 정렬용)
                const shelfLifeRange = item['유통기한구간'] || '';
                let shelfLifeNum = 85; // 기본값

                if (shelfLifeRange.includes('90% 이상')) shelfLifeNum = 95;
                else if (shelfLifeRange.includes('80~90%')) shelfLifeNum = 85;
                else if (shelfLifeRange.includes('70~80%')) shelfLifeNum = 75;
                else if (shelfLifeRange.includes('70% 미만')) shelfLifeNum = 65;

                return {
                    ...item,
                    stockNum: parseFloat(item['재고']) || 0,
                    shelfLifeNum: shelfLifeNum
                };
            });

            // 재고량이 0인 항목 제외
            stockData = stockData.filter(item => item.stockNum > 0);

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
    const totalStock = filteredData.reduce((sum, item) => sum + item.stockNum, 0);

    // 제품코드 기준으로 고유한 SKU 개수 계산
    const uniqueProductCodes = new Set(filteredData.map(item => item['제품코드']));
    const productCount = uniqueProductCodes.size;

    const avgShelfLife = filteredData.reduce((sum, item) => sum + item.shelfLifeNum, 0) / filteredData.length;
    // 70% 미만 유통기한의 재고량 합산
    const warningStock = filteredData
        .filter(item => item.shelfLifeNum < 70)
        .reduce((sum, item) => sum + item.stockNum, 0);

    document.getElementById('totalStock').textContent = formatNumber(Math.round(totalStock));
    document.getElementById('productCount').textContent = productCount;
    document.getElementById('avgShelfLife').textContent = avgShelfLife.toFixed(1);
    document.getElementById('warningCount').textContent = formatNumber(Math.round(warningStock));
}

// 재고 상태 배지 생성
function getStatusBadge(status) {
    const statusClass = status === 'Good' ? 'good' : 'warning';
    return `<span class="status-badge ${statusClass}">${status}</span>`;
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

// 테이블 렌더링
function renderTable() {
    const tableBody = document.getElementById('stockTableBody');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;">데이터가 없습니다.</td></tr>';
        return;
    }

    const maxStock = Math.max(...filteredData.map(item => item.stockNum));

    tableBody.innerHTML = pageData.map(item => `
        <tr>
            <td>${item['제품코드']}</td>
            <td>${item['제품명']}</td>
            <td>${item['대분류']}</td>
            <td>${item['중분류']}</td>
            <td>${item['생산일자']}</td>
            <td>${getStatusBadge(item['보관상태'])}</td>
            <td><span class="stock-number">${formatNumber(Math.round(item.stockNum))}</span></td>
            <td>${item['유통기한구간']}</td>
            <td>${createStockBar(item.stockNum, maxStock)}</td>
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
    const warehouseFilter = document.getElementById('warehouseFilter').value;
    const regionFilter = document.getElementById('regionFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    const productFilter = document.getElementById('productFilter').value;
    const searchText = document.getElementById('searchInput').value.toLowerCase();

    filteredData = stockData.filter(item => {
        // 재고량이 0인 항목 제외
        if (item.stockNum <= 0) return false;

        const matchWarehouse = warehouseFilter === 'all' || item['보관창고'] === warehouseFilter;
        const matchRegion = regionFilter === 'all' || item['지역'] === regionFilter;
        const matchCategory = categoryFilter === 'all' || item['맛'] === categoryFilter;
        const matchProduct = productFilter === 'all' || item['패키지'] === productFilter;
        const matchSearch = searchText === '' ||
                          item['제품명'].toLowerCase().includes(searchText) ||
                          item['제품코드'].toLowerCase().includes(searchText);

        return matchWarehouse && matchRegion && matchCategory && matchProduct && matchSearch;
    });

    // 커스텀 정렬 적용
    filteredData.sort(customSort);

    currentPage = 1;
    updateSummary();
    renderTable();
}

// 정렬
function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }

    const columnMap = {
        'code': '제품코드',
        'name': '제품명',
        'category': '대분류',
        'product': '중분류',
        'warehouse': '보관창고',
        'productionDate': '생산일자',
        'status': '보관상태',
        'stock': 'stockNum',
        'shelfLife': '유통기한구간'
    };

    const sortKey = columnMap[column];

    filteredData.sort((a, b) => {
        let aVal = a[sortKey];
        let bVal = b[sortKey];

        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        aVal = aVal.toString();
        bVal = bVal.toString();

        if (sortDirection === 'asc') {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
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

    // 다크모드 토글 버튼 이벤트
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
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
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
    document.getElementById('productFilter').addEventListener('change', applyFilters);
    document.getElementById('searchInput').addEventListener('input', applyFilters);

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
