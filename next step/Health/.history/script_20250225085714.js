// API configuration
const apiEndpoints = {
    Monday: 'https://t9x8zj0h-8000.asse.devtunnels.ms//shopee-health/daily-metrics/?day=Monday',
    Tuesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms//shopee-health/daily-metrics/?day=Tuesday',
    Wednesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms//shopee-health/daily-metrics/?day=Wednesday',
    Thursday: 'https://t9x8zj0h-8000.asse.devtunnels.ms//shopee-health/daily-metrics/?day=Thursday',
    Friday: 'https://t9x8zj0h-8000.asse.devtunnels.ms//shopee-health/daily-metrics/?day=Friday',
    Saturday: 'https://t9x8zj0h-8000.asse.devtunnels.ms//shopee-health/daily-metrics/?day=Saturday'
};

// Date handling function
function getDayNameFromDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { weekday: 'long' });
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
    nonFulfillRate: 2.0,
    lateShipmentRate: 1.0,
    prepTime: 1.0,
    handover: 95,
    responseRate: 98,
    avgResponse: 2.0,
    shopRating: 4.7,
    onTimeRate: 95,
    avgDelay: 2.0,
    lowRatedOrders: 1
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
        nonFulfillRate: avg(data, 'nonFulfillRate'),
        shopRating: avg(data, 'shopRating'),
        responseRate: avg(data, 'responseRate'),
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
        .find(link => link.getAttribute('onclick').includes(pageId));
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

// UI Updates remain the same
function updateOverviewMetrics() {
    try {
        const metrics = {
            'nonFulfillRate': { id: 'nonFulfillRate', isPercent: true, isHigherBetter: false },
            'shopRating': { id: 'shopRating', isPercent: false, isHigherBetter: true },
            'penaltyPoints': { id: 'penaltyPoints', isPercent: false, isHigherBetter: false }
        };

        Object.entries(metrics).forEach(([key, config]) => {
            const element = document.getElementById(config.id);
            if (element) {
                const value = overviewMetrics[key];
                element.className = getColorClass(value, criteria[key], config.isHigherBetter);
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
                <td class="${getColorClass(data.nonFulfillRate, criteria.nonFulfillRate, false)}">${formatValue(data.nonFulfillRate, true)}</td>
                <td class="${getColorClass(data.lateShipmentRate, criteria.lateShipmentRate, false)}">${formatValue(data.lateShipmentRate, true)}</td>
                <td class="${getColorClass(data.prepTime, criteria.prepTime, false)}">${formatValue(data.prepTime)}</td>
                <td class="${getColorClass(data.handover, criteria.handover)}">${formatValue(data.handover, true)}</td>
                <td class="${getColorClass(data.responseRate, criteria.responseRate)}">${formatValue(data.responseRate, true)}</td>
                <td class="${getColorClass(data.avgResponse, criteria.avgResponse, false)}">${formatValue(data.avgResponse)}</td>
                <td class="${getColorClass(data.shopRating, criteria.shopRating)}">${formatValue(data.shopRating)}</td>
                <td class="${data.penalty > 0 ? 'text-danger' : 'text-success'}">${formatValue(data.penalty)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error updating table:', error);
        showErrorMessage('Error updating performance table');
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center">Error loading data</td></tr>';
    }
}
class WeeklyCalendar {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.selectedDate = null;
        this.currentWeekStart = this.getWeekStart(new Date());
        
        // Update calendar daily at midnight
        this.scheduleNextUpdate();
        this.init();
    }

    scheduleNextUpdate() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const timeUntilMidnight = tomorrow.getTime() - now.getTime();
        
        setTimeout(() => {
            this.currentWeekStart = this.getWeekStart(new Date());
            this.render();
            this.scheduleNextUpdate();
        }, timeUntilMidnight);
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        return new Date(d.setDate(diff));
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).format(date);
    }

    isDateSelectable(date) {
        // Get the start and end of the current week
        const weekStart = new Date(this.currentWeekStart);
        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        // Allow selection of any day within the current week
        return date >= weekStart && date <= weekEnd;
    }

    createWeekNavigation() {
        const nav = document.createElement('div');
        nav.className = 'week-navigation';
        
        const weekLabel = document.createElement('h2');
        weekLabel.textContent = 'Week of ' + this.formatDate(this.currentWeekStart);
        
        nav.appendChild(weekLabel);
        return nav;
    }

    createCalendarGrid() {
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        for (let i = 0; i < 7; i++) {
            const date = new Date(this.currentWeekStart);
            date.setDate(date.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day' + 
                (!this.isDateSelectable(date) ? ' disabled' : '');
            
            const dayName = document.createElement('div');
            dayName.className = 'day-name';
            dayName.textContent = date.toLocaleDateString('en-US', { weekday: 'short' });
            
            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = date.getDate();
            
            dayElement.appendChild(dayName);
            dayElement.appendChild(dayNumber);
            
            // Add today indicator
            if (this.isToday(date)) {
                const todayIndicator = document.createElement('div');
                todayIndicator.className = 'today-indicator';
                todayIndicator.textContent = 'Today';
                dayElement.appendChild(todayIndicator);
            }
            
            if (this.isDateSelectable(date)) {
                dayElement.addEventListener('click', () => this.selectDate(date));
            }
            
            grid.appendChild(dayElement);
        }

        return grid;
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    selectDate(date) {
        if (!this.isDateSelectable(date)) {
            return;
        }

        this.selectedDate = date;
        this.render();
        
        const formattedDate = date.toISOString().split('T')[0];
        this.displayDateData(formattedDate);
    }

    displayDateData(dateStr) {
        const date = new Date(dateStr);
        const dayName = date.toLocaleString('en-US', { weekday: 'long' });
        console.log(`Selected date: ${dateStr} (${dayName})`);
    }

    render() {
        this.container.innerHTML = '';
        
        const calendar = document.createElement('div');
        calendar.appendChild(this.createWeekNavigation());
        calendar.appendChild(this.createCalendarGrid());
        
        if (this.selectedDate) {
            const selectedDateElement = document.createElement('div');
            selectedDateElement.className = 'selected-date';
            selectedDateElement.textContent = 'Selected date: ' + this.formatDate(this.selectedDate);
            calendar.appendChild(selectedDateElement);
        }
        
        this.container.appendChild(calendar);
        
        // Update selected date visual
        if (this.selectedDate) {
            const days = this.container.querySelectorAll('.calendar-day');
            days.forEach(day => {
                if (day.textContent.includes(this.selectedDate.getDate().toString())) {
                    day.classList.add('selected');
                }
            });
        }
    }

    init() {
        // Set initial date to today
        const today = new Date();
        if (this.isDateSelectable(today)) {
            this.selectDate(today);
        }
        this.render();
    }
}

// Initialize calendar when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WeeklyCalendar('calendar');
});

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
    } catch (error) {
        console.error('Error during initialization:', error);
        showErrorMessage('Error initializing dashboard');
    }
});