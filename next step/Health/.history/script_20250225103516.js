// API configuration
const apiEndpoints = {
    Monday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Monday',
    Tuesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Tuesday',
    Wednesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Wednesday',
    Thursday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Thursday',
    Friday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Friday',
    Saturday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Saturday'
};

// UPDATED: Date handling functions to work with actual dates not just day names
function getDayNameFromDate(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    return date.toLocaleString('en-US', { weekday: 'long' });
}

function formatDateForAPI(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
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

// UPDATED: Fetch by date instead of day name
async function fetchPerformanceDataForDate(date) {
    const dayName = getDayNameFromDate(date);
    const formattedDate = formatDateForAPI(date);
    
    // Get the appropriate endpoint
    const apiEndpoint = apiEndpoints[dayName];
    
    if (!apiEndpoint) {
        console.error('Invalid date provided, no data available for this day');
        return null;
    }
    
    try {
        // Add date parameter to the API URL
        const finalEndpoint = `${apiEndpoint}&date=${formattedDate}`;
        
        const response = await fetch(finalEndpoint, {
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
        console.log(`Data for ${formattedDate} (${dayName}):`, data);
        return data;

    } catch (error) {
        console.error(`Error fetching data for ${formattedDate}:`, error);
        return null;
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
let selectedDate = new Date();

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

// UPDATED: Main data fetching with API response handling - now uses date
async function fetchPerformanceData(date = new Date(), retryCount = RETRY_COUNT, retryDelay = RETRY_DELAY) {
    // Make sure we have a date object
    if (typeof date === 'string') {
        date = new Date(date);
    }
    
    const dayName = getDayNameFromDate(date);
    const formattedDate = formatDateForAPI(date);
    
    if (!apiEndpoints[dayName]) {
        showErrorMessage(`No data available for ${dayName}`);
        return;
    }

    let lastError = null;
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
            document.body.classList.add('loading');
            showLoadingMessage(`Fetching data for ${formattedDate} (${dayName})... (Attempt ${attempt}/${retryCount})`);
            
            // Create the final URL with date parameter
            const apiUrl = `${apiEndpoints[dayName]}&date=${formattedDate}`;
            
            const response = await fetchWithTimeout(apiUrl, {
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
            console.log(`Data for ${formattedDate}:`, data);

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

            // Save the selected date for reference
            selectedDate = date;
            
            // Update all cards and tables
            updateAllDashboardElements();
            
            showSuccessMessage(`Data for ${formattedDate} updated successfully`);
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
    showErrorMessage(`Failed to fetch data for ${formattedDate}: ${lastError.message}`);
    resetData();
}

// NEW: Central function to update all dashboard elements
function updateAllDashboardElements() {
    // Update all cards and metrics
    updateOverviewMetrics();
    updateAdditionalMetrics();
    updateTableData();
    updateAllCards();
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
        penalty: sum(data, 'penalty_points'),
        late_shipment_rate: avg(data, 'late_shipment_rate'),
        preparation_time: avg(data, 'preparation_time'),
        fast_handover_rate: avg(data, 'fast_handover_rate'),
        average_response_time: avg(data, 'average_response_time'),
        low_rated_orders: sum(data, 'lowRatedOrders') || 0
    };
}

// Reset data states
function resetData() {
    performanceData = [];
    dateData = {};
    overviewMetrics = {};
    updateAllDashboardElements();
    document.body.classList.remove('loading');
}

// UPDATED: Display data for the selected date
function displayDateData(selectedDate) {
    if (!selectedDate) return;
    
    try {
        // Ensure we have a date object
        const dateObj = typeof selectedDate === 'string' ? new Date(selectedDate) : selectedDate;
        
        // Get day name and formatted date
        const dayName = getDayNameFromDate(dateObj);
        const formattedDate = dateObj.toLocaleDateString();
        
        // Update selected date notification if it exists
        const selectedDateElement = document.getElementById('selectedDate');
        if (selectedDateElement) {
            selectedDateElement.textContent = `Selected date: ${dayName}, ${formattedDate}`;
        }
        
        if (!apiEndpoints[dayName]) {
            const tableBody = document.querySelector('#performanceTable');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="9" class="text-center">No data available for weekends or invalid dates</td></tr>';
            }
            showErrorMessage(`No data available for ${formattedDate} (${dayName})`);
            return;
        }
        
        // Fetch data using the actual date
        fetchPerformanceData(dateObj).catch(error => {
            console.error('Error fetching data:', error);
            showErrorMessage(`Failed to fetch data for ${formattedDate}: ${error.message}`);
        });
    } catch (error) {
        console.error('Error displaying date data:', error);
        showErrorMessage('Error processing selected date');
    }
}

// UPDATED: Create and initialize the weekly calendar with more compact layout
function initializeWeeklyCalendar() {
    const calendarContainer = document.getElementById('calendarContainer');
    if (!calendarContainer) return;
    
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
            const fullDate = date.toLocaleDateString();
            
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
            
            // Date tooltip
            dayElement.title = fullDate;
            
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

// NEW: Enhanced metrics calculation from table data - handles more metrics
function updateOverviewMetricsFromTable() {
    try {
        // Get the table rows from the performance table
        const tableRows = document.querySelectorAll('#performanceTable tr');
        
        // Return early if no data is available
        if (!tableRows.length) {
            console.log('No table data available to update metrics');
            return;
        }
        
        // Initialize aggregation variables for all metrics
        let totals = {
            nonFulfillmentRate: 0,
            lateShipmentRate: 0,
            preparationTime: 0,
            fastHandoverRate: 0,
            responseRate: 0,
            averageResponseTime: 0,
            shopRating: 0,
            penaltyPoints: 0,
            lowRatedOrders: 0
        };
        
        let rowCount = 0;
        
        // Process each row to extract values
        tableRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            
            // Skip if this is an empty or error message row
            if (cells.length <= 1) {
                return;
            }
            
            try {
                // Extract values from cells (adjusting indexes based on table structure)
                const nonFulfillmentRate = parseFloat(cells[1].textContent.replace('%', '')) || 0;
                const lateShipmentRate = parseFloat(cells[2].textContent.replace('%', '')) || 0;
                const preparationTime = parseFloat(cells[3].textContent) || 0;
                const fastHandoverRate = parseFloat(cells[4].textContent.replace('%', '')) || 0;
                const responseRate = parseFloat(cells[5].textContent.replace('%', '')) || 0;
                const avgResponseTime = parseFloat(cells[6].textContent) || 0;
                const shopRating = parseFloat(cells[7].textContent) || 0;
                const penaltyPoints = parseFloat(cells[8].textContent) || 0;
                
                // Accumulate values
                totals.nonFulfillmentRate += nonFulfillmentRate;
                totals.lateShipmentRate += lateShipmentRate;
                totals.preparationTime += preparationTime;
                totals.fastHandoverRate += fastHandoverRate;
                totals.responseRate += responseRate;
                totals.averageResponseTime += avgResponseTime;
                totals.shopRating += shopRating;
                totals.penaltyPoints += penaltyPoints;
                
                // Count valid rows
                rowCount++;
            } catch (error) {
                console.warn('Error parsing row data:', error);
            }
        });
        
        // Calculate averages if we have rows
        if (rowCount > 0) {
            // Update the overviewMetrics object with all metrics
            overviewMetrics = {
                non_fulfillment_rate: parseFloat((totals.nonFulfillmentRate / rowCount).toFixed(2)),
                late_shipment_rate: parseFloat((totals.lateShipmentRate / rowCount).toFixed(2)),
                preparation_time: parseFloat((totals.preparationTime / rowCount).toFixed(2)),
                fast_handover_rate: parseFloat((totals.fastHandoverRate / rowCount).toFixed(2)),
                response_rate: parseFloat((totals.responseRate / rowCount).toFixed(2)),
                average_response_time: parseFloat((totals.averageResponseTime / rowCount).toFixed(2)),
                shop_rating: parseFloat((totals.shopRating / rowCount).toFixed(1)),
                penalty: totals.penaltyPoints,
                low_rated_orders: totals.lowRatedOrders
            };
            
            console.log('Overview metrics updated from table data:', overviewMetrics);
        }
        
    } catch (error) {
        console.error('Error updating metrics from table:', error);
        showErrorMessage('Error calculating overview metrics from table data');
    }
}

// NEW: Update all metric cards
function updateAllCards() {
    try {
        // List of all metrics to update with their IDs and configurations
        const allMetrics = {
            'nonFulfillRate': { value: overviewMetrics.non_fulfillment_rate, threshold: criteria.non_fulfillment_rate, isHigherBetter: false, isPercent: true },
            'lateShipmentRate': { value: overviewMetrics.late_shipment_rate, threshold: criteria.late_shipment_rate, isHigherBetter: false, isPercent: true },
            'prepTime': { value: overviewMetrics.preparation_time, threshold: criteria.preparation_time, isHigherBetter: false, isPercent: false },
            'handoverRate': { value: overviewMetrics.fast_handover_rate, threshold: criteria.fast_handover_rate, isHigherBetter: true, isPercent: true },
            'responseRate': { value: overviewMetrics.response_rate, threshold: criteria.response_rate, isHigherBetter: true, isPercent: true },
            'avgResponseTime': { value: overviewMetrics.average_response_time, threshold: criteria.average_response_time, isHigherBetter: false, isPercent: false },
            'shopRating': { value: overviewMetrics.shop_rating, threshold: criteria.shop_rating, isHigherBetter: true, isPercent: false },
            'penaltyPoints': { value: overviewMetrics.penalty, threshold: criteria.penalty_points, isHigherBetter: false, isPercent: false },
            'lowRatedOrders': { value: overviewMetrics.low_rated_orders, threshold: criteria.lowRatedOrders, isHigherBetter: false, isPercent: false }
        };

        // Update each metric card if it exists in the DOM
        Object.entries(allMetrics).forEach(([id, config]) => {
            // Try to find the element
            const element = document.getElementById(id);
            if (element) {
                updateMetricCard(element, config.value, config.threshold, config.isHigherBetter, config.isPercent);
            }
        });
        
        console.log('All metric cards updated');
        
    } catch (error) {
        console.error('Error updating all cards:', error);
        showErrorMessage('Error updating metric cards');
    }
}

// Helper function to update a single metric card
function updateMetricCard(element, value, threshold, isHigherBetter, isPercent) {
    // Only update if element exists
    if (!element) return;
    
    // Get the appropriate color class based on the metric
    const colorClass = getColorClass(value, threshold, isHigherBetter);
    
    // Get the text inside the span (not the icon) or create it
    let textNode = Array.from(element.childNodes).find(node => node.nodeType === 3);
    let iconHTML = '';
    
    // If there's an icon, preserve it
    const iconElement = element.querySelector('i');
    if (iconElement) {
        iconHTML = iconElement.outerHTML;
    }
    
    // Format the value appropriately
    const formattedValue = formatValue(value, isPercent);
    
    // Update the element
    if (textNode) {
        textNode.nodeValue = `${formattedValue} `;
    } else {
        // If no text node, update the whole content
        if (iconHTML) {
            // Preserve the icon
            element.innerHTML = `${formattedValue} ${iconHTML}`;
        } else {
            element.textContent = formattedValue;
        }
    }
    
    // Update the color class - keep non-color classes
    const classes = Array.from(element.classList).filter(cls => !cls.startsWith('text-'));
    element.className = [...classes, colorClass].join(' ');
}

// Specialized function for additional metrics that might have different structures
function updateAdditionalMetrics() {
    try {
        // List of additional metric elements that might have special handling
        const additionalMetrics = [
            { id: 'responseRate', value: overviewMetrics.response_rate, threshold: criteria.response_rate, isHigherBetter: true, isPercent: true },
            { id: 'handoverRate', value: overviewMetrics.fast_handover_rate, threshold: criteria.fast_handover_rate, isHigherBetter: true, isPercent: true },
            { id: 'onTimeRate', value: overviewMetrics.onTimeRate, threshold: criteria.onTimeRate, isHigherBetter: true, isPercent: true }
        ];
        
        // Update each additional metric
        additionalMetrics.forEach(metric => {
            const element = document.getElementById(metric.id);
            if (element) {
                updateMetricCard(element, metric.value, metric.threshold, metric.isHigherBetter, metric.isPercent);
            }
        });
        
        // Handle any progress bars or special visualizations
        updateProgressBars();
        
    } catch (error) {
        console.error('Error updating additional metrics:', error);
    }
}

// Update any progress bars in the dashboard
function updateProgressBars() {
    try {
        // Find all progress bars that might need updating
        const progressBars = document.querySelectorAll('.progress-bar[data-metric]');
        
        progressBars.forEach(bar => {
            const metricName = bar.getAttribute('data-metric');
            
            if (metricName && overviewMetrics[metricName] !== undefined) {
                const value = overviewMetrics[metricName];
                const threshold = criteria[metricName] || 0;
                const isHigherBetter = bar.getAttribute('data-higher-better') === 'true';
                
                // Set the width of the progress bar
                bar.style.width = `${value}%`;
                
                // Set the appropriate color class
                const colorClass = getColorClass(value, threshold, isHigherBetter);
                bar.className = bar.className.replace(/bg-\w+/, '') + ` bg-${colorClass.replace('text-', '')}`;
                
                // Update the text if needed
                const valueDisplay = bar.querySelector('.progress-value');
                if (valueDisplay) {
                    valueDisplay.textContent = formatValue(value, true);
                }
            }
        });
        
    } catch (error) {
        console.error('Error updating progress bars:', error);
    }
}

// UPDATED: Overview metrics function to handle all card types
function updateOverviewMetrics() {
    try {
        // First update the metrics from table data
        updateOverviewMetricsFromTable();
        
        // Define metrics with their proper ids and comparison logic
        const metrics = {
            'nonFulfillRate': { value: overviewMetrics.non_fulfillment_rate, threshold: criteria.non_fulfillment_rate, isHigherBetter: false, isPercent: true },
            'shopRating': { value: overviewMetrics.shop_rating, threshold: criteria.shop_rating, isHigherBetter: true, isPercent: false },
            'penaltyPoints': { value: overviewMetrics.penalty || 0, threshold: criteria.penalty_points, isHigherBetter: false, isPercent: false }
        };

        // Update each metric element
        Object.entries(metrics).forEach(([id, config]) => {
            const element = document.getElementById(id);
            if (element) {
                updateMetricCard(element, config.value, config.threshold, config.isHigherBetter, config.isPercent);
            }
        });
    } catch (error)