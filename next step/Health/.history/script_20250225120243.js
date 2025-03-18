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
// Get week bounds (Monday to Saturday) for the given reference date
function getWeekBounds(referenceDate = new Date()) {
    const currentDay = referenceDate.getDay(); // 0 is Sunday, 1 is Monday, etc.

    // Calculate the start of the current week (Monday)
    const monday = new Date(referenceDate);
    monday.setDate(referenceDate.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    monday.setHours(0, 0, 0, 0);

    // Calculate the end of the current week (Saturday)
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    saturday.setHours(23, 59, 59, 999);

    // Calculate the start of the previous week (Monday)
    const previousMonday = new Date(monday);
    previousMonday.setDate(monday.getDate() - 7);

    return { monday: previousMonday, saturday };
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
        handleNoDataAvailable(`No data available for ${day}`);
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
            if (Array.isArray(data) && data.length > 0) {
                // Ensure zero values are preserved (not converted to null/undefined)
                performanceData = data.map(item => {
                    const processed = {};
                    for (const key in item) {
                        // Keep zero values as 0, not null or undefined
                        processed[key] = item[key] === 0 ? 0 : (item[key] || item[key] === 0 ? item[key] : null);
                    }
                    return processed;
                });
                overviewMetrics = calculateOverviewMetrics(performanceData);
            } else if (Array.isArray(data) && data.length === 0) {
                // Handle empty array response
                handleNoDataAvailable(`No data found for ${day}`);
                document.body.classList.remove('loading');
                return;
            } else if (typeof data === 'object' && data !== null) {
                if (data.performanceData) {
                    // Ensure zero values are preserved
                    performanceData = data.performanceData.map(item => {
                        const processed = {};
                        for (const key in item) {
                            // Keep zero values as 0, not null or undefined
                            processed[key] = item[key] === 0 ? 0 : (item[key] || item[key] === 0 ? item[key] : null);
                        }
                        return processed;
                    });
                } else {
                    performanceData = [];
                }
                
                if (performanceData.length === 0) {
                    handleNoDataAvailable(`No data found for ${day}`);
                    document.body.classList.remove('loading');
                    return;
                }
                dateData = data.dateData || {};
                overviewMetrics = data.overviewMetrics || calculateOverviewMetrics(performanceData);
            } else {
                throw new Error('Invalid data format received from API');
            }

            updateAllMetricCards();
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
    handleNoDataAvailable(`Failed to load data for ${day}`);
}
// NEW: Function to handle no data available scenario
function handleNoDataAvailable(message) {
    // Reset table with message
    const tableBody = document.getElementById('performanceTable');
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center">${message}</td></tr>`;
    }
    
    // Reset all metric cards with N/A values
    resetAllMetricCards();
    
    // Remove loading state
    document.body.classList.remove('loading');
}

// NEW: Reset all metric cards to N/A
function resetAllMetricCards() {
    // Reset overview metrics
    overviewMetrics = {};
    
    // Reset main overview cards
    const mainMetrics = ['nonFulfillRate', 'shopRating', 'penaltyPoints'];
    mainMetrics.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            // Find the text inside the span (not the icon)
            const textNode = Array.from(element.childNodes).find(node => node.nodeType === 3);
            if (textNode) {
                textNode.nodeValue = 'N/A ';
            } else {
                // If no text node, update the whole content
                element.innerHTML = `N/A ${element.innerHTML.includes('bi-arrow') ? element.innerHTML.substr(element.innerHTML.indexOf('<i')) : ''}`;
            }
            
            // Reset class to neutral
            const classes = Array.from(element.classList).filter(cls => !cls.startsWith('text-'));
            element.className = [...classes, 'text-muted'].join(' ');
        }
    });
    
    // Reset additional metrics
    const additionalMetrics = ['responseRate', 'handoverRate', 'avgResponseTime', 'onTimeRate', 'lowRatedOrders'];
    additionalMetrics.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = 'N/A';
            
            // Reset class to neutral
            const classes = Array.from(element.classList).filter(cls => !cls.startsWith('text-'));
            element.className = [...classes, 'text-muted'].join(' ');
        }
    });
    
    // Also reset any progress bars or charts if they exist
    resetProgressBars();
}

// NEW: Reset any progress bars to 0
function resetProgressBars() {
    document.querySelectorAll('.progress-bar').forEach(bar => {
        bar.style.width = '0%';
        bar.textContent = 'N/A';
    });
}

