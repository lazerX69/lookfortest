
async function test() {
    try {
        const url = 'https://lookfor-backend.ngrok.app/v1/api/hackathon/get_order_details';
        console.log('Testing Upstream:', url);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_number: '1377958' })
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response:', text);

    } catch (error) {
        console.error('Error:', error);
    }
}

test();
