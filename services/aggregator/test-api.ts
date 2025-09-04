#!/usr/bin/env node

import axios from 'axios';

const API_BASE = 'http://localhost:3100';

async function testAPI() {
  console.log('🧪 Testing WLNX Health Aggregator API...\n');

  try {
    // Test health check
    console.log('1. Testing health check...');
    const health = await axios.get(`${API_BASE}/healthcheck`);
    console.log('✅ Health check:', health.data);

    // Test profile update
    console.log('\n2. Testing profile update...');
    const profile = await axios.post(`${API_BASE}/ingest/health/profile`, {
      dob: '1990-01-01',
      apple_health_uid: 'test_user_123'
    });
    console.log('✅ Profile updated:', profile.data);

    // Test steps ingestion
    console.log('\n3. Testing steps ingestion...');
    const steps = await axios.post(`${API_BASE}/ingest/health/steps`, {
      items: [
        { ts: new Date().toISOString(), count_delta: 100 },
        { ts: new Date(Date.now() - 3600000).toISOString(), count_delta: 150 }
      ]
    });
    console.log('✅ Steps ingested:', steps.data);

    // Test daily metrics
    console.log('\n4. Testing daily metrics...');
    const metrics = await axios.get(`${API_BASE}/metrics/daily`);
    console.log('✅ Daily metrics:', metrics.data);

    // Test advice
    console.log('\n5. Testing advice...');
    const advice = await axios.get(`${API_BASE}/metrics/advice/today`);
    console.log('✅ Today advice:', advice.data);

    console.log('\n🎉 All tests passed!');

  } catch (error: any) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testAPI();