// Calculate overview metrics from performance data
function calculateOverviewMetrics(data) {
    if (!Array.isArray(data) || data.length === 0) return {};
    
    // Fixed sum function to properly handle zero values
    const sum = (arr, key) => arr.reduce((acc, curr) => {
        const value = curr[key];
        // Only use default of 0 if value is undefined or null, not if it's actually 0
        const parsedValue = value !== undefined && value !== null ? parseFloat(value) : 0;
        return acc + (isNaN(parsedValue) ? 0 : parsedValue);
    }, 0);
    
    const avg = (arr, key) => sum(arr, key) / arr.length;
    
    return {
        non_fulfillment_rate: avg(data, 'non_fulfillment_rate'),
        late_shipment_rate: avg(data, 'late_shipment_rate'),
        preparation_time: avg(data, 'preparation_time'),
        fast_handover_rate: avg(data, 'fast_handover_rate'),
        shop_rating: avg(data, 'shop_rating'),
        response_rate: avg(data, 'response_rate'),
        average_response_time: avg(data, 'average_response_time'),
        onTimeRate: avg(data, 'on_Time_Rate'),
        lowRatedOrders: sum(data, 'low_Rated_Orders'),
        penalty: sum(data, 'penalty_points')
    };
}

// Reset data states
function resetData() {
    performanceData = [];
    dateData = {};
    overviewMetrics = {};
    resetAllMetricCards();
    updateTableData();
    document.body.classList.remove('loading');
}

