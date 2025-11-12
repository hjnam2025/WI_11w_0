// Map and marker variables
let map;
let markers = [];
let markerClusterGroup;
let territorialLayer; 
let currentLayer;
let allIslands = [];
let islandMarkers = new Map(); 
let highlightedMarkers = [];
let regionPolygon = null; 
let currentRegionIslands = []; 

// Territorial islands list
const territorialIslands = [
    "호미곶", "1.5미이터암", "생도", "홍도", "간여암", "하백도", 
    "사수도", "절명서", "소국흘도", "고서", "직도", "서격렬비도", "소령도"
];

// Region mapping
const regionMapping = {
    '경기도': ['경기도', '인천광역시'],
    '충청도': ['충청북도', '충청남도', '세종특별자치시'],
    '전라남도': ['전라남도'],
    '전라북도': ['전라북도', '전북특별자치도'],
    '경상남도': ['경상남도', '부산광역시', '울산광역시'],
    '경상북도': ['경상북도', '대구광역시'],
    '강원도': ['강원특별자치도', '강원도'],
    '제주도': ['제주특별자치도', '제주도']
};

// Map style layers
const mapStyles = {
    default: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri', maxZoom: 19 }),
    terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: '© OpenTopoMap', maxZoom: 17 }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CARTO', maxZoom: 19 })
};

// Utils
function dmsToDecimal(dmsString) {
    if (!dmsString || typeof dmsString !== 'string') return null;
    const cleaned = dmsString.trim();
    let match = cleaned.match(/(\d+)[°]\s*(\d+)[′']\s*([\d.]+)[″"]\s*([NSEW])/);
    if (!match) match = cleaned.match(/(\d+)\s*deg\s*(\d+)\s*min\s*([\d.]+)\s*sec\s*([NSEW])/i);
    if (!match) match = cleaned.match(/(-?\d+\.?\d*)\s*([NSEW])/);
    if (!match) {
        const decimalMatch = cleaned.match(/(-?\d+\.?\d*)/);
        return decimalMatch ? parseFloat(decimalMatch[1]) : null;
    }
    if (match.length === 3) {
        let decimal = parseFloat(match[1]);
        return (match[2] === 'S' || match[2] === 'W') ? -decimal : decimal;
    }
    let decimal = parseFloat(match[1]) + (parseFloat(match[2]) / 60) + (parseFloat(match[3]) / 3600);
    if (match[4] === 'S' || match[4] === 'W') decimal = -decimal;
    return decimal;
}

function formatAddress(island) {
    const sido = island.Column3 || '';
    const sigungu = island.Column4 || '';
    let addressParts = [];
    if (sido && sigungu) {
        addressParts.push((sido.includes('광역시') || sido.includes('특별시')) ? `${sido} ${sigungu}` : sido, sigungu);
    } else if (sido) {
        addressParts.push(sido);
    }
    const parts = [island.Column5, island.Column6, island.Column7].filter(p => p && p.trim() !== '');
    return addressParts.concat(parts).join(' ') || '주소 정보 없음';
}

// Tooltip & Detail
function createTooltipContent(island) {
    const name = island['무인도서 정보'] || '이름 없음';
    const address = formatAddress(island);
    const isTerritorial = territorialIslands.includes(name);
    
    let html = `<div class="tooltip-title">
                    ${name}
                    ${isTerritorial ? '<span class="territorial-badge">영해기점</span>' : ''}
                </div>`;
    html += `<div class="tooltip-info"><strong>소재지:</strong> ${address}</div>`;
    html += `<div class="tooltip-info"><strong>관리유형:</strong> ${island.Column21 || '정보 없음'}</div>`;
    return html;
}

function createDetailContent(island) {
    const address = formatAddress(island);
    const name = island['무인도서 정보'] || '이름 없음';
    let isTerritorial = territorialIslands.includes(name);
    let territorialText = isTerritorial ? "영해기점" : (island.Column20 || "해당 없음");
    if (territorialText === '영해기점 없음') territorialText = "해당 없음";
    const territorialStyle = isTerritorial ? 'color: #e74c3c; font-weight: bold;' : '';

    let html = `
        <div class="island-detail">
            <h3>${name}</h3>
            <div class="info-row"><div class="info-label">소재지</div><div class="info-value">${address}</div></div>
            <div class="info-row">
                <div class="info-label">영해기점 무인도서 유무</div>
                <div class="info-value" style="${territorialStyle}">${territorialText}</div>
            </div>
            <div class="info-row"><div class="info-label">무인도서 관리유형</div><div class="info-value">${island.Column21 || '정보 없음'}</div></div>
            <div class="info-row"><div class="info-label">토지소유구분</div><div class="info-value">${island.Column9 || '정보 없음'}</div></div>
            <div class="info-row"><div class="info-label">관리번호</div><div class="info-value">${island.Column2 || '정보 없음'}</div></div>
            <div class="info-row"><div class="info-label">토지 소유자</div><div class="info-value">${island.Column10 || '정보 없음'}</div></div>
            <div class="info-row"><div class="info-label">토지 전체 면적(㎡)</div><div class="info-value">${island.Column11 ? island.Column11.toLocaleString() : '정보 없음'}</div></div>
            <div class="info-row"><div class="info-label">육지와의 거리(㎞)</div><div class="info-value">${island.Column16 !== undefined ? island.Column16 : '정보 없음'}</div></div>
            <div class="info-row horizontal three-columns">
                <div><div class="info-label">국유지</div><div class="info-value">${island.Column12 ? island.Column12.toLocaleString() : '-'}</div></div>
                <div><div class="info-label">공유지</div><div class="info-value">${island.Column13 ? island.Column13.toLocaleString() : '-'}</div></div>
                <div><div class="info-label">사유지</div><div class="info-value">${island.Column14 ? island.Column14.toLocaleString() : '-'}</div></div>
            </div>
            <div class="info-row"><div class="info-label">용도구분</div><div class="info-value">${island.Column18 || '정보 없음'}</div></div>
            <div class="info-row"><div class="info-label">지목</div><div class="info-value">${island.Column19 || '정보 없음'}</div></div>
            <div class="info-row"><div class="info-label">주변해역 관리유형</div><div class="info-value">${island.Column22 || '정보 없음'}</div></div>
            <div class="info-row"><div class="info-label">지정고시일</div><div class="info-value">${island.Column25 || '정보 없음'}</div></div>
        </div>
    `;
    return html;
}

// Initialize
function initMap() {
    map = L.map('map', {zoomControl: false}).setView([37.5665, 126.9780], 10);
    currentLayer = mapStyles.satellite;
    currentLayer.addTo(map);

    markerClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50
    });
    
    territorialLayer = L.layerGroup().addTo(map);
}

