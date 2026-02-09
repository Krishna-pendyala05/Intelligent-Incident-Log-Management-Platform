const axios = require('axios');

async function testIngestion() {
  try {
    const response = await axios.post('http://localhost:3001/ingest', {
      service_id: 'payment-service',
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: 'Payment gateway timeout',
      metadata: { transaction_id: 'tx_12345', amount: 50.00 }
    });
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testIngestion();