// Display data for the selected date
function displayDateData(selectedDate) {
    if (!selectedDate) return;

    try {
        const dayName = getDayNameFromDate(selectedDate);
        const selectedDateElement = document.getElementById('selectedDate');
        if (selectedDateElement) {
            selectedDateElement.textContent = `Selected date: ${dayName}, ${selectedDate.toLocaleDateString()}`;
        }

        // Calculate the start of the previous week (Monday-Saturday)
        const { monday, saturday } = getWeekBounds(new Date());
        
        // Subtract 7 days to get the previous week
        const previousWeekStart = new Date(monday);
        previousWeekStart.setDate(previousWeekStart.getDate() - 7);
        
        // Fetch data for the previous week's corresponding day (e.g., last Monday, last Tuesday, etc.)
        const previousWeekDay = new Date(selectedDate);
        previousWeekDay.setDate(previousWeekStart.getDate() + (selectedDate.getDay() - monday.getDay()));
        
        const previousWeekDayName = getDayNameFromDate(previousWeekDay);
        
        fetchPerformanceData(previousWeekDayName).catch(error => {
            console.error('Error fetching data:', error);
            showErrorMessage(`Failed to fetch data for ${previousWeekDayName}: ${error.message}`);
            handleNoDataAvailableForSelectedDate();
        });

    } catch (error) {
        console.error('Error displaying date data:', error);
        showErrorMessage('Error processing selected date');
        handleNoDataAvailableForSelectedDate();
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
    
    // Add event listeners for navigating to previous week, next week, and today
document.getElementById('prevWeekBtn').addEventListener('click', function () {
    // Move to the previous week's same day (subtract 7 days from the current selected date)
    const selectedDateElement = document.querySelector('.calendar-day.selected');
    if (selectedDateElement) {
        const selectedDate = new Date(selectedDateElement.getAttribute('data-date'));
        selectedDate.setDate(selectedDate.getDate() - 7);  // Subtract 7 days to get the same day of the previous week
        displayDateData(selectedDate);
        updateCalendar(selectedDate);  // Update the calendar with the previous week's dates
    }
});

document.getElementById('nextWeekBtn').addEventListener('click', function () {
    // Move to the next week's same day (add 7 days to the current selected date)
    const selectedDateElement = document.querySelector('.calendar-day.selected');
    if (selectedDateElement) {
        const selectedDate = new Date(selectedDateElement.getAttribute('data-date'));
        selectedDate.setDate(selectedDate.getDate() + 7);  // Add 7 days to get the same day of the next week
        displayDateData(selectedDate);
        updateCalendar(selectedDate);  // Update the calendar with the next week's dates
    }
});

document.getElementById('todayBtn').addEventListener('click', function () {
    // Move to today's date, then fetch data for last week's same day
    const today = new Date();
    const todayElement = document.querySelector(`.calendar-day[data-date="${today.toISOString().split('T')[0]}"]`);

    if (todayElement) {
        todayElement.classList.add('selected');
        const selectedDate = new Date(today);
        selectedDate.setDate(selectedDate.getDate() - 7); // Subtract 7 days for the previous week's date
        displayDateData(selectedDate);
        updateCalendar(today); // Update the calendar with this week's dates
    }
});

}

function updateCalendar(referenceDate) {
    const { monday, saturday } = getWeekBounds(referenceDate);
    currentWeekStart = new Date(monday);

    // Update the week title
    const weekTitle = document.getElementById('weekTitle');
    if (weekTitle) {
        weekTitle.textContent = `Week of ${monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
    }

    // Update the calendar days
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

            // Disable all days except the selected one
            if (dayFullName !== getDayNameFromDate(new Date())) {
                dayElement.classList.add('disabled');
            } else {
                dayElement.addEventListener('click', function () {
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

            const dayLabel = document.createElement('div');
            dayLabel.className = 'day-name';
            dayLabel.textContent = dayName;

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
}

    
    // Update Today button visibility
    updateTodayButtonVisibility();


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

// UPDATED: Function to update all metric cards from table data
function updateAllMetricCards() {
    try {
        // Update main metrics
        updateOverviewMetrics();
        
        // Update additional metrics cards
        updateAdditionalMetrics();
        
        // Update any progress bars
        updateProgressBars();
        
        console.log('All metric cards updated:', overviewMetrics);
        
    } catch (error) {
        console.error('Error updating metric cards:', error);
        showErrorMessage('Error updating dashboard metrics');
    }
}

// NEW: Update progress bars based on metrics
function updateProgressBars() {
    // Update response rate progress bar
    updateProgressBar('responseRateProgress', overviewMetrics.response_rate, criteria.response_rate, true);
    
    // Update handover rate progress bar
    updateProgressBar('handoverRateProgress', overviewMetrics.fast_handover_rate, criteria.fast_handover_rate, true);
    
    // Update on-time delivery rate progress bar
    updateProgressBar('onTimeRateProgress', overviewMetrics.onTimeRate, criteria.onTimeRate, true);
}

// NEW: Helper function to update a progress bar
function updateProgressBar(id, value, threshold, isHigherBetter) {
    const progressBar = document.getElementById(id);
    if (!progressBar) return;
    
    // Ensure value is a number
    const numValue = parseFloat(value) || 0;
    
    // Update progress percentage (max 100%)
    progressBar.style.width = `${Math.min(numValue, 100)}%`;
    
    // Update text
    progressBar.textContent = `${numValue.toFixed(1)}%`;
    
    // Update color based on threshold
    if (isHigherBetter) {
        progressBar.className = `progress-bar ${numValue >= threshold ? 'bg-success' : 'bg-danger'}`;
    } else {
        progressBar.className = `progress-bar ${numValue <= threshold ? 'bg-success' : 'bg-danger'}`;
    }
}

// UPDATED: Additional metrics update function
function updateAdditionalMetrics() {
    try {
        // Define all additional metrics to update
        const additionalMetrics = {
            'responseRate': { value: overviewMetrics.response_rate, threshold: criteria.response_rate, isHigherBetter: true, isPercent: true },
            'handoverRate': { value: overviewMetrics.fast_handover_rate, threshold: criteria.fast_handover_rate, isHigherBetter: true, isPercent: true },
            'avgResponseTime': { value: overviewMetrics.average_response_time, threshold: criteria.average_response_time, isHigherBetter: false, isPercent: false },
            'onTimeRate': { value: overviewMetrics.onTimeRate, threshold: criteria.onTimeRate, isHigherBetter: true, isPercent: true },
            'lowRatedOrders': { value: overviewMetrics.lowRatedOrders, threshold: criteria.lowRatedOrders, isHigherBetter: false, isPercent: false }
        };
        
        // Update each metric element
        Object.entries(additionalMetrics).forEach(([id, config]) => {
            const element = document.getElementById(id);
            if (element) {
                // Set the value with proper formatting
                element.textContent = formatValue(config.value, config.isPercent);
                
                // Update with the proper color class
                const colorClass = getColorClass(config.value, config.threshold, config.isHigherBetter);
                
                // Update classes - keep existing non-color classes
                const classes = Array.from(element.classList).filter(cls => !cls.startsWith('text-'));
                element.className = [...classes, colorClass].join(' ');
            }
        });
    } catch (error) {
        console.error('Error updating additional metrics:', error);
    }
}

// UPDATED: Overview metrics function
function updateOverviewMetrics() {
    try {
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

// UPDATED: Table data function that properly handles empty data
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
        `).join('');
        
    } catch (error) {
        console.error('Error updating table:', error);
        showErrorMessage('Error updating performance table');
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center">Error loading data</td></tr>';
    }
}