// Load Data
async function loadIslands() {
    try {
        const response = await fetch('data00.json');
        const data = await response.json();
        const islands = Array.isArray(data) ? data.filter(i => i['무인도서 정보'] !== '무인도서명' && i.Column23 && i.Column24) : [];
        
        allIslands = islands;
        const validMarkers = [];

        islands.forEach(island => {
            const lat = dmsToDecimal(island.Column23);
            const lng = dmsToDecimal(island.Column24);
            if (lat && lng) {
                const marker = L.marker([lat, lng]);
                islandMarkers.set(marker, island);
                marker.bindTooltip(createTooltipContent(island), { permanent: false, direction: 'top', className: 'island-tooltip' });
                marker.on('click', () => showIslandDetails(island));
                validMarkers.push(marker);
            }
        });

        markers = validMarkers;
        markerClusterGroup.addLayers(validMarkers);
        map.addLayer(markerClusterGroup);
        console.log(`Loaded ${validMarkers.length} islands`);
    } catch (error) {
        console.error('Error:', error);
    }
}

function showIslandDetails(island) {
    const sidebar = document.getElementById('sidebar');
    document.getElementById('sidebarContent').innerHTML = createDetailContent(island);
    sidebar.classList.remove('hidden');
    if (window.innerWidth > 768) document.querySelector('.map-container').style.marginLeft = '400px';
    document.getElementById('sidebarContent').scrollTop = 0;
    setTimeout(() => map && map.invalidateSize(), 300);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mapContainer = document.querySelector('.map-container');
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        toggleBtn.textContent = '◀';
        sidebarToggleBtn.classList.add('hidden');
        if (window.innerWidth > 768) mapContainer.style.marginLeft = '400px';
    } else {
        sidebar.classList.add('hidden');
        toggleBtn.textContent = '▶';
        sidebarToggleBtn.classList.remove('hidden');
        if (window.innerWidth > 768) mapContainer.style.marginLeft = '0';
    }
    setTimeout(() => map && map.invalidateSize(), 300);
}

