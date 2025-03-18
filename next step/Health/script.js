const apiEndpoints = {
  // Shopee MY endpoints
  ShopeeMY: {
    Monday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Monday',
    Tuesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Tuesday',
    Wednesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Wednesday',
    Thursday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Thursday',
    Friday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Friday',
    Saturday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-health/daily-metrics/?day=Saturday'
  },
  // Shopee SG endpoints
  ShopeeSG: {
    Monday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-sg/daily-metrics/?day=Monday',
    Tuesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-sg/daily-metrics/?day=Tuesday',
    Wednesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-sg/daily-metrics/?day=Wednesday',
    Thursday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-sg/daily-metrics/?day=Thursday',
    Friday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-sg/daily-metrics/?day=Friday',
    Saturday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/shopee-sg/daily-metrics/?day=Saturday'
  },
  // TikTok endpoints - TODO: Update with actual endpoints
  TikTok: {
    Monday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/tiktok-health/daily-metrics/?day=Monday',
    Tuesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/tiktok-health/daily-metrics/?day=Tuesday',
    Wednesday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/tiktok-health/daily-metrics/?day=Wednesday',
    Thursday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/tiktok-health/daily-metrics/?day=Thursday',
    Friday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/tiktok-health/daily-metrics/?day=Friday',
    Saturday: 'https://t9x8zj0h-8000.asse.devtunnels.ms/tiktok-health/daily-metrics/?day=Saturday'
  }
};

// Current platform
let currentPlatform = 'ShopeeMY'; // Default platform

// Performance data and metrics for each platform
let platformData = {
  ShopeeMY: {
    performanceData: [],
    dateData: {},
    overviewMetrics: {},
    currentWeekStart: null,
    currentSortColumn: null,
    currentSortDirection: 'asc'
  },
  ShopeeSG: {
    performanceData: [],
    dateData: {},
    overviewMetrics: {},
    currentWeekStart: null,
    currentSortColumn: null,
    currentSortDirection: 'asc'
  },
  TikTok: {
    performanceData: [],
    dateData: {},
    overviewMetrics: {},
    currentWeekStart: null,
    currentSortColumn: null,
    currentSortDirection: 'asc'
  }
};

// Platform specific element IDs
const platformElements = {
  ShopeeMY: {
    calendarContainer: 'shopeeMYCalendarContainer',
    performanceTable: 'shopeeMYPerformanceTable',
    pageId: 'account-health-shopee-my'
  },
  ShopeeSG: {
    calendarContainer: 'shopeeSGCalendarContainer',
    performanceTable: 'shopeeSGPerformanceTable',
    pageId: 'account-health-shopee-sg'
  },
  TikTok: {
    calendarContainer: 'tiktokCalendarContainer',
    performanceTable: 'tiktokPerformanceTable',
    pageId: 'account-health-tiktok'
  }
};

// Performance criteria for Shopee platforms
const criteria = {
  shop_name: " ",
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

// TikTok specific criteria
const tiktokCriteria = {
  shop_name: " ",
  shop_violations: 0,           // Better when < 0
  product_violations: 0,        // Better when < 0
  late_dispatch_rate: 4.0,      // Better when ≤ 4.00%
  response_rate: 85.0,          // Better when ≥ 85.00%
  negative_review_rate: 0.5,    // Better when ≤ 0.50%
  defective_order_return: 1.5,  // Better when ≤ 1.50%
  store_ratings: 4.5            // Better when ≥ 4.5
};

/************************************************************
 * API Request Configurations
 ************************************************************/
const API_TIMEOUT = 15000;
const RETRY_COUNT = 3;
const RETRY_DELAY = 2000;

/************************************************************
 * Date Handling
 ************************************************************/
/**
 * Returns the full weekday name (e.g., "Monday") from a Date or date-string.
 */
function getDayNameFromDate(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return date.toLocaleString('en-US', { weekday: 'long' });
}

/**
 * Returns an array of the past 6 days (including `referenceDate`),
 * skipping Sundays. The resulting array is in chronological order
 * (earliest day first, referenceDate last).
 */
function getPast6DaysSkippingSunday(referenceDate = new Date()) {
  const days = [];
  const current = new Date(referenceDate); // clone the date

  while (days.length < 6) {
    // Skip Sunday (getDay() returns 0 for Sunday)
    if (current.getDay() !== 0) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() - 1);
  }
  days.reverse();
  return days;
}

