
async function test() {
    try {
        console.log('Testing Health...');
        const healthRes = await fetch('http://localhost:3000/health');
        const healthText = await healthRes.text();
        console.log('Health:', healthText);

        console.log('Testing Order Details...');
        const response = await fetch('http://localhost:3000/v1/api/hackathon/get_order_details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_number: 'NP1377958' })
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Order Details Response:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

test();
