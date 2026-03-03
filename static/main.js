const socket = io();
let map;
let markers = {};
let latencyChart;

// Initialize Map
function initMap() {
    map = L.map('map').setView([24.7136, 46.6753], 5); // Default to Saudi Arabia center roughly
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

// Initialize Chart
function initChart() {
    const ctx = document.getElementById('latencyChart').getContext('2d');
    latencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Latency (ms) [Select Device First]',
                data: [],
                borderColor: '#0d6efd',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Fetch Initial Devices
async function fetchDevices() {
    const res = await fetch('/api/devices');
    const devices = await res.json();
    renderDeviceList(devices);
    updateSummary(devices);
    devices.forEach(d => updateMarker(d));
}

function getStatusClass(status) {
    if (status === 'Online') return 'status-online';
    if (status === 'Offline') return 'status-offline';
    if (status === 'Warning') return 'status-warning';
    return 'status-unknown';
}

function getMarkerColor(status) {
    if (status === 'Online') return 'green';
    if (status === 'Offline') return 'red';
    if (status === 'Warning') return 'orange';
    return 'grey';
}

// Create custom colored markers based on status
function createIcon(status) {
    const color = getMarkerColor(status);
    return new L.Icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
}

function updateMarker(device) {
    if (!device.latitude || !device.longitude) return;

    if (markers[device.id]) {
        map.removeLayer(markers[device.id]);
    }

    const marker = L.marker([device.latitude, device.longitude], {icon: createIcon(device.last_status)}).addTo(map);
    marker.bindPopup(`<b>${device.name}</b><br>IP: ${device.ip}<br>Status: ${device.last_status}<br>Latency: ${device.last_response_time || 'N/A'} ms`);
    markers[device.id] = marker;
}

function renderDeviceList(devices) {
    const wrapper = document.getElementById('devicesListWrapper');
    wrapper.innerHTML = '';
    devices.forEach(d => {
        const dItem = document.createElement('div');
        dItem.className = 'list-group-item';
        dItem.onclick = () => loadDeviceChart(d);
        
        let statusDisplay = `<span class="status-badge ${getStatusClass(d.last_status)}" title="${d.last_status}"></span>`;
        dItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-center">
                <h6 class="mb-1">${d.name}</h6>
                <div>
                    ${statusDisplay}
                    <button class="btn btn-sm btn-outline-danger ms-2 border-0" onclick="deleteDevice(event, ${d.id})"><small>x</small></button>
                </div>
            </div>
            <p class="mb-1 small text-muted">${d.ip}</p>
            <div class="small-stat">Last Check: ${d.last_checked ? new Date(d.last_checked).toLocaleTimeString() : 'Pending'}</div>
        `;
        wrapper.appendChild(dItem);
    });
}

function updateSummary(devices) {
    document.getElementById('totalCount').innerText = devices.length;
    document.getElementById('onlineCount').innerText = devices.filter(d => d.last_status === 'Online').length;
    document.getElementById('offlineCount').innerText = devices.filter(d => d.last_status === 'Offline').length;
}

let activeDeviceId = null;

async function loadDeviceChart(device) {
    activeDeviceId = device.id;
    document.getElementById('chartTitle').innerText = `${device.name} (- Latency)`;
    latencyChart.data.datasets[0].label = `Latency for ${device.name}`;
    
    const res = await fetch(`/api/logs/${device.id}`);
    const logs = await res.json();
    
    // Sort chronological (tail returns DESC)
    logs.reverse();
    
    latencyChart.data.labels = logs.map(l => new Date(l.timestamp).toLocaleTimeString());
    latencyChart.data.datasets[0].data = logs.map(l => l.latency);
    latencyChart.update();
}

// Add Device Event
document.getElementById('addDeviceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Basic IP validation regex to prevent injection or malformed issues trivially
    const ipField = document.getElementById('deviceIp').value;
    const ipPattern = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    
    if(!ipPattern.test(ipField)) {
        alert("Invalid IP Formatting");
        return;
    }

    const data = {
        name: document.getElementById('deviceName').value,
        ip: ipField,
        latitude: parseFloat(document.getElementById('deviceLat').value),
        longitude: parseFloat(document.getElementById('deviceLng').value)
    };

    const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        document.getElementById('addDeviceForm').reset();
    } else {
        const err = await res.json();
        alert(err.error);
    }
});

async function deleteDevice(e, id) {
    e.stopPropagation();
    if(confirm('Delete device?')) {
        await fetch(`/api/devices/${id}`, {method: 'DELETE'});
    }
}

// Socket Events
socket.on('device_status_update', (data) => {
    // We receive entire re-mapped status from thread
    const device = data.device;
    const log = data.log;
    
    updateMarker(device);
    
    if (activeDeviceId === device.id) {
        latencyChart.data.labels.push(new Date(log.timestamp).toLocaleTimeString());
        latencyChart.data.datasets[0].data.push(log.latency);
        
        // Keep last 50 entries so graph does not freeze/overwhelm
        if(latencyChart.data.labels.length > 50) {
            latencyChart.data.labels.shift();
            latencyChart.data.datasets[0].data.shift();
        }
        latencyChart.update();
    }
    
    fetchDevices(); // Inefficient but fine for simple dashboard! Re-renders table smoothly
});

socket.on('device_added', () => fetchDevices());
socket.on('device_removed', () => fetchDevices());

// Init
window.onload = () => {
    initMap();
    initChart();
    fetchDevices();
};