// Navigation functions
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



// UPDATED: More reliable value formatting
function formatValue(value, isPercentage = false) {
    if (value === undefined || value === null) return 'N/A';  // Only handle undefined or null values
    if (value === 0) return '0';  // Ensure that 0 is displayed as '0'
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'N/A';  // Return 'N/A' if the value is not a valid number
    
    return isPercentage ? `${numValue.toFixed(1)}%` : (Number.isInteger(numValue) ? numValue.toString() : numValue.toFixed(1));
}


// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize the new weekly calendar
        initializeWeeklyCalendar();

        // Auto-refresh setup
        setInterval(() => {
            const currentDay = new Date().toLocaleString('en-US', { weekday: 'long' });

            // Check if there is an endpoint for today's day
            if (apiEndpoints[currentDay]) {
                // Fetch the performance data for the current day
                fetchPerformanceData(currentDay).catch(error => {
                    console.error(`Error fetching performance data for ${currentDay}:`, error);
                    showErrorMessage(`Error fetching performance data for ${currentDay}`);
                });
            } else {
                console.warn(`No API endpoint for ${currentDay}.`);
            }
        }, AUTO_REFRESH_INTERVAL);  // Set the refresh interval (300000 ms = 5 minutes)
    } catch (error) {
        console.error('Error during initialization:', error);
        showErrorMessage('Error initializing the dashboard');
    }
});

                    // Continuation of your code after the previous logic...

// UPDATED: Function to handle no data found for a selected date
function handleNoDataAvailableForSelectedDate() {
    // Show "No data found" message on all metric cards and reset the values
    resetAllMetricCards();
    showErrorMessage('No data found for this date');

    // Reset table data
    updateTableData();
    
    // Display the message in the performance table
    const tableBody = document.getElementById('performanceTable');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center">No data found for this date</td></tr>';
    }
    
    // Display "No data found" message
    const selectedDateElement = document.getElementById('selectedDate');
    if (selectedDateElement) {
        selectedDateElement.textContent = 'No data found for selected date.';
    }
}

// Function to update all metric cards (including account health cards) with the data
function updateAllMetricCards() {
    try {
        // Update all the cards across the dashboard with performance data
        updateOverviewMetrics();
        updateAdditionalMetrics();
        
        // If there's no data, reset the metrics
        if (performanceData.length === 0) {
            handleNoDataAvailableForSelectedDate();
        } else {
            // Update progress bars with corresponding metrics
            updateProgressBars();
        }
        
        console.log('All metric cards updated with current data:', overviewMetrics);
    } catch (error) {
        console.error('Error updating metric cards:', error);
        showErrorMessage('Error updating dashboard metrics');
    }
}

// Function to update overview metrics (with success or danger colors)
function updateOverviewMetrics() {
    try {
        const metrics = {
            'nonFulfillRate': { value: overviewMetrics.non_fulfillment_rate, threshold: criteria.non_fulfillment_rate, isHigherBetter: false, isPercent: true },
            'shopRating': { value: overviewMetrics.shop_rating, threshold: criteria.shop_rating, isHigherBetter: true, isPercent: false },
            'penaltyPoints': { value: overviewMetrics.penalty || 0, threshold: criteria.penalty_points, isHigherBetter: false, isPercent: false }
        };

        // Loop through each of the overview metrics and update
        Object.entries(metrics).forEach(([id, config]) => {
            const element = document.getElementById(id);
            if (element) {
                const value = config.value;
                const formattedValue = formatValue(value, config.isPercent);
                
                // Find the text inside the span (not the icon)
                const textNode = Array.from(element.childNodes).find(node => node.nodeType === 3);
                if (textNode) {
                    textNode.nodeValue = `${formattedValue}`;
                } else {
                    element.innerHTML = `${formattedValue} ${element.innerHTML.includes('bi-arrow') ? element.innerHTML.substr(element.innerHTML.indexOf('<i')) : ''}`;
                }

                // Update classes (success or danger based on thresholds)
                const colorClass = getColorClass(value, config.threshold, config.isHigherBetter);
                element.className = [...Array.from(element.classList).filter(cls => !cls.startsWith('text-')), colorClass].join(' ');
            }
        });
    } catch (error) {
        console.error('Error updating overview metrics:', error);
        showErrorMessage('Error updating overview metrics');
    }
}

