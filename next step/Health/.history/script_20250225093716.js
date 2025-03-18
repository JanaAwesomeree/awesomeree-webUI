// API configuration
const apiEndpoints = {
    Monday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Monday',
    Tuesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Tuesday',
    Wednesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Wednesday',
    Thursday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Thursday',
    Friday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Friday',
    Saturday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Saturday'
};

// Date handling functions
function getDayNameFromDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { weekday: 'long' });
}

// Fixed getWeekBounds to include Saturday
function getWeekBounds() {
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    
    // Calculate the start of the week (Monday)
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    monday.setHours(0, 0, 0, 0);
    
    // Calculate the end of the week (Saturday)
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    saturday.setHours(23, 59, 59, 999);
    
    return { monday, saturday };
}

// Usage example: Fetch data for a specific day
async function fetchPerformanceDataForDay(day) {
    const apiEndpoint = apiEndpoints[day];
    
    if (!apiEndpoint) {
        console.error('Invalid day provided');
        return;
    }
    
    try {
        const response = await fetch(apiEndpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`${day} Data:`, data);
        return data;

    } catch (error) {
        console.error(`Error fetching data for ${day}:`, error);
    }
}

const API_TIMEOUT = 15000;
const RETRY_COUNT = 3;
const RETRY_DELAY = 2000;
const AUTO_REFRESH_INTERVAL = 300000;

// State management
let performanceData = [];
let dateData = {};
let overviewMetrics = {};

// Performance thresholds
const criteria = {
    non_fulfillment_rate: 2.0,
   late_shipment_rate: 1.0,
    preparation_time: 1.0,
    fast_handover_rate: 95,
    response_rate: 98,
   average_response_time: 2.0,
   shop_rating: 4.7,
    onTimeRate: 95,
   average_response_time: 2.0,
    lowRatedOrders: 1,
    penalty_points: 0
};

// Enhanced fetch with timeout
async function fetchWithTimeout(url, options, timeout = API_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check your network connection.');
        }
        throw error;
    }
}

// Message handling
function showMessage(message, type) {
    const messageDiv = document.getElementById('messageContainer') || createMessageContainer();
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    messageDiv.appendChild(messageElement);
    setTimeout(() => messageElement.remove(), 5000);
}

function createMessageContainer() {
    const container = document.createElement('div');
    container.id = 'messageContainer';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000;';
    document.body.appendChild(container);
    return container;
}

const showLoadingMessage = msg => showMessage(msg, 'loading');
const showSuccessMessage = msg => showMessage(msg, 'success');
const showErrorMessage = msg => showMessage(msg, 'error');

