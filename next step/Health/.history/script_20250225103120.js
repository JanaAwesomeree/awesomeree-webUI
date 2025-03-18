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

            updateTableData();
            // We'll call updateAllMetricCards inside updateTableData to ensure metrics are updated after the table
            
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
        penalty: sum(data, 'penalty'),
        late_shipment_rate: avg(data, 'late_shipment_rate'),
        preparation_time: avg(data, 'preparation_time'),
        fast_handover_rate: avg(data, 'fast_handover_rate'),
        average_response_time: avg(data, 'average_response_time')
    };
}

// Reset data states
function resetData() {
    performanceData = [];
    dateData = {};
    overviewMetrics = {};
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

// UPDATED: Extract metrics from table data and update all cards
function updateMetricsFromTable() {
    try {
        // Get the table rows from the performance table
        const tableRows = document.querySelectorAll('#performanceTable tr');
        
        // Return early if no data is available
        if (!tableRows.length) {
            console.log('No table data available to update metrics');
            return;
        }
        
        // Initialize aggregation variables for all metrics
        const metrics = {
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
            
            // Extract values from cells based on table structure
            // Map table columns to metrics
            const tableData = {
                non_fulfillment_rate: parseFloat(cells[1]?.textContent.replace('%', '')) || 0,
                late_shipment_rate: parseFloat(cells[2]?.textContent.replace('%', '')) || 0,
                preparation_time: parseFloat(cells[3]?.textContent) || 0,
                fast_handover_rate: parseFloat(cells[4]?.textContent.replace('%', '')) || 0,
                response_rate: parseFloat(cells[5]?.textContent.replace('%', '')) || 0,
                average_response_time: parseFloat(cells[6]?.textContent) || 0,
                shop_rating: parseFloat(cells[7]?.textContent) || 0,
                penalty_points: parseFloat(cells[8]?.textContent) || 0
            };
            
            // Accumulate values for each metric
            Object.keys(metrics).forEach(key => {
                if (!isNaN(tableData[key])) {
                    metrics[key].total += tableData[key];
                    metrics[key].count++;
                }
            });
        });
        
        // Calculate averages and update overviewMetrics
        Object.keys(metrics).forEach(key => {
            if (metrics[key].count > 0) {
                if (key === 'penalty_points') {
                    // For penalty points, we want the sum not the average
                    overviewMetrics[key] = metrics[key].total;
                } else {
                    // For other metrics, calculate the average
                    overviewMetrics[key] = parseFloat((metrics[key].total / metrics[key].count).toFixed(2));
                }
            } else {
                overviewMetrics[key] = 0;
            }
        });
        
        // Make sure penalty is also set (for backward compatibility)
        overviewMetrics.penalty = overviewMetrics.penalty_points;
        
        console.log('Updated metrics from table data:', overviewMetrics);
        
        // Update all metric cards
        updateAllMetricCards();
        
    } catch (error) {
        console.error('Error updating metrics from table:', error);
        showErrorMessage('Error calculating metrics from table data');
    }
}

// UPDATED: Function to update all metric cards using the overviewMetrics
function updateAllMetricCards() {
    try {
        // Define a mapping of card IDs to their corresponding metric values and thresholds
        const metricCards = {
            // Account Health metrics
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
                value: overviewMetrics.penalty_points || 0, 
                threshold: criteria.penalty_points, 
                isHigherBetter: false,
                isPercent: false 
            },
            
            // Fulfillment metrics
            'lateShipmentRate': { 
                value: overviewMetrics.late_shipment_rate, 
                threshold: criteria.late_shipment_rate, 
                isHigherBetter: false,
                isPercent: true 
            },
            'preparationTime': { 
                value: overviewMetrics.preparation_time, 
                threshold: criteria.preparation_time, 
                isHigherBetter: false,
                isPercent: false 
            },
            'handoverRate': { 
                value: overviewMetrics.fast_handover_rate, 
                threshold: criteria.fast_handover_rate, 
                isHigherBetter: true,
                isPercent: true 
            },
            
            // Customer Service metrics
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
            }
        };
        
        // Update each metric card
        Object.entries(metricCards).forEach(([id, config]) => {
            updateMetricCard(id, config.value, config.threshold, config.isHigherBetter, config.isPercent);
        });
        
        // Additional summary cards if they exist
        const summaryCards = {
            'overallHealth': calculateOverallHealth(),
            'fulfillmentScore': calculateFulfillmentScore(),
            'customerServiceScore': calculateCustomerServiceScore()
        };
        
        Object.entries(summaryCards).forEach(([id, score]) => {
            updateSummaryCard(id, score);
        });
        
        console.log('All metric cards updated successfully');
        
    } catch (error) {
        console.error('Error updating metric cards:', error);
        showErrorMessage('Error updating dashboard metrics');
    }
}