/************************************************************
 * API Request Helpers
 ************************************************************/
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

/************************************************************
 * Fetch Performance Data
 ************************************************************/
async function fetchPerformanceData(platform, day = 'Monday', retryCount = RETRY_COUNT, retryDelay = RETRY_DELAY) {
  if (!apiEndpoints[platform][day]) {
    showErrorMessage(`Invalid day: ${day} for platform ${platform}`);
    handleNoDataAvailable(platform, `No data available for ${day}`);
    return;
  }
  let lastError = null;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      document.body.classList.add('loading');
      //showLoadingMessage(`Fetching ${platform} data for ${day}... (Attempt ${attempt}/${retryCount})`);

      const response = await fetchWithTimeout(apiEndpoints[platform][day], {
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
      console.log(`${platform} ${day} Data:`, data);

      if (Array.isArray(data) && data.length > 0) {
        platformData[platform].performanceData = data.map(item => {
          const processed = {};
          for (const key in item) {
            processed[key] = item[key] === 0 ? 0 : (item[key] || item[key] === 0 ? item[key] : null);
          }
          return processed;
        });
        platformData[platform].overviewMetrics = calculateOverviewMetrics(platformData[platform].performanceData, platform);
      } else if (typeof data === 'object' && data !== null) {
        if (data.performanceData) {
          platformData[platform].performanceData = data.performanceData.map(item => {
            const processed = {};
            for (const key in item) {
              processed[key] = item[key] === 0 ? 0 : (item[key] || item[key] === 0 ? item[key] : null);
            }
            return processed;
          });
        } else {
          platformData[platform].performanceData = [];
        }
        if (platformData[platform].performanceData.length === 0) {
          handleNoDataAvailable(platform, `No data found for ${day}`);
          document.body.classList.remove('loading');
          return;
        }
        platformData[platform].dateData = data.dateData || {};
        platformData[platform].overviewMetrics = data.overviewMetrics || calculateOverviewMetrics(platformData[platform].performanceData, platform);
      } else {
        throw new Error('Invalid data format received from API');
      }

      // If a sort is active, re-sort the performanceData array
      if (platformData[platform].currentSortColumn) {
        sortPerformanceData(platform, platformData[platform].currentSortColumn, platformData[platform].currentSortDirection);
      }

      updateTableData(platform);
      //SuccessMessage(`${platform} data for ${day} updated successfully`);
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
  //showErrorMessage(`Failed to fetch ${platform} data for ${day}: ${lastError.message}`);
  handleNoDataAvailable(platform, `Failed to load data for ${day}`);
}

/************************************************************
 * Messaging & Notifications
 ************************************************************/
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

/************************************************************
 * Metrics Calculations
 ************************************************************/
function calculateOverviewMetrics(data, platform) {
  if (!Array.isArray(data) || data.length === 0) return {};

  const sum = (arr, key) => arr.reduce((acc, curr) => {
    const value = curr[key];
    const parsedValue = value !== undefined && value !== null ? parseFloat(value) : 0;
    return acc + (isNaN(parsedValue) ? 0 : parsedValue);
  }, 0);

  const avg = (arr, key) => sum(arr, key) / arr.length;

  // For Shopee platforms
  if (platform === 'ShopeeMY' || platform === 'ShopeeSG') {
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
  // For TikTok platform
  else if (platform === 'TikTok') {
    return {
      shop_violations: avg(data, 'shop_violations'),
      product_violations: avg(data, 'product_violations'),
      late_dispatch_rate: avg(data, 'late_dispatch_rate'),
      response_rate: avg(data, 'response_rate'),
      negative_review_rate: avg(data, 'negative_review_rate'),
      defective_order_return: avg(data, 'defective_order_return'),
      store_ratings: avg(data, 'store_ratings')
    };
  }
  
  return {};
}

/************************************************************
 * UI: Handling No Data
 ************************************************************/
function handleNoDataAvailable(platform, message) {
  const tableBody = document.getElementById(platformElements[platform].performanceTable);
  if (tableBody) {
    // Use different colspan based on platform
    const colSpan = platform === 'TikTok' ? 8 : 9;
    tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center">${message}</td></tr>`;
  }
  document.body.classList.remove('loading');
}

function handleNoDataAvailableForSelectedDate(platform) {
  showErrorMessage(`No data found for this date in ${platform}`);
  const tableBody = document.getElementById(platformElements[platform].performanceTable);
  if (tableBody) {
    // Use different colspan based on platform
    const colSpan = platform === 'TikTok' ? 8 : 9;
    tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center">No data found for this date</td></tr>`;
  }
  
  // Update the selected date element if it exists for this platform
  const selectedDateElement = document.querySelector(`#${platformElements[platform].calendarContainer} .selected-date`);
  if (selectedDateElement) {
    selectedDateElement.textContent = 'No data found for selected date.';
  }
}

/************************************************************
 * Utility: Formatting & Colors
 ************************************************************/
function formatValue(value, isPercentage = false) {
  if (value === undefined || value === null) return 'N/A';
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 'N/A';
  return isPercentage ? `${numValue.toFixed(1)}%` : (Number.isInteger(numValue) ? numValue.toString() : numValue.toFixed(1));
}

function getColorClass(value, threshold, isHigherBetter = true) {
  if (value === undefined || value === null) return 'text-muted';
  const numValue = parseFloat(value);
  if (isNaN(numValue) || isNaN(threshold)) return 'text-muted';
  return isHigherBetter ? (numValue >= threshold ? 'text-success' : 'text-danger') : (numValue <= threshold ? 'text-success' : 'text-danger');
}

/************************************************************
 * UI: Table Updates
 ************************************************************/
function updateTableData(platform) {
  const tableBody = document.getElementById(platformElements[platform].performanceTable);
  if (!tableBody) return;
  try {
    if (!platformData[platform].performanceData.length) {
      // Use different colspan based on platform
      const colSpan = platform === 'TikTok' ? 8 : 9;
      tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center">No data available</td></tr>`;
      return;
    }

    // For TikTok platform
    if (platform === 'TikTok') {
      tableBody.innerHTML = platformData[platform].performanceData.map(data => `
        <tr>
          <td>${data.shop_name || 'No Shop Name'}</td>
          <td class="${getColorClass(data.shop_violations, tiktokCriteria.shop_violations, false)}">${formatValue(data.shop_violations)}</td>
          <td class="${getColorClass(data.product_violations, tiktokCriteria.product_violations, false)}">${formatValue(data.product_violations)}</td>
          <td class="${getColorClass(data.late_dispatch_rate, tiktokCriteria.late_dispatch_rate, false)}">${formatValue(data.late_dispatch_rate, true)}</td>
          <td class="${getColorClass(data.response_rate, tiktokCriteria.response_rate, true)}">${formatValue(data.response_rate, true)}</td>
          <td class="${getColorClass(data.negative_review_rate, tiktokCriteria.negative_review_rate, false)}">${formatValue(data.negative_review_rate, true)}</td>
          <td class="${getColorClass(data.defective_order_return, tiktokCriteria.defective_order_return, false)}">${formatValue(data.defective_order_return, true)}</td>
          <td class="${getColorClass(data.store_ratings, tiktokCriteria.store_ratings, true)}">${formatValue(data.store_ratings)}</td>
        </tr>
      `).join('');
    }
    // For Shopee platforms
    else {
      tableBody.innerHTML = platformData[platform].performanceData.map(data => `
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
    }
  } catch (error) {
    console.error(`Error updating ${platform} table:`, error);
    showErrorMessage(`Error updating ${platform} performance table`);
    // Use different colspan based on platform
    const colSpan = platform === 'TikTok' ? 8 : 9;
    tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center">Error loading data</td></tr>`;
  }
}

/************************************************************
 * Sorting Functions for Table Headers
 ************************************************************/
function sortPerformanceData(platform, column, direction = 'asc') {
  platformData[platform].performanceData.sort((a, b) => {
    let valA = a[column];
    let valB = b[column];
    // If both values are numeric, compare numerically
    if (!isNaN(parseFloat(valA)) && !isNaN(parseFloat(valB))) {
      valA = parseFloat(valA);
      valB = parseFloat(valB);
    } else {
      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();
    }
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Updates the sort column/direction, re-sorts the data, and updates the table.
 * Also shows an arrow in the header to indicate current sort direction.
 */
function sortTableData(platform, column) {
  if (platformData[platform].currentSortColumn === column) {
    // Toggle sort direction
    platformData[platform].currentSortDirection = platformData[platform].currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    platformData[platform].currentSortColumn = column;
    platformData[platform].currentSortDirection = 'asc';
  }
  sortPerformanceData(platform, column, platformData[platform].currentSortDirection);
  updateSortIndicators(platform, column, platformData[platform].currentSortDirection);
  updateTableData(platform);
}

/**
 * Clears any existing arrows from all headers in the platform table, then adds
 * an arrow to the currently sorted column to show asc/desc.
 */
function updateSortIndicators(platform, column, direction) {
  // Find the table in the specific platform page
  const page = document.getElementById(platformElements[platform].pageId);
  if (!page) return;
  
  // Remove existing arrows from all table headers
  page.querySelectorAll('table thead th[data-column]').forEach(th => {
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.remove();
  });

  // Add an arrow to the current sorted column
  const currentTh = page.querySelector(`table thead th[data-column="${column}"]`);
  if (!currentTh) return;

  const arrowSpan = document.createElement('span');
  arrowSpan.classList.add('sort-arrow');
  // ▲ for ascending, ▼ for descending
  arrowSpan.textContent = direction === 'asc' ? ' ▲' : ' ▼';
  currentTh.appendChild(arrowSpan);
}

/************************************************************
 * Calendar & Date Navigation
 ************************************************************/
function displayDateData(platform, selectedDate) {
  if (!selectedDate) return;
  try {
    const dayName = getDayNameFromDate(selectedDate);
    const selectedDateElement = document.querySelector(`#${platformElements[platform].calendarContainer} .selected-date`);
    if (selectedDateElement) {
      selectedDateElement.textContent = `Selected date: ${dayName}, ${selectedDate.toLocaleDateString('en-GB')}`;
    }
    fetchPerformanceData(platform, dayName).catch(error => {
      console.error(`Error fetching ${platform} data:`, error);
      showErrorMessage(`Failed to fetch ${platform} data for ${dayName}: ${error.message}`);
      handleNoDataAvailableForSelectedDate(platform);
    });
  } catch (error) {
    console.error(`Error displaying ${platform} date data:`, error);
    showErrorMessage(`Error processing selected date for ${platform}`);
    handleNoDataAvailableForSelectedDate(platform);
  }
}

/**
 * Initializes the weekly calendar for a specific platform
 */
function initializeWeeklyCalendar(platform) {
  const calendarContainer = document.getElementById(platformElements[platform].calendarContainer);
  if (!calendarContainer) return;
  calendarContainer.innerHTML = '';

  const calendarHeader = document.createElement('div');
  calendarHeader.className = 'calendar-header d-flex justify-content-between align-items-center mb-3';

  const weekTitle = document.createElement('h6');
  weekTitle.className = 'mb-0';
  weekTitle.id = `${platform}WeekTitle`;

  const navigationBtns = document.createElement('div');
  navigationBtns.className = 'd-flex gap-2';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-sm btn-outline-secondary';
  prevBtn.innerHTML = '&larr;';
  prevBtn.id = `${platform}PrevWeekBtn`;

  const todayBtn = document.createElement('button');
  todayBtn.className = 'btn btn-sm btn-outline-primary';
  todayBtn.textContent = 'Today';
  todayBtn.id = `${platform}TodayBtn`;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-sm btn-outline-secondary';
  nextBtn.innerHTML = '&rarr;';
  nextBtn.id = `${platform}NextWeekBtn`;

  calendarHeader.appendChild(weekTitle);
  calendarHeader.appendChild(navigationBtns);

  const calendarDays = document.createElement('div');
  calendarDays.className = 'calendar-days';
  calendarDays.id = `${platform}CalendarDays`;

  const selectedDateElement = document.createElement('div');
  selectedDateElement.className = 'selected-date alert alert-info mt-2 mb-0 py-2 px-3';
  selectedDateElement.style.fontSize = '13px';

  calendarContainer.appendChild(calendarHeader);
  calendarContainer.appendChild(calendarDays);
  calendarContainer.appendChild(selectedDateElement);

  updateCalendar(platform, new Date());

  // Set up event listeners
  prevBtn.addEventListener('click', function() {
    const selectedDayEl = document.querySelector(`#${platformElements[platform].calendarContainer} .calendar-day.selected`);
    if (selectedDayEl) {
      const selectedDate = new Date(selectedDayEl.getAttribute('data-date'));
      selectedDate.setDate(selectedDate.getDate() - 7);
      updateCalendar(platform, selectedDate);
    }
  });

  nextBtn.addEventListener('click', function() {
    const selectedDayEl = document.querySelector(`#${platformElements[platform].calendarContainer} .calendar-day.selected`);
    if (selectedDayEl) {
      const selectedDate = new Date(selectedDayEl.getAttribute('data-date'));
      selectedDate.setDate(selectedDate.getDate() + 7);
      updateCalendar(platform, selectedDate);
    }
  });

  todayBtn.addEventListener('click', function() {
    updateCalendar(platform, new Date());
  });
}

/**
 * Updates the calendar display for a specific platform
 */
function updateCalendar(platform, referenceDate) {
  const dayArray = getPast6DaysSkippingSunday(referenceDate);
  platformData[platform].currentWeekStart = dayArray[0];
  
  const weekTitle = document.getElementById(`${platform}WeekTitle`);
  if (weekTitle) {
    weekTitle.textContent = `Past 6 Days: ${dayArray[0].toLocaleDateString('en-GB')} - ${dayArray[dayArray.length - 1].toLocaleDateString('en-GB')}`;
  }
  
  const calendarDays = document.getElementById(`${platform}CalendarDays`);
  if (!calendarDays) return;
  calendarDays.innerHTML = '';

  dayArray.forEach(date => {
    const dayNameShort = date.toLocaleString('en-US', { weekday: 'short' });
    const dayFullName = getDayNameFromDate(date);
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day text-center p-2';
    dayElement.setAttribute('data-date', date.toISOString().split('T')[0]);

    if (apiEndpoints[platform][dayFullName]) {
      dayElement.addEventListener('click', function() {
        document.querySelectorAll(`#${platformElements[platform].calendarContainer} .calendar-day`).forEach(day => day.classList.remove('selected'));
        this.classList.add('selected');
        displayDateData(platform, date);
      });
    } else {
      dayElement.classList.add('disabled');
    }

    const dayLabel = document.createElement('div');
    dayLabel.className = 'day-name';
    dayLabel.textContent = dayNameShort;

    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number rounded-circle d-flex align-items-center justify-content-center mx-auto';
    dayNumber.textContent = date.getDate();

    dayElement.appendChild(dayLabel);
    dayElement.appendChild(dayNumber);
    calendarDays.appendChild(dayElement);
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEl = document.querySelector(`#${platformElements[platform].calendarContainer} .calendar-day[data-date="${todayStr}"]`);
  if (todayEl && !todayEl.classList.contains('disabled')) {
    todayEl.classList.add('selected');
    displayDateData(platform, new Date());
  } else {
    const lastDayEl = calendarDays.lastElementChild;
    if (lastDayEl && !lastDayEl.classList.contains('disabled')) {
      lastDayEl.classList.add('selected');
      displayDateData(platform, new Date(lastDayEl.getAttribute('data-date')));
    }
  }
  updateTodayButtonVisibility(platform);
}

/**
 * Shows or hides the "Today" button for a specific platform
 */
function updateTodayButtonVisibility(platform) {
  const todayBtn = document.getElementById(`${platform}TodayBtn`);
  if (!todayBtn || !platformData[platform].currentWeekStart) return;
  
  const today = new Date();
  const todaysRange = getPast6DaysSkippingSunday(today);
  const earliestOfTodaysRange = todaysRange[0].toISOString().split('T')[0];
  const earliestOfCurrentRange = platformData[platform].currentWeekStart.toISOString().split('T')[0];
  
  todayBtn.style.display = (earliestOfTodaysRange === earliestOfCurrentRange) ? 'none' : 'block';
}

/************************************************************
 * Sidebar & Page Navigation
 ************************************************************/
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('content').classList.toggle('expanded');
}

function showPage(pageId) {
  // Set the current platform based on the page ID
  if (pageId === 'account-health-shopee-my') {
    currentPlatform = 'ShopeeMY';
  } else if (pageId === 'account-health-shopee-sg') {
    currentPlatform = 'ShopeeSG';
  } else if (pageId === 'account-health-tiktok') {
    currentPlatform = 'TikTok';
  }

  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  document.querySelectorAll('#sidebar .nav-link').forEach(link => link.classList.remove('active'));
  const activeLink = Array.from(document.querySelectorAll('#sidebar .nav-link'))
    .find(link => link.getAttribute('onclick') && link.getAttribute('onclick').includes(pageId));
  if (activeLink) activeLink.classList.add('active');
}

/************************************************************
 * Set up table sorting for a specific platform
 ************************************************************/
function setupTableSorting(platform) {
  const pageElement = document.getElementById(platformElements[platform].pageId);
  if (!pageElement) return;

  pageElement.querySelectorAll('table thead th[data-column]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const column = th.getAttribute('data-column');
      sortTableData(platform, column);
    });
  });
}

// Initialize TikTok shop selector functionality
function initializeTikTokShopSelector() {
  const shopButton = document.getElementById('tiktokShopButton');
  const shopMenu = document.getElementById('tiktokShopMenu');
  
  if (shopButton && shopMenu) {
    // Toggle menu visibility when button is clicked
    shopButton.addEventListener('click', function() {
      shopMenu.classList.toggle('hidden');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
      if (!shopButton.contains(event.target) && !shopMenu.contains(event.target)) {
        shopMenu.classList.add('hidden');
      }
    });
    
    // Handle shop selection
    shopMenu.querySelectorAll('.shop-option').forEach(option => {
      option.addEventListener('click', function() {
        const shopName = this.getAttribute('data-shop');
        shopButton.textContent = shopName;
        shopMenu.classList.add('hidden');
        
        // Filter data to show only selected shop
        if (platformData.TikTok.performanceData && platformData.TikTok.performanceData.length > 0) {
          const filteredData = platformData.TikTok.performanceData.filter(item => 
            item.shop_name === shopName
          );
          
          const tableBody = document.getElementById(platformElements.TikTok.performanceTable);
          if (tableBody) {
            if (filteredData.length > 0) {
              tableBody.innerHTML = filteredData.map(data => `
                <tr>
                  <td>${data.shop_name || 'No Shop Name'}</td>
                  <td class="${getColorClass(data.shop_violations, tiktokCriteria.shop_violations, false)}">${formatValue(data.shop_violations)}</td>
                  <td class="${getColorClass(data.product_violations, tiktokCriteria.product_violations, false)}">${formatValue(data.product_violations)}</td>
                  <td class="${getColorClass(data.late_dispatch_rate, tiktokCriteria.late_dispatch_rate, false)}">${formatValue(data.late_dispatch_rate, true)}</td>
                  <td class="${getColorClass(data.response_rate, tiktokCriteria.response_rate, true)}">${formatValue(data.response_rate, true)}</td>
                  <td class="${getColorClass(data.negative_review_rate, tiktokCriteria.negative_review_rate, false)}">${formatValue(data.negative_review_rate, true)}</td>
                  <td class="${getColorClass(data.defective_order_return, tiktokCriteria.defective_order_return, false)}">${formatValue(data.defective_order_return, true)}</td>
                  <td class="${getColorClass(data.store_ratings, tiktokCriteria.store_ratings, true)}">${formatValue(data.store_ratings)}</td>
                </tr>
              `).join('');
            } else {
              tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No data available for this shop</td></tr>';
            }
          }
        }
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  try {
    // Initialize calendars for all platforms
    initializeWeeklyCalendar('ShopeeMY');
    initializeWeeklyCalendar('ShopeeSG');
    initializeWeeklyCalendar('TikTok');
    
    // Set up table sorting for all platforms
    setupTableSorting('ShopeeMY');
    setupTableSorting('ShopeeSG');
    setupTableSorting('TikTok');
    
    // Initialize TikTok shop selector
    initializeTikTokShopSelector();
    
    // Show default page (Shopee MY)
    showPage('overview');
    
    // Auto-refresh every 5 minutes for current platform's today's data
    setInterval(() => {
      const currentDay = new Date().toLocaleString('en-US', { weekday: 'long' });
      if (apiEndpoints[currentPlatform][currentDay]) {
        fetchPerformanceData(currentPlatform, currentDay).catch(error => {
          console.error(`Error fetching ${currentPlatform} performance data for ${currentDay}:`, error);
          showErrorMessage(`Error fetching ${currentPlatform} performance data for ${currentDay}`);
        });
      } else {
        console.warn(`No API endpoint for ${currentPlatform} on ${currentDay}.`);
      }
    }, 300000);

    // Fetch initial data for all platforms
    const today = new Date();
    const dayName = getDayNameFromDate(today);
    
    fetchPerformanceData('ShopeeMY', dayName).catch(error => {
      console.error('Error fetching initial ShopeeMY data:', error);
      showErrorMessage(`Failed to fetch initial ShopeeMY data: ${error.message}`);
    });
    
    // Initialize ShopeeSG data
    fetchPerformanceData('ShopeeSG', dayName).catch(error => {
      console.error('Error fetching initial ShopeeSG data:', error);
      showErrorMessage(`Failed to fetch initial ShopeeSG data: ${error.message}`);
    });
    
    // Initialize TikTok data
    fetchPerformanceData('TikTok', dayName).catch(error => {
      console.error('Error fetching initial TikTok data:', error);
      showErrorMessage(`Failed to fetch initial TikTok data: ${error.message}`);
    });
    
  } catch (error) {
    console.error('Error during initialization:', error);
    showErrorMessage('Error initializing the dashboard');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const stockCountTableBody = document.getElementById('stockCountTableBody');
  const stockSearchInput = document.getElementById('stockSearchInput');
  const stockSearchButton = document.getElementById('stockSearchButton');
  const stockFilterDropdown = document.querySelectorAll('#stock-count .dropdown-item');
  const sortableHeaders = document.querySelectorAll('#stockCountTable .sortable');
  const paginationContainer = document.querySelector('#stock-count .pagination');

  let stockData = [];
  let currentPage = 1;
  let totalPages = 1;
  let limit = 100; // 100 rows per page
  let searchTerm = '';
  let currentFilter = 'all';

  // Backend URL with trailing slash
  const BACKEND_URL = 'https://t9x8zj0h-8000.asse.devtunnels.ms/';

  // Function to fetch stock count data from the API with pagination
  async function fetchStockData(page = 1) {
    try {
      const url = `${BACKEND_URL}stock-count/all/?page=${page}&limit=${limit}`; // Ensure trailing slash
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch stock count data: ${response.statusText}`);
      }
      const responseData = await response.json();
      
      stockData = responseData.data;
      currentPage = responseData.current_page;
      totalPages = responseData.total_pages;
      limit = responseData.limit;

      renderTable(stockData);
      renderPagination();
    } catch (error) {
      console.error('Error fetching stock data:', error);
      stockCountTableBody.innerHTML = '<tr><td colspan="8">Error loading data. Please try again later.</td></tr>';
    }
  }

  // Function to render table rows
  function renderTable(data) {
    stockCountTableBody.innerHTML = '';
    const filteredData = applyFiltersAndSearch(data);
    filteredData.forEach(item => {
      const stockStatusClass =
        parseInt(item.reserve_stock) === 0 ? 'text-danger' :
        parseInt(item.reserve_stock) < 10 ? 'text-warning' : 'text-success';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.sku}</td>
        <td>${item.product_variation}</td>
        <td>${item.total_sales}</td>
        <td>${item.current_stock}</td>
        <td>${item.incoming_stock}</td>
        <td class="${stockStatusClass}">${item.reserve_stock}</td>
        <td>${item.lead}</td>
        <td>${item.total_stock}</td>
      `;
      stockCountTableBody.appendChild(row);
    });
  }

  // Function to apply search and filters
  function applyFiltersAndSearch(data) {
    let filteredData = [...data];

    // Apply search
    if (searchTerm) {
      filteredData = filteredData.filter(
        item =>
          item.sku.toLowerCase().includes(searchTerm) ||
          item.product_variation.toLowerCase().includes(searchTerm)
      );
    }

    // Apply filter
    if (currentFilter === 'low-stock') {
      filteredData = filteredData.filter(item => parseInt(item.reserve_stock) > 0 && parseInt(item.reserve_stock) < 10);
    } else if (currentFilter === 'out-of-stock') {
      filteredData = filteredData.filter(item => parseInt(item.reserve_stock) === 0);
    }

    return filteredData;
  }

  // Function to render pagination controls
  function renderPagination() {
    paginationContainer.innerHTML = '';

    // Calculate the range of pages to display (e.g., 1,2,3,4,5 or 2,3,4,5,6)
    let startPage = Math.max(1, currentPage - 2); // Show 2 pages before current page
    let endPage = Math.min(totalPages, startPage + 4); // Show up to 5 pages total
    startPage = Math.max(1, endPage - 4); // Adjust startPage to ensure 5 pages are shown if possible

    // Previous button
    const prevItem = document.createElement('li');
    prevItem.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.textContent = 'Previous';
    prevLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentPage > 1) {
        fetchStockData(currentPage - 1);
      }
    });
    prevItem.appendChild(prevLink);
    paginationContainer.appendChild(prevItem);

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      const pageItem = document.createElement('li');
      pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
      const pageLink = document.createElement('a');
      pageLink.className = 'page-link';
      pageLink.href = '#';
      pageLink.textContent = i;
      pageLink.addEventListener('click', (e) => {
        e.preventDefault();
        fetchStockData(i);
      });
      pageItem.appendChild(pageLink);
      paginationContainer.appendChild(pageItem);
    }

    // Next button
    const nextItem = document.createElement('li');
    nextItem.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.textContent = 'Next';
    nextLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentPage < totalPages) {
        fetchStockData(currentPage + 1);
      }
    });
    nextItem.appendChild(nextLink);
    paginationContainer.appendChild(nextItem);
  }

  // Initial fetch and render
  fetchStockData();

  // Search functionality
  stockSearchButton.addEventListener('click', () => {
    searchTerm = stockSearchInput.value.toLowerCase().trim();
    renderTable(stockData); // Re-render with current data (client-side search)
  });

  // Filter functionality
  stockFilterDropdown.forEach(filter => {
    filter.addEventListener('click', e => {
      e.preventDefault();
      currentFilter = e.target.getAttribute('data-filter');
      renderTable(stockData); // Re-render with current data (client-side filter)
    });
  });

  // Sorting functionality
  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-column');
      const order = header.classList.contains('asc') ? 'desc' : 'asc';

      // Toggle sort direction
      sortableHeaders.forEach(h => h.classList.remove('asc', 'desc'));
      header.classList.add(order);

      const sortedData = [...stockData].sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (order === 'asc') {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      });

      stockData = sortedData;
      renderTable(stockData);
    });
  });

  // Trigger search on Enter key
  stockSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      stockSearchButton.click();
    }
  });
});