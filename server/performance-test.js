const { performance } = require('perf_hooks');
const WebSocket = require('ws');
const EventSource = require('eventsource');

class PerformanceBenchmark {
  constructor() {
    this.results = {
      sse: {
        latencies: [],
        messageCount: 0,
        errors: 0,
        startTime: 0,
        endTime: 0
      },
      websocket: {
        latencies: [],
        messageCount: 0,
        errors: 0,
        startTime: 0,
        endTime: 0
      }
    };
  }

  async testSSE(messageCount = 100) {
    return new Promise((resolve) => {
      console.log('🧪 Starting SSE performance test...');
      
      const eventSource = new EventSource('http://localhost:3000/sse');
      let receivedMessages = 0;
      const startTime = performance.now();

      this.results.sse.startTime = startTime;

      eventSource.onmessage = (event) => {
        const endTime = performance.now();
        const data = JSON.parse(event.data);
        
        if (data.type === 'sensor-data') {
          const latency = endTime - startTime;
          this.results.sse.latencies.push(latency);
          this.results.sse.messageCount++;
          receivedMessages++;

          if (receivedMessages >= messageCount) {
            this.results.sse.endTime = performance.now();
            eventSource.close();
            resolve();
          }
        }
      };

      eventSource.onerror = (error) => {
        this.results.sse.errors++;
        console.error('SSE Error:', error);
      };

      // Timeout after 30 seconds
      setTimeout(() => {
        eventSource.close();
        console.log('SSE Test timeout');
        resolve();
      }, 30000);
    });
  }

  async testWebSocket(messageCount = 100) {
    return new Promise((resolve) => {
      console.log('🧪 Starting WebSocket performance test...');
      
      const ws = new WebSocket('ws://localhost:3000');
      let receivedMessages = 0;
      const startTime = performance.now();

      this.results.websocket.startTime = startTime;

      ws.on('open', () => {
        console.log('WebSocket connected for performance test');
      });

      ws.on('message', (data) => {
        const endTime = performance.now();
        const message = JSON.parse(data);
        
        if (message.type === 'sensor-data') {
          const latency = endTime - startTime;
          this.results.websocket.latencies.push(latency);
          this.results.websocket.messageCount++;
          receivedMessages++;

          if (receivedMessages >= messageCount) {
            this.results.websocket.endTime = performance.now();
            ws.close();
            resolve();
          }
        }
      });

      ws.on('error', (error) => {
        this.results.websocket.errors++;
        console.error('WebSocket Error:', error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        ws.close();
        console.log('WebSocket Test timeout');
        resolve();
      }, 30000);
    });
  }

  calculateStats(protocol) {
    const latencies = this.results[protocol].latencies;
    if (latencies.length === 0) return null;

    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const max = Math.max(...latencies);
    const min = Math.min(...latencies);
    
    // Calculate percentiles
    const sorted = [...latencies].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    const duration = (this.results[protocol].endTime - this.results[protocol].startTime) / 1000;
    const messagesPerSecond = latencies.length / duration;

    return {
      messageCount: latencies.length,
      averageLatency: avg,
      minLatency: min,
      maxLatency: max,
      p95Latency: p95,
      p99Latency: p99,
      errors: this.results[protocol].errors,
      duration: duration,
      messagesPerSecond: messagesPerSecond
    };
  }

  printResults() {
    console.log('\n📊 ===== PERFORMANCE BENCHMARK RESULTS =====\n');

    const sseStats = this.calculateStats('sse');
    const wsStats = this.calculateStats('websocket');

    if (sseStats) {
      console.log('📡 SERVER-SENT EVENTS (SSE):');
      console.log(`   Messages: ${sseStats.messageCount}`);
      console.log(`   Avg Latency: ${sseStats.averageLatency.toFixed(2)}ms`);
      console.log(`   Min Latency: ${sseStats.minLatency.toFixed(2)}ms`);
      console.log(`   Max Latency: ${sseStats.maxLatency.toFixed(2)}ms`);
      console.log(`   P95 Latency: ${sseStats.p95Latency.toFixed(2)}ms`);
      console.log(`   P99 Latency: ${sseStats.p99Latency.toFixed(2)}ms`);
      console.log(`   Messages/sec: ${sseStats.messagesPerSecond.toFixed(2)}`);
      console.log(`   Errors: ${sseStats.errors}`);
      console.log(`   Duration: ${sseStats.duration.toFixed(2)}s\n`);
    }

    if (wsStats) {
      console.log('🔌 WEBSOCKET:');
      console.log(`   Messages: ${wsStats.messageCount}`);
      console.log(`   Avg Latency: ${wsStats.averageLatency.toFixed(2)}ms`);
      console.log(`   Min Latency: ${wsStats.minLatency.toFixed(2)}ms`);
      console.log(`   Max Latency: ${wsStats.maxLatency.toFixed(2)}ms`);
      console.log(`   P95 Latency: ${wsStats.p95Latency.toFixed(2)}ms`);
      console.log(`   P99 Latency: ${wsStats.p99Latency.toFixed(2)}ms`);
      console.log(`   Messages/sec: ${wsStats.messagesPerSecond.toFixed(2)}`);
      console.log(`   Errors: ${wsStats.errors}`);
      console.log(`   Duration: ${wsStats.duration.toFixed(2)}s\n`);
    }

    if (sseStats && wsStats) {
      console.log('🏆 COMPARISON:');
      const latencyDiff = ((wsStats.averageLatency - sseStats.averageLatency) / sseStats.averageLatency * 100).toFixed(2);
      const throughputDiff = ((wsStats.messagesPerSecond - sseStats.messagesPerSecond) / sseStats.messagesPerSecond * 100).toFixed(2);
      
      console.log(`   Latency Difference: ${latencyDiff}%`);
      console.log(`   Throughput Difference: ${throughputDiff}%`);
      
      if (Math.abs(parseFloat(latencyDiff)) < 10) {
        console.log('   💡 Conclusion: Both protocols perform similarly for one-way communication');
      } else if (parseFloat(latencyDiff) > 0) {
        console.log('   💡 Conclusion: SSE has better latency for this use case');
      } else {
        console.log('   💡 Conclusion: WebSocket has better latency for this use case');
      }
    }

    console.log('============================================\n');
  }

  async runBenchmark(messageCount = 100) {
    console.log('🚀 Starting performance benchmark...');
    console.log(`📨 Testing with ${messageCount} messages per protocol\n`);

    await Promise.all([
      this.testSSE(messageCount),
      this.testWebSocket(messageCount)
    ]);

    this.printResults();
  }
}

// Run benchmark if server is running
const benchmark = new PerformanceBenchmark();
setTimeout(() => {
  benchmark.runBenchmark(100);
}, 2000);