function getIslandsByRegion(regionName) {
    if (!regionName) return allIslands;
    const regions = regionMapping[regionName] || [];
    return allIslands.filter(i => regions.some(r => (i.Column3 || '').includes(r)));
}

function highlightRegion(regionIslands) {
    if (regionPolygon) { map.removeLayer(regionPolygon); regionPolygon = null; }
    if (!regionIslands.length) return;

    const coords = [];
    regionIslands.forEach(i => {
        const lat = dmsToDecimal(i.Column23);
        const lng = dmsToDecimal(i.Column24);
        if (lat && lng) coords.push([lat, lng]);
    });
    if (!coords.length) return;

    let minLat = coords[0][0], maxLat = coords[0][0], minLng = coords[0][1], maxLng = coords[0][1];
    coords.forEach(c => {
        if (c[0] < minLat) minLat = c[0]; if (c[0] > maxLat) maxLat = c[0];
        if (c[1] < minLng) minLng = c[1]; if (c[1] > maxLng) maxLng = c[1];
    });

    const latPad = (maxLat - minLat) * 0.1, lngPad = (maxLng - minLng) * 0.1;
    const pCoords = [
        [minLat - latPad, minLng - lngPad],
        [maxLat + latPad, minLng - lngPad],
        [maxLat + latPad, maxLng + lngPad],
        [minLat - latPad, maxLng + lngPad]
    ];

    try {
        regionPolygon = L.polygon(pCoords, {
            color: '#ffffff',
            weight: 2, 
            opacity: 1,
            fillColor: '#ffffff',
            fillOpacity: 0.0, 
            lineJoin: 'round',
            className: 'region-highlight-polygon'
        }).addTo(map);
    } catch (e) { console.error(e); }
}

function clearRegionHighlight() {
    if (regionPolygon) { map.removeLayer(regionPolygon); regionPolygon = null; }
}

function getSigunguList(islands) {
    const map = new Map();
    islands.forEach(i => {
        if (i.Column4) {
            let full = i.Column4;
            if ((i.Column3 || '').match(/(광역시|특별시)/)) full = `${i.Column3} ${i.Column4}`;
            if (!map.has(i.Column4)) map.set(i.Column4, { short: i.Column4, full, sido: i.Column3 });
        }
    });
    return Array.from(map.values()).sort((a, b) => {
        // 1. 시/도 이름으로 먼저 정렬
        if (a.sido !== b.sido) return a.sido.localeCompare(b.sido);
        // 2. 그 다음 시/군/구 이름으로 정렬
        return a.short.localeCompare(b.short);
    });
}

function updateSigunguSelect(islands) {
    const sel = document.getElementById('sigunguSelect');
    const list = getSigunguList(islands);
    if (!list.length) { sel.style.display = 'none'; sel.value = ''; return; }
    
    sel.style.display = 'block'; 
    
    sel.innerHTML = '<option value="">전체</option>' + list.map(s => `<option value="${s.short}">${s.full}</option>`).join('');
}