// Function to update additional metrics (like response rate, handover rate, etc.)
function updateAdditionalMetrics() {
    try {
        const additionalMetrics = {
            'responseRate': { value: overviewMetrics.response_rate, threshold: criteria.response_rate, isHigherBetter: true, isPercent: true },
            'handoverRate': { value: overviewMetrics.fast_handover_rate, threshold: criteria.fast_handover_rate, isHigherBetter: true, isPercent: true },
            'avgResponseTime': { value: overviewMetrics.average_response_time, threshold: criteria.average_response_time, isHigherBetter: false, isPercent: false },
            'onTimeRate': { value: overviewMetrics.onTimeRate, threshold: criteria.onTimeRate, isHigherBetter: true, isPercent: true },
            'lowRatedOrders': { value: overviewMetrics.lowRatedOrders, threshold: criteria.lowRatedOrders, isHigherBetter: false, isPercent: false }
        };

        // Loop through each of the additional metrics and update
        Object.entries(additionalMetrics).forEach(([id, config]) => {
            const element = document.getElementById(id);
            if (element) {
                const value = config.value;
                const formattedValue = formatValue(value, config.isPercent);
                element.textContent = formattedValue;
                
                // Determine the color class (success or danger based on thresholds)
                const colorClass = getColorClass(value, config.threshold, config.isHigherBetter);
                element.className = [...Array.from(element.classList).filter(cls => !cls.startsWith('text-')), colorClass].join(' ');
            }
        });
    } catch (error) {
        console.error('Error updating additional metrics:', error);
    }
}

// Function to format values properly
function formatValue(value, isPercentage = false) {
    // Zero is a valid value - only return N/A for undefined, null, or NaN
    if (value === undefined || value === null) return 'N/A';
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'N/A';
    
    return isPercentage ? `${numValue.toFixed(1)}%` : (Number.isInteger(numValue) ? numValue.toString() : numValue.toFixed(1));
}

// Function to update progress bars
function updateProgressBars() {
    // Update response rate progress bar
    updateProgressBar('responseRateProgress', overviewMetrics.response_rate, criteria.response_rate, true);

    // Update handover rate progress bar
    updateProgressBar('handoverRateProgress', overviewMetrics.fast_handover_rate, criteria.fast_handover_rate, true);

    // Update on-time delivery rate progress bar
    updateProgressBar('onTimeRateProgress', overviewMetrics.onTimeRate, criteria.onTimeRate, true);
}

// Helper function to update a progress bar
function updateProgressBar(id, value, threshold, isHigherBetter) {
    const progressBar = document.getElementById(id);
    if (!progressBar) return;

    const numValue = parseFloat(value) || 0;
    progressBar.style.width = `${Math.min(numValue, 100)}%`;
    progressBar.textContent = `${numValue.toFixed(1)}%`;
    
    const colorClass = isHigherBetter ? 
        (numValue >= threshold ? 'bg-success' : 'bg-danger') :
        (numValue <= threshold ? 'bg-success' : 'bg-danger');
    
    progressBar.className = `progress-bar ${colorClass}`;
}

// Function to get the color class for success/danger based on thresholds
function getColorClass(value, threshold, isHigherBetter = true) {
    if (value === undefined || value === null) return 'text-muted';
    const numValue = parseFloat(value);
    
    if (isNaN(numValue) || isNaN(threshold)) return 'text-muted';
    
    return isHigherBetter ? 
        (numValue >= threshold ? 'text-success' : 'text-danger') :
        (numValue <= threshold ? 'text-success' : 'text-danger');
}

// Event listener for date selection (and updates)
document.getElementById('calendarDays').addEventListener('click', function(event) {
    const selectedDate = event.target.closest('.calendar-day');
    if (selectedDate) {
        const dateStr = selectedDate.getAttribute('data-date');
        const date = new Date(dateStr);
        
        // Fetch and update data for the selected date
        displayDateData(date);
    }
});

// Function to display data for the selected date
function displayDateData(selectedDate) {
    if (!selectedDate) return;

    try {
        const dayName = getDayNameFromDate(selectedDate);
        
        // Update selected date notification
        const selectedDateElement = document.getElementById('selectedDate');
        if (selectedDateElement) {
            selectedDateElement.textContent = `Selected date: ${dayName}, ${selectedDate.toLocaleDateString()}`;
        }

        fetchPerformanceData(dayName).catch(error => {
            console.error('Error fetching data:', error);
            showErrorMessage(`Failed to fetch data for ${dayName}: ${error.message}`);
            handleNoDataAvailableForSelectedDate();
        });
    } catch (error) {
        console.error('Error displaying date data:', error);
        showErrorMessage('Error processing selected date');
        handleNoDataAvailableForSelectedDate();
    }
}
