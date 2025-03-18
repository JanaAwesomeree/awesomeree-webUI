// api.js
const API_BASE_URL = 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/all-metric';

// Create an API service object to export all functions
const apiService = {
    // Overview functions
    async fetchOverviewData() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/overview`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Error fetching overview data:', error);
            throw error;
        }
    },

    // Account Health functions
    async fetchAccountHealth(date) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/shopee-health?date=${date}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Error fetching account health data:', error);
            throw error;
        }
    },

    // Late Shipment functions
    async fetchLateShipments(shop = 'all') {
        try {
            const response = await fetch(`${API_BASE_URL}/api/late-shipments?shop=${shop}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Error fetching late shipment data:', error);
            throw error;
        }
    },

    // Low Rating functions
    async fetchLowRatings(filters = {}) {
        try {
            const queryParams = new URLSearchParams({
                start_date: filters.startDate || '',
                end_date: filters.endDate || '',
                shop: filters.shop || 'all',
                stars: filters.stars || 'all'
            });
            const response = await fetch(`${API_BASE_URL}/api/low-ratings?${queryParams}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Error fetching low rating data:', error);
            throw error;
        }
    },

    // Comment functions
    async fetchComment(orderId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/comments/${orderId}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Error fetching comment:', error);
            throw error;
        }
    },

    // Settings functions
    async updateSettings(settings) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(settings)
            });
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    }
};