// Helper function to update a single metric card
function updateMetricCard(id, value, threshold, isHigherBetter, isPercent) {
    const element = document.getElementById(id);
    if (!element) return;
    
    // Get the proper color class
    const colorClass = getColorClass(value, threshold, isHigherBetter);
    
    // Update the element's text content
    const formattedValue = formatValue(value, isPercent);
    
    // Check if there's an icon in the element
    const hasIcon = element.querySelector('i') !== null;
    
    if (hasIcon) {
        // If there's an icon, preserve it while updating the text
        const icon = element.querySelector('i');
        const iconHTML = icon ? icon.outerHTML : '';
        
        // Find where to insert the text
        if (element.childNodes.length > 0 && element.childNodes[0].nodeType === 3) {
            // If first child is a text node, replace it
            element.childNodes[0].nodeValue = `${formattedValue} `;
        } else {
            // Otherwise insert text at the beginning
            element.innerHTML = `${formattedValue} ${iconHTML}`;
        }
    } else {
        // If no icon, simply update the text
        element.textContent = formattedValue;
    }
    
    // Update the class (remove any existing text-* classes)
    const classes = Array.from(element.classList).filter(cls => !cls.startsWith('text-'));
    element.className = [...classes, colorClass].join(' ');
}

// Helper function to update summary cards
function updateSummaryCard(id, score) {
    const element = document.getElementById(id);
    if (!element) return;
    
    // Determine color class based on score
    let colorClass = 'text-dark';
    if (score >= 90) colorClass = 'text-success';
    else if (score >= 70) colorClass = 'text-warning';
    else colorClass = 'text-danger';
    
    // Update text
    element.textContent = `${score}%`;
    
    // Update class
    const classes = Array.from(element.classList).filter(cls => !cls.startsWith('text-'));
    element.className = [...classes, colorClass].join(' ');
}

// Calculate overall health score (example calculation)
function calculateOverallHealth() {
    const nonFulfillmentScore = Math.max(0, 100 - (overviewMetrics.non_fulfillment_rate * 25));
    const ratingScore = Math.min(100, (overviewMetrics.shop_rating / 5) * 100);
    const penaltyScore = Math.max(0, 100 - (overviewMetrics.penalty_points * 10));
    
    return Math.round((nonFulfillmentScore + ratingScore + penaltyScore) / 3);
}

// Calculate fulfillment score
function calculateFulfillmentScore() {
    const lateShipmentScore = Math.max(0, 100 - (overviewMetrics.late_shipment_rate * 20));
    const prepTimeScore = Math.max(0, 100 - (overviewMetrics.preparation_time * 10));
    const handoverScore = Math.min(100, overviewMetrics.fast_handover_rate);
    
    return Math.round((lateShipmentScore + prepTimeScore + handoverScore) / 3);
}

// Calculate customer service score
function calculateCustomerServiceScore() {
    const responseRateScore = Math.min(100, overviewMetrics.response_rate);
    const responseTimeScore = Math.max(0, 100 - (overviewMetrics.average_response_time * 20));
    
    return Math.round((responseRateScore + responseTimeScore) / 2);
}

// UPDATED: Table data function
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
        
        // After updating the table, update all metrics from the table data
        updateMetricsFromTable();
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
    
    // If changing pages, update metrics in case they need refreshing
    updateMetrics