function updateIslandList(regionName, sigungu = '') {
    const list = document.getElementById('islandList');
    const header = document.querySelector('.island-list-header h4');
    let islands = getIslandsByRegion(regionName);

    // ▼▼▼ 마커 지우는 로직 삭제함! 이제 다른 지역 마커도 안 사라짐 ▼▼▼
    // markerClusterGroup.clearLayers();  <-- 삭제됨
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    if (!regionName) {
        list.innerHTML = '<p style="padding: 10px; color: #666; text-align: center;">지역을 선택하세요</p>';
        document.getElementById('sigunguSelect').style.display = 'none';
        if (header) header.textContent = '섬 리스트';
        clearRegionHighlight();
        currentRegionIslands = [];
        return;
    }

    if (sigungu) islands = islands.filter(i => i.Column4 === sigungu);
    currentRegionIslands = islands;

    if (header) {
        if (sigungu) {
            const sObj = getSigunguList(getIslandsByRegion(regionName)).find(s => s.short === sigungu);
            header.textContent = `섬 리스트 - ${sObj ? sObj.full : sigungu}`;
        } else {
            header.textContent = `섬 리스트 - 전체`;
        }
    }

    if (!islands.length) {
        list.innerHTML = '<p style="padding: 10px; color: #666; text-align: center;">해당 지역에 섬이 없습니다</p>';
        clearRegionHighlight();
        return;
    }

    list.innerHTML = islands.map(i => `
        <div class="island-list-item" data-island-id="${i.Column2}">
            <div class="island-name">${i['무인도서 정보'] || '이름 없음'}</div>
            <div class="island-address">${formatAddress(i)}</div>
        </div>
    `).join('');

    list.querySelectorAll('.island-list-item').forEach(item => {
        item.addEventListener('click', function() {
            const island = islands.find(i => i.Column2 === this.dataset.islandId);
            if (island) {
                showIslandDetails(island);
                const lat = dmsToDecimal(island.Column23);
                const lng = dmsToDecimal(island.Column24);
                if (lat && lng) map.flyTo([lat, lng], 15, { animate: true, duration: 1.0 });
            }
        });
    });

    const markersToShow = markers.filter(m => {
        const i = islandMarkers.get(m);
        return islands.some(regionIsland => regionIsland.Column2 === i.Column2);
    });
    
    // ▼▼▼ 여기서도 addLayers 지워야 함! 중복 추가 방지 ▼▼▼
    // markerClusterGroup.addLayers(markersToShow); <-- 삭제됨
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    if (markersToShow.length > 0) {
        const bounds = L.latLngBounds(markersToShow.map(m => m.getLatLng()));
        map.fitBounds(bounds.pad(0.2));
        setTimeout(() => highlightRegion(islands), 500); 
    } else {
        clearRegionHighlight();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadIslands();

    document.getElementById('custom-zoom-in').onclick = (e) => { e.preventDefault(); map.zoomIn(); };
    document.getElementById('custom-zoom-out').onclick = (e) => { e.preventDefault(); map.zoomOut(); };
    document.getElementById('custom-zoom-korea').onclick = (e) => { 
        e.preventDefault(); 
        map.setView([36.5, 127.5], 7, { animate: true, duration: 1.0 });
        clearRegionHighlight();
        document.getElementById('regionSelect').value = "";
        updateIslandList(""); 
    };

    const styleBtns = document.querySelectorAll('.style-btn');
    styleBtns.forEach(btn => {
        btn.onclick = function() {
            styleBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            if (mapStyles[this.dataset.style]) {
                map.removeLayer(currentLayer);
                currentLayer = mapStyles[this.dataset.style];
                currentLayer.addTo(map);
            }
        };
    });

    document.getElementById('toggleSidebar').onclick = toggleSidebar;
    document.getElementById('sidebarToggleBtn').onclick = toggleSidebar;
    document.getElementById('toggleIslandList').onclick = function() {
        const list = document.getElementById('islandList');
        if (list.style.display === 'none') {
            list.style.display = 'block';
            this.textContent = '접기 ▲';
        } else {
            list.style.display = 'none';
            this.textContent = '펼치기 ▼';
        }
    };

    const rSel = document.getElementById('regionSelect');
    const sSel = document.getElementById('sigunguSelect');
    
    rSel.onchange = function() {
        const regionIslands = getIslandsByRegion(this.value);
        updateSigunguSelect(regionIslands);
        updateIslandList(this.value, '');
    };
    sSel.onchange = function() {
        updateIslandList(rSel.value, this.value);
    };

    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('sidebarToggleBtn').classList.add('hidden');

    const territorialBtn = document.getElementById('territorialToggleBtn');
    let isTerritorialActive = false;

    territorialBtn.addEventListener('click', function() {
        isTerritorialActive = !isTerritorialActive;
        if (isTerritorialActive) {
            this.classList.add('active');
            this.textContent = "⚓ 영해기점 ON";
            
            territorialLayer.clearLayers();
            allIslands.forEach(island => {
                if (territorialIslands.includes(island['무인도서 정보'])) {
                    const lat = dmsToDecimal(island.Column23);
                    const lng = dmsToDecimal(island.Column24);
                    if (lat && lng) {
                        const marker = L.marker([lat, lng]);
                        marker.on('add', function() {
                            const el = this.getElement();
                            if (el) el.classList.add('territorial-highlight');
                        });
                        marker.bindTooltip(createTooltipContent(island), { permanent: false, direction: 'top', className: 'island-tooltip' });
                        marker.on('click', () => showIslandDetails(island));
                        territorialLayer.addLayer(marker);
                    }
                }
            });
        } else {
            this.classList.remove('active');
            this.textContent = "⚓ 영해기점";
            territorialLayer.clearLayers();
        }
    });
});