const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class PerformanceDemoServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    
    // Statistics
    this.stats = {
      startTime: new Date(),
      sse: {
        clients: new Set(),
        messagesSent: 0,
        totalClients: 0
      },
      websocket: {
        clients: new Set(),
        messagesSent: 0,
        totalClients: 0
      }
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.startDataGeneration();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../client')));
  }

  setupRoutes() {
    // Main dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../client/index.html'));
    });

    // SSE endpoint
    this.app.get('/sse', (req, res) => {
      this.handleSSEConnection(req, res);
    });

    // Statistics API
    this.app.get('/api/stats', (req, res) => {
      res.json(this.getStats());
    });

    // Send message to all clients
    this.app.post('/api/broadcast', (req, res) => {
      const { message, protocol } = req.body;
      this.broadcastMessage(message, protocol);
      res.json({ status: 'Message broadcasted', protocol });
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      this.handleWebSocketConnection(ws, req);
    });
  }

  handleSSEConnection(req, res) {
    const clientId = uuidv4();
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Suggest client retry delay for auto-reconnect
    res.write(`retry: 3000\n\n`);

    console.log(`📡 SSE Client connected: ${clientId}`);
    
    const client = {
      id: clientId,
      response: res,
      connectedAt: new Date(),
      messageCount: 0
    };

    this.stats.sse.clients.add(client);
    this.stats.sse.totalClients++;

    // Send welcome message
    this.sendSSEMessage(res, {
      type: 'connection',
      id: clientId,
      message: 'SSE connection established',
      timestamp: new Date().toISOString(),
      protocol: 'sse'
    });

    // Handle client disconnect
    req.on('close', () => {
      console.log(`📡 SSE Client disconnected: ${clientId}`);
      this.stats.sse.clients.delete(client);
    });

    req.on('error', (err) => {
      console.error(`📡 SSE Client error: ${clientId}`, err);
      this.stats.sse.clients.delete(client);
    });
  }

  handleWebSocketConnection(ws, req) {
    const clientId = uuidv4();
    
    const client = {
      id: clientId,
      ws: ws,
      connectedAt: new Date(),
      messageCount: 0
    };

    this.stats.websocket.clients.add(client);
    this.stats.websocket.totalClients++;

    console.log(`🔌 WebSocket Client connected: ${clientId}`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection',
      id: clientId,
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString(),
      protocol: 'websocket'
    }));

    // Handle messages from client
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log(`📨 WebSocket message from ${clientId}:`, data);
        
        // Echo back with timestamp
        ws.send(JSON.stringify({
          type: 'echo',
          original: data,
          timestamp: new Date().toISOString(),
          protocol: 'websocket'
        }));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log(`🔌 WebSocket Client disconnected: ${clientId}`);
      this.stats.websocket.clients.delete(client);
    });

    ws.on('error', (err) => {
      console.error(`🔌 WebSocket Client error: ${clientId}`, err);
      this.stats.websocket.clients.delete(client);
    });
  }

  sendSSEMessage(res, data) {
    // Include event id for reconnection continuity
    if (data && data.id) {
      res.write(`id: ${data.id}\n`);
    }
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  generateMockData() {
    const timestamp = new Date().toISOString();
    const sequence = this.stats.sse.messagesSent + this.stats.websocket.messagesSent;
    
    // Simulate network conditions
    const networkDelay = Math.random() * 100; // 0-100ms delay
    const packetLoss = Math.random() < 0.02; // 2% packet loss
    
    if (packetLoss) {
      return null; // Simulate packet loss
    }

    return {
      id: uuidv4(),
      timestamp: timestamp,
      sequence: sequence,
      value: Math.random() * 100,
      networkDelay: networkDelay,
      packetLoss: packetLoss,
      type: 'sensor-data',
      serverTime: Date.now()
    };
  }

  startDataGeneration() {
    setInterval(() => {
      const data = this.generateMockData();
      
      if (!data) return; // Skip if packet loss

      // Send to SSE clients
      this.stats.sse.clients.forEach(client => {
        try {
          const sseData = { ...data, protocol: 'sse' };
          this.sendSSEMessage(client.response, sseData);
          client.messageCount++;
          this.stats.sse.messagesSent++;
        } catch (error) {
          console.error('Error sending SSE message:', error);
          this.stats.sse.clients.delete(client);
        }
      });

      // Send to WebSocket clients
      this.stats.websocket.clients.forEach(client => {
        try {
          const wsData = { ...data, protocol: 'websocket' };
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(wsData));
            client.messageCount++;
            this.stats.websocket.messagesSent++;
          } else {
            this.stats.websocket.clients.delete(client);
          }
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
          this.stats.websocket.clients.delete(client);
        }
      });

    }, 1000); // Send every second
  }

  broadcastMessage(message, protocol = 'all') {
    const broadcastData = {
      type: 'broadcast',
      message: message,
      timestamp: new Date().toISOString(),
      id: uuidv4()
    };

    if (protocol === 'all' || protocol === 'sse') {
      this.stats.sse.clients.forEach(client => {
        this.sendSSEMessage(client.response, { ...broadcastData, protocol: 'sse' });
      });
    }

    if (protocol === 'all' || protocol === 'websocket') {
      this.stats.websocket.clients.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({ ...broadcastData, protocol: 'websocket' }));
        }
      });
    }
  }

  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    
    return {
      uptime: {
        seconds: Math.floor(uptime / 1000),
        humanReadable: this.formatUptime(uptime)
      },
      sse: {
        activeClients: this.stats.sse.clients.size,
        totalClients: this.stats.sse.totalClients,
        messagesSent: this.stats.sse.messagesSent,
        messagesPerSecond: this.stats.sse.messagesSent / (uptime / 1000)
      },
      websocket: {
        activeClients: this.stats.websocket.clients.size,
        totalClients: this.stats.websocket.totalClients,
        messagesSent: this.stats.websocket.messagesSent,
        messagesPerSecond: this.stats.websocket.messagesSent / (uptime / 1000)
      },
      total: {
        activeClients: this.stats.sse.clients.size + this.stats.websocket.clients.size,
        messagesSent: this.stats.sse.messagesSent + this.stats.websocket.messagesSent
      }
    };
  }

  formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }

  start(port = 3000) {
    this.server.listen(port, () => {
      console.log('🚀 Performance Demo Server Started!');
      console.log(`📊 Dashboard: http://localhost:${port}`);
      console.log(`📡 SSE Endpoint: http://localhost:${port}/sse`);
      console.log(`🔌 WebSocket Endpoint: ws://localhost:${port}`);
      console.log(`📈 Stats API: http://localhost:${port}/api/stats`);
      console.log('\n=== TECHNOLOGY COMPARISON ===');
      console.log('SSE: HTTP-based, unidirectional, automatic reconnection');
      console.log('WebSocket: TCP-based, bidirectional, manual reconnection');
      console.log('================================');
    });
  }
}

// Start the server
const demoServer = new PerformanceDemoServer();
demoServer.start(process.env.PORT || 3000);

module.exports = PerformanceDemoServer;