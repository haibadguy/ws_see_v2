class PerformanceDashboard {
    constructor() {
        this.sseConnection = null;
        this.websocketConnection = null;
        this.isOnline = navigator.onLine;
        this.charts = {};
        this.stats = {
            sse: { messageCount: 0, latencies: [], lastMessage: null },
            websocket: { messageCount: 0, latencies: [], lastMessage: null }
        };
        this.startTime = Date.now();
        
        this.init();
        this.setupEventListeners();
        this.updateStatsInterval();
    }

    init() {
        this.initCharts();
        this.updateConnectionStatus('sse', 'Chưa kết nối', false);
        this.updateConnectionStatus('websocket', 'Chưa kết nối', false);
        // Network status indicators
        const setButtonsForOnline = () => {
            // Disable connect buttons when offline
            document.getElementById('sse-connect').disabled = !this.isOnline;
            document.getElementById('websocket-connect').disabled = !this.isOnline;
        };
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.addLogMessage('sse', 'Trở lại online', 'info');
            this.addLogMessage('websocket', 'Trở lại online', 'info');
            // While SSE retries, reflect reconnecting state until onopen fires
            this.updateConnectionStatus('sse', 'Đang kết nối...', false);
            setButtonsForOnline();
            // SSE will auto-reconnect by itself if it was connected
            // WebSocket remains manual: user must click Kết nối WebSocket
            // Force-refresh SSE connection to avoid being stuck in CONNECTING
            if (this.sseConnection) {
                try { this.sseConnection.close(); } catch (e) {}
                this.sseConnection = null;
            }
            this.connectSSE();
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
            const now = Date.now();
            // Avoid duplicate logs if multiple handlers fire
            if (!this.lastOfflineLog) this.lastOfflineLog = { sse: 0, websocket: 0 };
            if (now - this.lastOfflineLog.sse > 1000) {
                this.addLogMessage('sse', 'Mất kết nối mạng', 'error');
                this.lastOfflineLog.sse = now;
            }
            if (now - this.lastOfflineLog.websocket > 1000) {
                this.addLogMessage('websocket', 'Mất kết nối mạng', 'error');
                this.lastOfflineLog.websocket = now;
            }
            setButtonsForOnline();
            // Immediately reflect SSE connection problem on UI
            this.updateConnectionStatus('sse', 'Lỗi kết nối', false);
            // Close SSE so a clean reconnect happens when back online
            if (this.sseConnection) {
                try { this.sseConnection.close(); } catch (e) {}
                this.sseConnection = null;
            }
            // Explicitly close WebSocket so it does not keep receiving
            if (this.websocketConnection) {
                try { this.websocketConnection.close(); } catch (e) {}
                this.websocketConnection = null;
            }
            this.updateConnectionStatus('websocket', 'Đã ngắt kết nối', false);
            this.toggleButtons('websocket', false);
            // Do not close SSE: let EventSource handle retries automatically
        });
        setButtonsForOnline();
    }

    setupEventListeners() {
        // SSE Controls
        document.getElementById('sse-connect').addEventListener('click', () => this.connectSSE());
        document.getElementById('sse-disconnect').addEventListener('click', () => this.disconnectSSE());

        // WebSocket Controls
        document.getElementById('websocket-connect').addEventListener('click', () => this.connectWebSocket());
        document.getElementById('websocket-disconnect').addEventListener('click', () => this.disconnectWebSocket());
        document.getElementById('websocket-send').addEventListener('click', () => this.sendWebSocketMessage());
        document.getElementById('websocket-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendWebSocketMessage();
        });

        // Global Controls
        document.getElementById('connect-all').addEventListener('click', () => this.connectAll());
        document.getElementById('disconnect-all').addEventListener('click', () => this.disconnectAll());
        document.getElementById('clear-data').addEventListener('click', () => this.clearData());
        document.getElementById('broadcast-btn').addEventListener('click', () => this.broadcastMessage());
    }

    // SSE Connection Management
    connectSSE() {
        if (this.sseConnection) return;

        this.updateConnectionStatus('sse', 'Đang kết nối...', false);
        
        this.sseConnection = new EventSource('/sse');
        
        this.sseConnection.onopen = () => {
            this.updateConnectionStatus('sse', 'Đã kết nối', true);
            this.toggleButtons('sse', true);
            this.addLogMessage('sse', 'Kết nối SSE thành công', 'success');
        };

        this.sseConnection.onmessage = (event) => {
            this.handleSSEMessage(event);
        };

        this.sseConnection.onerror = () => {
            this.updateConnectionStatus('sse', 'Lỗi kết nối', false);
            if (!this.isOnline) return; // avoid duplicate/error noise during offline
            this.addLogMessage('sse', 'Lỗi kết nối SSE', 'error');
        };
    }

    disconnectSSE() {
        if (this.sseConnection) {
            this.sseConnection.close();
            this.sseConnection = null;
            this.updateConnectionStatus('sse', 'Đã ngắt kết nối', false);
            this.toggleButtons('sse', false);
            this.addLogMessage('sse', 'Đã ngắt kết nối SSE', 'info');
        }
    }

    handleSSEMessage(event) {
        try {
            if (!this.isOnline) return; // ignore messages when offline
            const data = JSON.parse(event.data);
            const timestamp = Date.now();
            const latency = timestamp - new Date(data.timestamp).getTime();
            
            this.stats.sse.messageCount++;
            this.stats.sse.latencies.push(latency);
            let displayMessage = '-';
            if (data.type === 'sensor-data') {
                const value = typeof data.value === 'number' ? data.value.toFixed(1) : String(data.value);
                displayMessage = `seq:${data.sequence} val:${value}`;
            } else if (data.type === 'broadcast' && data.message) {
                displayMessage = data.message;
            } else if (data.type === 'connection') {
                displayMessage = 'SSE connection established';
            }
            this.stats.sse.lastMessage = displayMessage;
            
            // Keep only last 50 latency measurements
            if (this.stats.sse.latencies.length > 50) {
                this.stats.sse.latencies.shift();
            }
            
            this.updateMetrics('sse');
            this.addLogMessage('sse', displayMessage, 'received', latency);
            this.updateCharts();
        } catch (error) {
            console.error('Error parsing SSE message:', error);
        }
    }

    // WebSocket Connection Management
    connectWebSocket() {
        if (this.websocketConnection) return;

        this.updateConnectionStatus('websocket', 'Đang kết nối...', false);
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.websocketConnection = new WebSocket(wsUrl);
        
        this.websocketConnection.onopen = () => {
            this.updateConnectionStatus('websocket', 'Đã kết nối', true);
            this.toggleButtons('websocket', true);
            this.addLogMessage('websocket', 'Kết nối WebSocket thành công', 'success');
        };

        this.websocketConnection.onmessage = (event) => {
            this.handleWebSocketMessage(event);
        };

        this.websocketConnection.onerror = () => {
            this.updateConnectionStatus('websocket', 'Lỗi kết nối', false);
            this.addLogMessage('websocket', 'Lỗi kết nối WebSocket', 'error');
        };

        this.websocketConnection.onclose = () => {
            this.updateConnectionStatus('websocket', 'Đã ngắt kết nối', false);
            this.toggleButtons('websocket', false);
            if (!this.isOnline) return; // suppress duplicate message on offline
            this.addLogMessage('websocket', 'Kết nối WebSocket đã đóng', 'info');
            // Do NOT auto-reconnect; keep manual for demo clarity
        };
    }

    disconnectWebSocket() {
        if (this.websocketConnection) {
            this.websocketConnection.close();
            this.websocketConnection = null;
        }
    }

    handleWebSocketMessage(event) {
        try {
            if (!this.isOnline) return; // ignore messages when offline
            const data = JSON.parse(event.data);
            const timestamp = Date.now();
            const latency = timestamp - new Date(data.timestamp).getTime();
            
            this.stats.websocket.messageCount++;
            this.stats.websocket.latencies.push(latency);
            let displayMessage = '-';
            if (data.type === 'sensor-data') {
                const value = typeof data.value === 'number' ? data.value.toFixed(1) : String(data.value);
                displayMessage = `seq:${data.sequence} val:${value}`;
            } else if (data.type === 'broadcast' && data.message) {
                displayMessage = data.message;
            } else if (data.type === 'echo' && data.original && data.original.message) {
                displayMessage = data.original.message;
            } else if (data.type === 'connection') {
                displayMessage = 'WebSocket connection established';
            }
            this.stats.websocket.lastMessage = displayMessage;
            
            // Keep only last 50 latency measurements
            if (this.stats.websocket.latencies.length > 50) {
                this.stats.websocket.latencies.shift();
            }
            
            this.updateMetrics('websocket');
            this.addLogMessage('websocket', displayMessage, 'received', latency);
            this.updateCharts();
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    sendWebSocketMessage() {
        const input = document.getElementById('websocket-input');
        const message = input.value.trim();
        
        if (message && this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
            const data = {
                message: message,
                timestamp: new Date().toISOString(),
                type: 'client-message'
            };
            
            this.websocketConnection.send(JSON.stringify(data));
            this.addLogMessage('websocket', message, 'sent');
            input.value = '';
        }
    }

    // UI Helper Methods
    updateConnectionStatus(protocol, status, connected) {
        const statusElement = document.getElementById(`${protocol}-status`);
        const dotElement = document.getElementById(`${protocol}-status-dot`);
        
        statusElement.textContent = status;
        dotElement.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
    }

    toggleButtons(protocol, connected) {
        const connectBtn = document.getElementById(`${protocol}-connect`);
        const disconnectBtn = document.getElementById(`${protocol}-disconnect`);
        
        connectBtn.disabled = connected;
        disconnectBtn.disabled = !connected;
        
        if (protocol === 'websocket') {
            document.getElementById('websocket-send').disabled = !connected;
        }
    }

    updateMetrics(protocol) {
        const stats = this.stats[protocol];
        const avgLatency = stats.latencies.length > 0 
            ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length)
            : 0;
        
        document.getElementById(`${protocol}-message-count`).textContent = stats.messageCount;
        document.getElementById(`${protocol}-avg-latency`).textContent = `${avgLatency}ms`;
        document.getElementById(`${protocol}-last-message`).textContent = 
            stats.lastMessage ? stats.lastMessage.substring(0, 30) + (stats.lastMessage.length > 30 ? '...' : '') : '-';
    }

    addLogMessage(protocol, message, type, latency = null) {
        const logContainer = document.getElementById(`${protocol}-messages`);
        const messageDiv = document.createElement('div');
        messageDiv.className = `log-message log-${type}`;
        
        const time = new Date().toLocaleTimeString('vi-VN');
        const latencyText = latency !== null ? ` (${latency}ms)` : '';
        
        messageDiv.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-content">${message}</span>
            <span class="log-latency">${latencyText}</span>
        `;
        
        logContainer.insertBefore(messageDiv, logContainer.firstChild);
        
        // Keep only last 10 messages
        while (logContainer.children.length > 10) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    // Chart Management
    initCharts() {
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    labels: {
                        font: { size: 12 }
                    }
                }
            }
        };

        // Latency Chart
        this.charts.latency = new Chart(document.getElementById('latencyChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'SSE Độ trễ (ms)',
                        data: [],
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.1
                    },
                    {
                        label: 'WebSocket Độ trễ (ms)',
                        data: [],
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        tension: 0.1
                    }
                ]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        title: {
                            display: true,
                            text: 'Độ trễ (ms)'
                        }
                    }
                }
            }
        });

        // Throughput Chart
        this.charts.throughput = new Chart(document.getElementById('throughputChart'), {
            type: 'bar',
            data: {
                labels: ['SSE', 'WebSocket'],
                datasets: [{
                    label: 'Tin nhắn nhận được',
                    data: [0, 0],
                    backgroundColor: ['#4CAF50', '#2196F3']
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        title: {
                            display: true,
                            text: 'Số tin nhắn'
                        }
                    }
                }
            }
        });

        // Network Simulation Chart
        this.charts.network = new Chart(document.getElementById('networkChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Độ trễ mạng mô phỏng (ms)',
                    data: [],
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        title: {
                            display: true,
                            text: 'Độ trễ (ms)'
                        }
                    }
                }
            }
        });
    }

    updateCharts() {
        // Update latency chart
        const now = new Date().toLocaleTimeString('vi-VN');
        
        if (this.charts.latency.data.labels.length >= 20) {
            this.charts.latency.data.labels.shift();
            this.charts.latency.data.datasets[0].data.shift();
            this.charts.latency.data.datasets[1].data.shift();
        }
        
        this.charts.latency.data.labels.push(now);
        
        const sseLatency = this.stats.sse.latencies.length > 0 
            ? this.stats.sse.latencies[this.stats.sse.latencies.length - 1] 
            : 0;
        const wsLatency = this.stats.websocket.latencies.length > 0 
            ? this.stats.websocket.latencies[this.stats.websocket.latencies.length - 1] 
            : 0;
            
        this.charts.latency.data.datasets[0].data.push(sseLatency);
        this.charts.latency.data.datasets[1].data.push(wsLatency);
        this.charts.latency.update('none');

        // Update throughput chart
        this.charts.throughput.data.datasets[0].data = [
            this.stats.sse.messageCount,
            this.stats.websocket.messageCount
        ];
        this.charts.throughput.update('none');

        // Update network simulation chart
        const networkDelay = 50 + Math.random() * 100; // Simulate 50-150ms network delay
        
        if (this.charts.network.data.labels.length >= 20) {
            this.charts.network.data.labels.shift();
            this.charts.network.data.datasets[0].data.shift();
        }
        
        this.charts.network.data.labels.push(now);
        this.charts.network.data.datasets[0].data.push(networkDelay);
        this.charts.network.update('none');
    }

    // Global Actions
    connectAll() {
        this.connectSSE();
        this.connectWebSocket();
    }

    disconnectAll() {
        this.disconnectSSE();
        this.disconnectWebSocket();
    }

    clearData() {
        this.stats.sse = { messageCount: 0, latencies: [], lastMessage: null };
        this.stats.websocket = { messageCount: 0, latencies: [], lastMessage: null };
        
        // Clear charts
        Object.values(this.charts).forEach(chart => {
            chart.data.labels = [];
            chart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            chart.update();
        });
        
        // Reset throughput chart specifically
        this.charts.throughput.data.datasets[0].data = [0, 0];
        this.charts.throughput.update();
        
        // Clear metrics
        this.updateMetrics('sse');
        this.updateMetrics('websocket');
        
        // Clear message logs
        document.getElementById('sse-messages').innerHTML = '';
        document.getElementById('websocket-messages').innerHTML = '';
        
        this.addLogMessage('sse', 'Đã xóa dữ liệu', 'info');
        this.addLogMessage('websocket', 'Đã xóa dữ liệu', 'info');
    }

    broadcastMessage() {
        const input = document.getElementById('broadcast-message');
        const message = input.value.trim();
        
        if (message) {
            fetch('/api/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    protocol: 'all'
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log('Broadcast sent:', data);
                input.value = '';
            })
            .catch(error => {
                console.error('Broadcast error:', error);
            });
        }
    }

    // Stats Update
    updateStatsInterval() {
        setInterval(() => {
            this.fetchServerStats();
            this.updateUptime();
        }, 1000);
    }

    async fetchServerStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            
            document.getElementById('sse-clients').textContent = stats.sse.activeClients;
            document.getElementById('websocket-clients').textContent = stats.websocket.activeClients;
            document.getElementById('total-messages').textContent = stats.total.messagesSent;
            // Use server uptime rather than client-local timer
            if (stats.uptime && stats.uptime.humanReadable) {
                document.getElementById('uptime').textContent = stats.uptime.humanReadable;
            }
        } catch (error) {
            console.error('Error fetching server stats:', error);
        }
    }

    updateUptime() {
        // Server-provided uptime is refreshed in fetchServerStats; nothing to do here
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PerformanceDashboard();
});
