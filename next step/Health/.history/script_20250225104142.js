// API configuration
const apiEndpoints = {
    Monday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Monday',
    Tuesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Tuesday',
    Wednesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Wednesday',
    Thursday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Thursday',
    Friday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Friday',
    Saturday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Saturday'
};

// Convert to date-based API endpoints
const dateBasedApiEndpoints = {};

// Create date-based endpoints for the next 30 days
function generateDateBasedEndpoints() {
    const today = new Date();
    for (let i = -15; i < 15; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const dayName = getDayNameFromDate(date);
        if (apiEndpoints[dayName]) {
            const dateStr = formatDateForAPI(date);
            dateBasedApiEndpoints[dateStr] = apiEndpoints[dayName];
        }
    }
    console.log('Generated date-based endpoints:', dateBasedApiEndpoints);
}

// Format date for API requests
function formatDateForAPI(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

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

// Usage example: Fetch data for a specific date
async function fetchPerformanceDataForDate(dateStr) {
    // Get the day name from the date
    const date = new Date(dateStr);
    const dayName = getDayNameFromDate(date);
    
    // Use the existing endpoint for that day
    const apiEndpoint = dateBasedApiEndpoints[dateStr] || apiEndpoints[dayName];
    
    if (!apiEndpoint) {
        console.error('No endpoint available for date:', dateStr);
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
        console.log(`Data for ${dateStr}:`, data);
        return data;

    } catch (error) {
        console.error(`Error fetching data for ${dateStr}:`, error);
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

// Main data fetching with API response handling - UPDATED for date-based
async function fetchPerformanceData(dateStr, retryCount = RETRY_COUNT, retryDelay = RETRY_DELAY) {
    const date = new Date(dateStr);
    const dayName = getDayNameFromDate(date);
    
    if (!dateBasedApiEndpoints[dateStr] && !apiEndpoints[dayName]) {
        showErrorMessage(`No data available for ${dateStr} (${dayName})`);
        return;
    }

    const endpoint = dateBasedApiEndpoints[dateStr] || apiEndpoints[dayName];
    let lastError = null;
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
            document.body.classList.add('loading');
            showLoadingMessage(`Fetching data for ${dateStr} (${dayName})... (Attempt ${attempt}/${retryCount})`);
            
            const response = await fetchWithTimeout(endpoint, {
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
            console.log(`Data for ${dateStr}:`, data);

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

            updateAllMetricsFromTableData();
            updateTableData();
            
            showSuccessMessage(`Data for ${dateStr} updated successfully`);
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
    showErrorMessage(`Failed to fetch data for ${dateStr}: ${lastError.message}`);
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
        fast_handover_rate: avg(data, 'fast_handover_rate'),
        penalty: sum(data, 'penalty_points'),
        late_shipment_rate: avg(data, 'late_shipment_rate'),
        preparation_time: avg(data, 'preparation_time'),
        average_response_time: avg(data, 'average_response_time')
    };
}

// Reset data states
function resetData() {
    performanceData = [];
    dateData = {};
    overviewMetrics = {};
    updateAllMetricsFromTableData();
    updateTableData();
    document.body.classList.remove('loading');
}

// Display data for the selected date - UPDATED for date-based
function displayDateData(selectedDate) {
    if (!selectedDate) return;
    
    try {
        // Ensure we have a date object
        const dateObj = typeof selectedDate === 'string' ? new Date(selectedDate) : selectedDate;
        const dateStr = formatDateForAPI(dateObj);
        
        // Get day name
        const dayName = getDayNameFromDate(dateObj);
        
        // Update selected date notification if it exists
        const selectedDateElement = document.getElementById('selectedDate');
        if (selectedDateElement) {
            selectedDateElement.textContent = `Selected date: ${dayName}, ${dateObj.toLocaleDateString()}`;
        }
        
        if (!dateBasedApiEndpoints[dateStr] && !apiEndpoints[dayName]) {
            const tableBody = document.querySelector('#performanceTable');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="9" class="text-center">No data available for weekends or invalid dates</td></tr>';
            }
            showErrorMessage(`No data available for ${dateStr} (${dayName})`);
            return;
        }
        
        fetchPerformanceData(dateStr).catch(error => {
            console.error('Error fetching data:', error);
            showErrorMessage(`Failed to fetch data for ${dateStr}: ${error.message}`);
        });
    } catch (error) {
        console.error('Error displaying date data:', error);
        showErrorMessage('Error processing selected date');
    }
}

// UPDATED: Create and initialize the weekly calendar with more compact layout and date-based approach
function initializeWeeklyCalendar() {
    const calendarContainer = document.getElementById('calendarContainer');
    if (!calendarContainer) return;
    
    // Generate date-based endpoints first
    generateDateBasedEndpoints();
    
    // Clear any existing content
    calendarContainer.innerHTML = '';
    
    // Create calendar elements
    const calendarHeader = document.createElement('div');
    calendarHeader.className = 'calendar-header d-flex justify-content-between align-items-center mb-3';
    
    const weekTitle = document.createElement('h6'); // Smaller title
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
    
    // Create calendar days grid - now in 3x2 layout
    const calendarDays = document.createElement('div');
    calendarDays.className = 'calendar-days';
    calendarDays.id = 'calendarDays';
    
    // Create selected date indicator - make it smaller
    const selectedDateElement = document.createElement('div');
    selectedDateElement.className = 'selected-date alert alert-info mt-2 mb-0 py-2 px-3';
    selectedDateElement.id = 'selectedDate';
    selectedDateElement.style.fontSize = '13px';
    
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

// Update the calendar UI for a specific week - UPDATED for date-based
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
            const dateStr = formatDateForAPI(date);
            
            const dayName = date.toLocaleString('en-US', { weekday: 'short' });
            const dayNum = date.getDate();
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day text-center p-2';
            dayElement.setAttribute('data-date', dateStr);
            
            // Check if this date is today
            const isToday = isSameDay(date, new Date());
            
            // Check if this day has data available
            const dayFullName = getDayNameFromDate(date);
            const hasData = !!dateBasedApiEndpoints[dateStr] || !!apiEndpoints[dayFullName];
            
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
                    displayDateData(dateStr);
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
        const todayStr = formatDateForAPI(today);
        const todayElement = document.querySelector(`.calendar-day[data-date="${todayStr}"]`);
        
        if (todayElement && !todayElement.classList.contains('disabled')) {
            todayElement.classList.add('selected');
            displayDateData(todayStr);
        } else {
            // Find first enabled day
            const firstEnabledDay = document.querySelector('.calendar-day:not(.disabled)');
            if (firstEnabledDay) {
                firstEnabledDay.classList.add('selected');
                const dateStr = firstEnabledDay.getAttribute('data-date');
                displayDateData(dateStr);
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

// ENHANCED: Update ALL metrics from table data
function updateAllMetricsFromTableData() {
    try {
        // Get the table rows from the performance table
        const tableRows = document.querySelectorAll('#performanceTable tr');
        
        // Return early if no data is available
        if (!tableRows.length) {
            console.log('No table data available to update metrics');
            return;
        }
        
        // Initialize aggregation variables for all possible metrics
        let metrics = {
            non_fulfillment_rate: { total: 0, count: 0 },
            late_shipment_rate: { total: 0, count: 0 },
            preparation_time: { total: 0, count: 0 },
            fast_handover_rate: { total: 0, count: 0 },
            response_rate: { total: 0, count: 0 },
            average_response_time: { total: 0, count: 0 },
            shop_rating: { total: 0, count: 0 },
            penalty_points: { total: 0, count: 0 }
        };
        
        // Process each row to extract values
        tableRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            
            // Skip if this is an empty or error message row
            if (cells.length <= 1) {
                return;
            }
            
            // Extract values from cells (adjust indices if your table structure is different)
            const nonFulfillmentRate = parseFloat(cells[1].textContent.replace('%', '')) || 0;
            const lateShipmentRate = parseFloat(cells[2].textContent.replace('%', '')) || 0;
            const preparationTime = parseFloat(cells[3].textContent) || 0;
            const handoverRate = parseFloat(cells[4].textContent.replace('%', '')) || 0;
            const responseRate = parseFloat(cells[5].textContent.replace('%', '')) || 0;
            const responseTime = parseFloat(cells[6].textContent) || 0;
            const shopRating = parseFloat(cells[7].textContent) || 0;
            const penaltyPoints = parseFloat(cells[8].textContent) || 0;
            
            // Accumulate all values
            metrics.non_fulfillment_rate.total += nonFulfillmentRate;
            metrics.non_fulfillment_rate.count++;
            
            metrics.late_shipment_rate.total += lateShipmentRate;
            metrics.late_shipment_rate.count++;
            
            metrics.preparation_time.total += preparationTime;
            metrics.preparation_time.count++;
            
            metrics.fast_handover_rate.total += handoverRate;
            metrics.fast_handover_rate.count++;
            
            metrics.response_rate.total += responseRate;
            metrics.response_rate.count++;
            
            metrics.average_response_time.total += responseTime;
            metrics.average_response_time.count++;
            
            metrics.shop_rating.total += shopRating;
            metrics.shop_rating.count++;
            
            metrics.penalty_points.total += penaltyPoints;
            metrics.penalty_points.count++;
        });
        
        // Calculate averages and update the overviewMetrics object
        overviewMetrics = {
            non_fulfillment_rate: metrics.non_fulfillment_rate.count > 0 ? 
                parseFloat((metrics.non_fulfillment_rate.total / metrics.non_fulfillment_rate.count).toFixed(2)) : 0,
                
            late_shipment_rate: metrics.late_shipment_rate.count > 0 ? 
                parseFloat((metrics.late_shipment_rate.total / metrics.late_shipment_rate.count).toFixed(2)) : 0,
                
            preparation_time: metrics.preparation_time.count > 0 ? 
                parseFloat((metrics.preparation_time.total / metrics.preparation_time.count).toFixed(2)) : 0,
                
            fast_handover_rate: metrics.fast_handover_rate.count > 0 ? 
                parseFloat((metrics.fast_handover_rate.total / metrics.fast_handover_rate.count).toFixed(2)) : 0,
                
            response_rate: metrics.response_rate.count > 0 ? 
                parseFloat((metrics.response_rate.total / metrics.response_rate.count).toFixed(2)) : 0,
                
            average_response_time: metrics.average_response_time.count > 0 ? 
                parseFloat((metrics.average_response_time.total / metrics.average_response_time.count).toFixed(2)) : 0,
                
            shop_rating: metrics.shop_rating.count > 0 ? 
                parseFloat((metrics.shop_rating.total / metrics.shop_rating.count).toFixed(1)) : 0,
                
            penalty: metrics.penalty_points.total
        };
        
        // Update all dashboard cards with the calculated metrics
        updateAllCards();
        
        console.log('All metrics updated from table data:', overviewMetrics);
        
    } catch (error) {
        console.error('Error updating metrics from table:', error);
        showErrorMessage('Error calculating metrics from table data');
    }
}

// NEW FUNCTION: Update all dashboard cards
function updateAllCards() {
    // Update basic overview metrics on all cards
    updateOverviewMetrics();
    
    // Also update all additional metric cards
    updateAdditionalCards();
}

// UPDATED: More comprehensive additional metrics update
function updateAdditionalCards() {
    // List of all possible metric cards and their configurations
    const metricCards = {
        // Response metrics
        'responseRate': { 
            value: overviewMetrics.response_rate, 
            threshold: criteria.response_rate, 
            isHigherBetter: true, 
            isPercent: true 
        },
        'responseTime': { 
            value: overviewMetrics.average_response_time, 
            threshold: criteria.average_response_time, 
            isHigherBetter: false, 
            isPercent: false
        },
        
        // Shipping metrics
        'handoverRate': { 
            value: overviewMetrics.fast_handover_rate, 
            threshold: criteria.fast_handover_rate, 
            isHigherBetter: true, 
            isPercent: true 
        },
        'preparationTime': { 
            value: overviewMetrics.preparation_time, 
            threshold: criteria.preparation_time, 
            isHigherBetter: false, 
            isPercent: false 
        },
        'lateShipmentRate': { 
            value: overviewMetrics.late_shipment_rate, 
            threshold: criteria.late_shipment_rate, 
            isHigherBetter: false, 
            isPercent: true 
        }
    };
    
    // Update each card if it exists in the DOM
    Object.entries(metricCards).forEach(([id, config]) => {
        const element = document.getElementById(id);
        if (element) {
            // Get appropriate color class
            const colorClass = getColorClass(config.value, config.threshold, config.isHigherBetter);
            
            // Format value appropriately
            element.textContent = formatValue(config.value, config.isPercent);
            
            // Update classes - keep existing classes that don't start with 'text-'
            const classes = Array.from(element.classList).filter(cls => !cls.startsWith('text-'));
            element.className = [...classes, colorClass].join(' ');
        }
    });
}

// UPDATED: Overview metrics function that handles all cards
function updateOverviewMetrics() {
    try {
        // Define metrics with their proper ids and comparison logic
        const metrics = {
            'nonFulfillRate': { 
                value: overviewMetrics.non_fulfillment_rate, 
                threshold: criteria.non_fulfillment_rate, 
                isHigherBetter: false, 
                isPercent: true 
            },
            'shopRating': { 
                value: overviewMetrics.shop_rating, 
                threshold: criteria.shop_rating, 
                isHigherBetter: true, 
                isPercent: false 
            },
            'penaltyPoints': { 
                value: overviewMetrics.penalty || 0, 
                threshold: criteria.penalty_points, 
                isHigherBetter: false, 
                isPercent: false 
            }
        };

        // Update each metric element
        Object.entries(metrics).forEach(([id, config]) => {
            const element = document.getElementById(id);
            if (element) {
                // Update with the proper color class
                const colorClass = getColorClass(config.value, config.threshold, config.isHigherBetter);
                
                // Find the text inside the span (not the icon)
                const textNode = Array.from(element.childNodes).find(node => node.nodeType === 3);
                if (textNode) {
                    textNode.nodeValue = `${formatValue(config.value, config.isPercent)} `;
                } else {
                    // If no text node, update the whole content
                    element.innerHTML = `${formatValue(config.value, config.isPercent)} ${element.innerHTML.includes('bi-arrow') ? element.innerHTML.substr(element.innerHTML.indexOf('<i')) : ''}`;
                }
                
                // Update classes - keep bi classes and add new color class
                const classes = Array.from(element.classList).filter(cls => !cls.startsWith('text-'));
                element.className = [...classes, colorClass].join(' ');
            }
        });
    } catch (error) {
        console.error('Error updating metrics:', error);
        showErrorMessage('Error updating overview metrics');
    }
}

// UPDATED: Table data function with improved coloring
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
                <td class="${getColorClass(data.fast_handover_rate, criteria.fast_handover_rate, true)}">${formatValue(data.fast_handover_rate, true)}</td>
                <td class="${getColorClass(data.response_rate, criteria.response_rate, true)}">${formatValue(data.response_rate, true)}</td>
                <td class="${getColorClass(data.average_response_time, criteria.average_response_time, false)}">${formatValue(data.average_response_time)}</td>
                <td class="${getColorClass(data.shop_rating, criteria.shop_rating, true)}">${formatValue(data.shop_rating)}</td>
                <td class="${data.penalty_points > 0 ? 'text-danger' : 'text-success'}">${formatValue(data.penalty_points)}</td>
            </tr>
        `