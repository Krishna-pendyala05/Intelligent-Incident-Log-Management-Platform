const axios = require('axios');

async function testDetection() {
  const url = 'http://localhost:3001/ingest';
  const logs = [];

  // Send 6 error logs
  for (let i = 0; i < 6; i++) {
    logs.push(axios.post(url, {
      service_id: 'payment-service',
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: `Payment failure #${i}`,
      metadata: { error_code: 500 }
    }));
  }

  try {
    await Promise.all(logs);
    console.log('Sent 6 error logs.');
    
    console.log('Waiting 15 seconds for detection...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check incidents
    const incidents = await axios.get('http://localhost:3001/incidents');
    console.log('Incidents:', JSON.stringify(incidents.data, null, 2));

    if (incidents.data.length > 0) {
        console.log('SUCCESS: Incident created.');
    } else {
        console.log('FAILURE: No incident created.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDetection();