// Main data fetching with API response handling
async function fetchPerformanceData(day = 'Monday', retryCount = RETRY_COUNT, retryDelay = RETRY_DELAY) {
    if (!apiEndpoints[day]) {
        showErrorMessage(`Invalid day: ${day}`);
        return;
    }

    let lastError = null;
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
            document.body.classList.add('loading');
            showLoadingMessage(`Fetching data for ${day}... (Attempt ${attempt}/${retryCount})`);
            
            const response = await fetchWithTimeout(apiEndpoints[day], {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors',
                cache: 'no-cache'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`${day} Data:`, data);

            // Process the data based on actual API response
            if (Array.isArray(data)) {
                performanceData = data;
                overviewMetrics = calculateOverviewMetrics(data);
            } else if (typeof data === 'object' && data !== null) {
                performanceData = data.performanceData || [];
                dateData = data.dateData || {};
                overviewMetrics = data.overviewMetrics || calculateOverviewMetrics(performanceData);
            } else {
                throw new Error('Invalid data format received from API');
            }

            updateOverviewMetrics();
            updateTableData();
            
            showSuccessMessage(`Data for ${day} updated successfully`);
            document.body.classList.remove('loading');
            return;

        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt} failed:`, error);
            
            if (attempt < retryCount) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }

    console.error('All attempts failed:', lastError);
    showErrorMessage(`Failed to fetch data for ${day}: ${lastError.message}`);
    resetData();
}

// Calculate overview metrics from performance data
function calculateOverviewMetrics(data) {
    if (!Array.isArray(data) || data.length === 0) return {};
    
    const sum = (arr, key) => arr.reduce((acc, curr) => acc + (curr[key] || 0), 0);
    const avg = (arr, key) => sum(arr, key) / arr.length;
    
    return {
        non_fulfillment_rate: avg(data, 'non_fulfillment_rate'),
       shop_rating: avg(data, 'shopRating'),
      response_rate: avg(data, 'response_Rate'),
        penalty: sum(data, 'penalty')
    };
}

// Reset data states
function resetData() {
    performanceData = [];
    dateData = {};
    overviewMetrics = {};
    updateOverviewMetrics();
    updateTableData();
    document.body.classList.remove('loading');
}

// Fixed displayDateData function
function displayDateData(selectedDate) {
    const tableBody = document.querySelector('#performanceTable');
    if (!tableBody) return;

    try {
        const dayName = getDayNameFromDate(selectedDate);
        
        if (!apiEndpoints[dayName]) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center">No data available for weekends or invalid dates</td></tr>';
            return;
        }
        
        fetchPerformanceData(dayName).catch(error => {
            console.error('Error fetching data:', error);
            showErrorMessage(`Failed to fetch data for ${dayName}: ${error.message}`);
        });
    } catch (error) {
        console.error('Error displaying date data:', error);
        showErrorMessage('Error processing selected date');
    }
}

function initializeCalendar() {
    if (window.flatpickr) {
        const { monday, saturday } = getWeekBounds();
        
        const calendarInstance = flatpickr("#calendar", {
            dateFormat: "Y-m-d",
            defaultDate: new Date(),
            minDate: monday,
            maxDate: saturday,
            enable: [
                function(date) {
                    // Enable Monday through Saturday of the current week
                    const day = date.getDay();
                    const isValidDay = day >= 1 && day <= 6; // Monday = 1, Saturday = 6
                    const isCurrentWeek = date >= monday && date <= saturday;
                    return isValidDay && isCurrentWeek;
                }
            ],
            onChange: (selectedDates, dateStr) => {
                if (selectedDates.length > 0) {
                    displayDateData(dateStr);
                }
            },
            onReady: function(selectedDates, dateStr) {
                const today = new Date();
                const dayName = today.toLocaleString('en-US', { weekday: 'long' });
                
                if (today >= monday && today <= saturday && apiEndpoints[dayName]) {
                    this.setDate(today);
                } else {
                    let lastValidDate = new Date(saturday);
                    while (lastValidDate > monday) {
                        const dayName = lastValidDate.toLocaleString('en-US', { weekday: 'long' });
                        if (apiEndpoints[dayName]) {
                            break;
                        }
                        lastValidDate.setDate(lastValidDate.getDate() - 1);
                    }
                    this.setDate(lastValidDate);
                }
            }
        });

        // Set up nightly update at midnight
        const scheduleNightlyUpdate = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const timeUntilMidnight = tomorrow.getTime() - now.getTime();
            
            setTimeout(() => {
                const { monday: newMonday, saturday: newSaturday } = getWeekBounds();
                // Safely access flatpickr instance
                const calendar = document.querySelector("#calendar");
                if (calendar && calendar._flatpickr) {
                    calendar._flatpickr.set("minDate", newMonday);
                    calendar._flatpickr.set("maxDate", newSaturday);
                    
                    // Refresh data if needed
                    const currentDate = calendar._flatpickr.selectedDates[0];
                    if (currentDate) {
                        displayDateData(currentDate.toISOString().split('T')[0]);
                    }
                }
                
                // Schedule next update
                scheduleNightlyUpdate();
            }, timeUntilMidnight);
        };
        
        // Start the nightly update schedule
        scheduleNightlyUpdate();
    }
}

// Navigation functions remain the same
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('content').classList.toggle('expanded');
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    document.querySelectorAll('#sidebar .nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = Array.from(document.querySelectorAll('#sidebar .nav-link'))
        .find(link => link.getAttribute('onclick') && link.getAttribute('onclick').includes(pageId));
    if (activeLink) activeLink.classList.add('active');
}

// Utility functions remain the same
function getColorClass(value, threshold, isHigherBetter = true) {
    if (value === undefined || value === null) return '';
    const numValue = parseFloat(value);
    return isHigherBetter ? 
        (numValue >= threshold ? 'text-success' : 'text-danger') :
        (numValue <= threshold ? 'text-success' : 'text-danger');
}

function formatValue(value, isPercentage = false) {
    if (value === undefined || value === null) return 'N/A';
    return isPercentage ? `${value}%` : value;
}

// Fixed UI Updates
function updateOverviewMetrics() {
    try {
        const metrics = {
            'non_fulfillment_rate': { id: 'non_fulfillment_rate', isPercent: true, isHigherBetter: false },
            'shop_Rating': { id: 'shopRating', isPercent: false, isHigherBetter: true },
            'penalty': { id: 'penalty_points', isPercent: false, isHigherBetter: false }
        };

        Object.entries(metrics).forEach(([key, config]) => {
            const element = document.getElementById(config.id);
            if (element) {
                const value = overviewMetrics[key];
                const threshold = criteria[key] || criteria[config.id];
                element.className = getColorClass(value, threshold, config.isHigherBetter);
                element.textContent = formatValue(value, config.isPercent);
            }
        });
    } catch (error) {
        console.error('Error updating metrics:', error);
        showErrorMessage('Error updating overview metrics');
    }
}

function updateTableData() {
    const tableBody = document.getElementById('performanceTable');
    if (!tableBody) return;

    try {
        if (!performanceData.length) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center">No data available</td></tr>';
            return;
        }

        tableBody.innerHTML = performanceData.map(data => `
            <tr>
                <td>${data.shopName || 'N/A'}</td>
                <td class="${getColorClass(data.non_fulfillment_rate, criteria.non_fulfillment_rate, false)}">${formatValue(data.non_fulfillment_rate, true)}</td>
                <td class="${getColorClass(data.late_Shipment_Rate, criteria.late_Shipment_Rate, false)}">${formatValue(data.late_Shipment_Rate, true)}</td>
                <td class="${getColorClass(data.preparation_time, criteria.preparation_time, false)}">${formatValue(data.preparation_time)}</td>
                <td class="${getColorClass(data.fast_handover_rate, criteria.fast_handover_rate)}">${formatValue(data.fast_handover_rate, true)}</td>
                <td class="${getColorClass(data.response_Rate, criteria.response_Rate)}">${formatValue(data.response_Rate, true)}</td>
                <td class="${getColorClass(data.avg_Response, criteria.average_response_time, false)}">${formatValue(data.average_response_time)}</td>
                <td class="${getColorClass(data.shop_rating, criteria.shop_rating)}">${formatValue(data.shop_rating)}</td>
                <td class="${data.penalty > 0 ? 'text-danger' : 'text-success'}">${formatValue(data.penalty)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error updating table:', error);
        showErrorMessage('Error updating performance table');
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center">Error loading data</td></tr>';
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeCalendar();

        // Auto-refresh setup
        setInterval(() => {
            const currentDay = new Date().toLocaleString('en-US', { weekday: 'long' });
            if (apiEndpoints[currentDay]) {
                fetchPerformanceData(currentDay).catch(error => {
                    console.error('Auto-refresh failed:', error);
                    showErrorMessage('Auto-refresh failed. Will try again in 5 minutes.');
                });
            }
        }, AUTO_REFRESH_INTERVAL);

        // Initial data load
        const today = new Date();
        const currentDay = today.toLocaleString('en-US', { weekday: 'long' });
        if (apiEndpoints[currentDay]) {
            fetchPerformanceData(currentDay);
        } else {
            // If today is not a workday (Sunday), load the latest available day
            const { monday, saturday } = getWeekBounds();
            let latestAvailableDay = new Date(saturday);
            while (latestAvailableDay >= monday) {
                const dayName = latestAvailableDay.toLocaleString('en-US', { weekday: 'long' });
                if (apiEndpoints[dayName]) {
                    fetchPerformanceData(dayName);
                    break;
                }
                latestAvailableDay.setDate(latestAvailableDay.getDate() - 1);
            }
        }
    } catch (error) {
        console.error('Error during initialization:', error);
        showErrorMessage('Error initializing dashboard');
    }
});