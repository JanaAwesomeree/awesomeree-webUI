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
function getDayNameFromDate(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    return date.toLocaleString('en-US', { weekday: 'long' });
}

// Get week bounds (Monday to Saturday)
function getWeekBounds(referenceDate = new Date()) {
    const currentDay = referenceDate.getDay(); // 0 is Sunday, 1 is Monday, etc.
    
    // Calculate the start of the week (Monday)
    const monday = new Date(referenceDate);
    monday.setDate(referenceDate.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
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
let currentWeekStart = null;

// Performance thresholds
const criteria = {
    shop_name:" ",
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

// Display data for the selected date
function displayDateData(selectedDate) {
    if (!selectedDate) return;
    
    try {
        // Ensure we have a date object
        const dateObj = typeof selectedDate === 'string' ? new Date(selectedDate) : selectedDate;
        
        // Get day name
        const dayName = getDayNameFromDate(dateObj);
        
        // Update selected date notification if it exists
        const selectedDateElement = document.getElementById('selectedDate');
        if (selectedDateElement) {
            selectedDateElement.textContent = `Selected date: ${dayName}, ${dateObj.toLocaleDateString()}`;
        }
        
        if (!apiEndpoints[dayName]) {
            const tableBody = document.querySelector('#performanceTable');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="9" class="text-center">No data available for weekends or invalid dates</td></tr>';
            }
            showErrorMessage(`No data available for ${dayName}`);
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

// Create and initialize the weekly calendar
function initializeWeeklyCalendar() {
    const calendarContainer = document.getElementById('calendarContainer');
    if (!calendarContainer) return;
    
    // Clear any existing content
    calendarContainer.innerHTML = '';
    
    // Create calendar elements
    const calendarHeader = document.createElement('div');
    calendarHeader.className = 'calendar-header d-flex justify-content-between align-items-center mb-3';
    
    const weekTitle = document.createElement('h4');
    weekTitle.id = 'weekTitle';
    weekTitle.className = 'mb-0';
    
    const navigationBtns = document.createElement('div');
    navigationBtns.className = 'd-flex gap-2';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-sm btn-outline-secondary';
    prevBtn.innerHTML = '&larr;';
    prevBtn.id = 'prevWeekBtn';
    
    const todayBtn = document.createElement('button');
    todayBtn.className = 'btn btn-sm btn-outline-primary';
    todayBtn.textContent = 'Today';
    todayBtn.id = 'todayBtn';
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-sm btn-outline-secondary';
    nextBtn.innerHTML = '&rarr;';
    nextBtn.id = 'nextWeekBtn';
    
    navigationBtns.appendChild(prevBtn);
    navigationBtns.appendChild(todayBtn);
    navigationBtns.appendChild(nextBtn);
    
    calendarHeader.appendChild(weekTitle);
    calendarHeader.appendChild(navigationBtns);
    
    // Create calendar days grid
    const calendarDays = document.createElement('div');
    calendarDays.className = 'calendar-days d-flex justify-content-between';
    calendarDays.id = 'calendarDays';
    
    // Create selected date indicator
    const selectedDateElement = document.createElement('div');
    selectedDateElement.className = 'selected-date alert alert-info mt-3';
    selectedDateElement.id = 'selectedDate';
    
    // Append everything to container
    calendarContainer.appendChild(calendarHeader);
    calendarContainer.appendChild(calendarDays);
    calendarContainer.appendChild(selectedDateElement);
    
    // Initialize calendar with current week
    updateCalendar(new Date());
    
    // Add event listeners for navigation
    document.getElementById('prevWeekBtn').addEventListener('click', navigateToPrevWeek);
    document.getElementById('nextWeekBtn').addEventListener('click', navigateToNextWeek);
    document.getElementById('todayBtn').addEventListener('click', navigateToCurrentWeek);
}

// Update the calendar UI for a specific week
function updateCalendar(referenceDate) {
    const { monday, saturday } = getWeekBounds(referenceDate);
    currentWeekStart = new Date(monday);
    
    // Update week title
    const weekTitle = document.getElementById('weekTitle');
    if (weekTitle) {
        weekTitle.textContent = `Week of ${monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
    }
    
    // Update calendar days
    const calendarDays = document.getElementById('calendarDays');
    if (calendarDays) {
        calendarDays.innerHTML = '';
        
        // Generate dates for Monday-Saturday
        for (let i = 0; i < 6; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            
            const dayName = date.toLocaleString('en-US', { weekday: 'short' });
            const dayNum = date.getDate();
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day text-center p-2';
            dayElement.setAttribute('data-date', date.toISOString().split('T')[0]);
            
            // Check if this date is today
            const isToday = isSameDay(date, new Date());
            
            // Check if this day has data available
            const dayFullName = getDayNameFromDate(date);
            const hasData = !!apiEndpoints[dayFullName];
            
            if (isToday) {
                dayElement.classList.add('today');
            }
            
            if (!hasData) {
                dayElement.classList.add('disabled');
            } else {
                dayElement.addEventListener('click', function() {
                    // Remove selected class from all days
                    document.querySelectorAll('.calendar-day').forEach(day => {
                        day.classList.remove('selected');
                    });
                    
                    // Add selected class to clicked day
                    this.classList.add('selected');
                    
                    // Display data for the selected date
                    displayDateData(date);
                });
            }
            
            // Create day label
            const dayLabel = document.createElement('div');
            dayLabel.className = 'day-name';
            dayLabel.textContent = dayName;
            
            // Create day number
            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number rounded-circle d-flex align-items-center justify-content-center mx-auto';
            dayNumber.textContent = dayNum;
            
            dayElement.appendChild(dayLabel);
            dayElement.appendChild(dayNumber);
            calendarDays.appendChild(dayElement);
        }
        
        // Select today's date if in current week, otherwise select first available day
        const today = new Date();
        const todayElement = document.querySelector(`.calendar-day[data-date="${today.toISOString().split('T')[0]}"]`);
        
        if (todayElement && !todayElement.classList.contains('disabled')) {
            todayElement.classList.add('selected');
            displayDateData(today);
        } else {
            // Find first enabled day
            const firstEnabledDay = document.querySelector('.calendar-day:not(.disabled)');
            if (firstEnabledDay) {
                firstEnabledDay.classList.add('selected');
                const dateStr = firstEnabledDay.getAttribute('data-date');
                displayDateData(new Date(dateStr));
            }
        }
    }
    
    // Update Today button visibility
    updateTodayButtonVisibility();
}

// Check if two dates are the same day
function isSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() && 
           date1.getMonth() === date2.getMonth() && 
           date1.getFullYear() === date2.getFullYear();
}

// Navigation functions for the calendar
function navigateToPrevWeek() {
    if (!currentWeekStart) return;
    
    const newReference = new Date(currentWeekStart);
    newReference.setDate(newReference.getDate() - 7);
    updateCalendar(newReference);
}

function navigateToNextWeek() {
    if (!currentWeekStart) return;
    
    const newReference = new Date(currentWeekStart);
    newReference.setDate(newReference.getDate() + 7);
    updateCalendar(newReference);
}

function navigateToCurrentWeek() {
    updateCalendar(new Date());
}

// Update visibility of Today button
function updateTodayButtonVisibility() {
    const todayBtn = document.getElementById('todayBtn');
    if (!todayBtn || !currentWeekStart) return;
    
    const today = new Date();
    const { monday, saturday } = getWeekBounds(today);
    
    // Show Today button only if we're not in the current week
    if (currentWeekStart.getTime() === monday.getTime()) {
        todayBtn.style.display = 'none';
    } else {
        todayBtn.style.display = 'block';
    }
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
                <td>${data.shop_name || 'No Shop Name'}</td>
                <td class="${getColorClass(data.non_fulfillment_rate, criteria.non_fulfillment_rate, false)}">${formatValue(data.non_fulfillment_rate, true)}</td>
                <td class="${getColorClass(data.late_shipment_rate, criteria.late_shipment_rate, false)}">${formatValue(data.late_shipment_rate, true)}</td>
                <td class="${getColorClass(data.preparation_time, criteria.preparation_time, false)}">${formatValue(data.preparation_time)}</td>
                <td class="${getColorClass(data.fast_handover_rate, criteria.fast_handover_rate)}">${formatValue(data.fast_handover_rate, true)}</td>
                <td class="${getColorClass(data.response_Rate, criteria.response_rate)}">${formatValue(data.response_rate, true)}</td>
                <td class="${getColorClass(data.avg_response, criteria.average_response_time, false)}">${formatValue(data.average_response_time)}</td>
                <td class="${getColorClass(data.shop_rating, criteria.shop_rating)}">${formatValue(data.shop_rating)}</td>
                <td class="${data.penalty_points > 0 ? 'text-danger' : 'text-success'}">${formatValue(data.penalty_points)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error updating table:', error);
        showErrorMessage('Error updating performance table');
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center">Error loading data</td></tr>';
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

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize the new weekly calendar
        initializeWeeklyCalendar();

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