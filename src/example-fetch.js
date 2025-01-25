// Example of fetching subscriptions
async function fetchSubscriptions() {
  try {
    const response = await fetch('http://localhost:3000/subscriptions', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer your-jwt-token',
        'X-User-ID': 'your-user-id',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.subscriptions;
  } catch (error) {
    console.error('Failed to fetch subscriptions:', error);
    throw error;
  }
}