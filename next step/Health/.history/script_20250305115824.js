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
  
  function getWeekBounds(referenceDate = new Date()) {
    const currentDay = referenceDate.getDay(); // 0 is Sunday, 1 is Monday, etc.
    // Calculate Monday of the current week (if Sunday, go back 6 days)
    const monday = new Date(referenceDate);
    monday.setDate(referenceDate.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    monday.setHours(0, 0, 0, 0);
    // Saturday is 5 days after Monday
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    saturday.setHours(23, 59, 59, 999);
    return { monday, saturday };
  }
  
  // API request helpers
  const API_TIMEOUT = 15000;
  const RETRY_COUNT = 3;
  const RETRY_DELAY = 2000;
  
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
  
        // Process data: support both array or object format responses
        if (Array.isArray(data) && data.length > 0) {
          performanceData = data.map(item => {
            const processed = {};
            for (const key in item) {
              processed[key] = item[key] === 0 ? 0 : (item[key] || item[key] === 0 ? item[key] : null);
            }
            return processed;
          });
          overviewMetrics = calculateOverviewMetrics(performanceData);
        } else if (typeof data === 'object' && data !== null) {
          if (data.performanceData) {
            performanceData = data.performanceData.map(item => {
              const processed = {};
              for (const key in item) {
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
  
  // Message handling functions
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
  
  // Data state variables and thresholds
  let performanceData = [];
  let dateData = {};
  let overviewMetrics = {};
  let currentWeekStart = null;
  
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
  
  // Utility: Calculate overall metrics from performance data
  function calculateOverviewMetrics(data) {
    if (!Array.isArray(data) || data.length === 0) return {};
    const sum = (arr, key) => arr.reduce((acc, curr) => {
      const value = curr[key];
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
  
  // Reset functions for UI components
  function handleNoDataAvailable(message) {
    const tableBody = document.getElementById('performanceTable');
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center">${message}</td></tr>`;
    }
    resetAllMetricCards();
    document.body.classList.remove('loading');
  }
  
  function handleNoDataAvailableForSelectedDate() {
    resetAllMetricCards();
    showErrorMessage('No data found for this date');
    updateTableData();
    const tableBody = document.getElementById('performanceTable');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="9" class="text-center">No data found for this date</td></tr>';
    }
    const selectedDateElement = document.getElementById('selectedDate');
    if (selectedDateElement) {
      selectedDateElement.textContent = 'No data found for selected date.';
    }
  }
  
  function resetAllMetricCards() {
    overviewMetrics = {};
    const mainMetrics = ['nonFulfillRate', 'shopRating', 'penaltyPoints'];
    mainMetrics.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        const textNode = Array.from(element.childNodes).find(node => node.nodeType === 3);
        if (textNode) {
          textNode.nodeValue = 'N/A ';
        } else {
          element.innerHTML = `N/A ${element.innerHTML.includes('bi-arrow') ? element.innerHTML.substr(element.innerHTML.indexOf('<i')) : ''}`;
        }
        const classes = Array.from(element.classList).filter(cls => !cls.startsWith('text-'));
        element.className = [...classes, 'text-muted'].join(' ');
      }
    });
    const additionalMetrics = ['responseRate', 'handoverRate', 'avgResponseTime', 'onTimeRate', 'lowRatedOrders'];
    additionalMetrics.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = 'N/A';
        const classes = Array.from(element.classList).filter(cls => !cls.startsWith('text-'));
        element.className = [...classes, 'text-muted'].join(' ');
      }
    });
    resetProgressBars();
  }
  
  function resetProgressBars() {
    document.querySelectorAll('.progress-bar').forEach(bar => {
      bar.style.width = '0%';
      bar.textContent = 'N/A';
    });
  }
  
  // UI update functions
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
  
  function updateAllMetricCards() {
    try {
      updateOverviewMetrics();
      updateAdditionalMetrics();
      if (performanceData.length === 0) {
        handleNoDataAvailableForSelectedDate();
      } else {
        updateProgressBars();
      }
      console.log('All metric cards updated with current data:', overviewMetrics);
    } catch (error) {
      console.error('Error updating metric cards:', error);
      showErrorMessage('Error updating dashboard metrics');
    }
  }
  
  function updateOverviewMetrics() {
    try {
      const metrics = {
        nonFulfillRate: { value: overviewMetrics.non_fulfillment_rate, threshold: criteria.non_fulfillment_rate, isHigherBetter: false, isPercent: true },
        shopRating: { value: overviewMetrics.shop_rating, threshold: criteria.shop_rating, isHigherBetter: true, isPercent: false },
        penaltyPoints: { value: overviewMetrics.penalty || 0, threshold: criteria.penalty_points, isHigherBetter: false, isPercent: false }
      };
      Object.entries(metrics).forEach(([id, config]) => {
        const element = document.getElementById(id);
        if (element) {
          // Update text
          const textNode = Array.from(element.childNodes).find(node => node.nodeType === 3);
          if (textNode) {
            textNode.nodeValue = `${formatValue(config.value, config.isPercent)} `;
          } else {
            element.innerHTML = `${formatValue(config.value, config.isPercent)} ${element.innerHTML.includes('bi-arrow') ? element.innerHTML.substr(element.innerHTML.indexOf('<i')) : ''}`;
          }
          const classes = Array.from(element.classList).filter(cls => !cls.startsWith('text-'));
          element.className = [...classes, getColorClass(config.value, config.threshold, config.isHigherBetter)].join(' ');
        }
      });
    } catch (error) {
      console.error('Error updating metrics:', error);
      showErrorMessage('Error updating overview metrics');
    }
  }
  
  function updateAdditionalMetrics() {
    try {
      const additionalMetrics = {
        responseRate: { value: overviewMetrics.response_rate, threshold: criteria.response_rate, isHigherBetter: true, isPercent: true },
        handoverRate: { value: overviewMetrics.fast_handover_rate, threshold: criteria.fast_handover_rate, isHigherBetter: true, isPercent: true },
        avgResponseTime: { value: overviewMetrics.average_response_time, threshold: criteria.average_response_time, isHigherBetter: false, isPercent: false },
        onTimeRate: { value: overviewMetrics.onTimeRate, threshold: criteria.onTimeRate, isHigherBetter: true, isPercent: true },
        lowRatedOrders: { value: overviewMetrics.lowRatedOrders, threshold: criteria.lowRatedOrders, isHigherBetter: false, isPercent: false }
      };
      Object.entries(additionalMetrics).forEach(([id, config]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = formatValue(config.value, config.isPercent);
          element.className = [...Array.from(element.classList).filter(cls => !cls.startsWith('text-')), getColorClass(config.value, config.threshold, config.isHigherBetter)].join(' ');
        }
      });
    } catch (error) {
      console.error('Error updating additional metrics:', error);
    }
  }
  
  function updateProgressBars() {
    updateProgressBar('responseRateProgress', overviewMetrics.response_rate, criteria.response_rate, true);
    updateProgressBar('handoverRateProgress', overviewMetrics.fast_handover_rate, criteria.fast_handover_rate, true);
    updateProgressBar('onTimeRateProgress', overviewMetrics.onTimeRate, criteria.onTimeRate, true);
  }
  
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
    return isHigherBetter ?
      (numValue >= threshold ? 'text-success' : 'text-danger') :
      (numValue <= threshold ? 'text-success' : 'text-danger');
  }
  
  // Calendar and date handling for UI
  function displayDateData(selectedDate) {
    if (!selectedDate) return;
    try {
      const dayName = getDayNameFromDate(selectedDate);
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
  
  function initializeWeeklyCalendar() {
    const calendarContainer = document.getElementById('calendarContainer');
    if (!calendarContainer) return;
    calendarContainer.innerHTML = '';
    const calendarHeader = document.createElement('div');
    calendarHeader.className = 'calendar-header d-flex justify-content-between align-items-center mb-3';
    const weekTitle = document.createElement('h6');
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
    const calendarDays = document.createElement('div');
    calendarDays.className = 'calendar-days';
    calendarDays.id = 'calendarDays';
    const selectedDateElement = document.createElement('div');
    selectedDateElement.className = 'selected-date alert alert-info mt-2 mb-0 py-2 px-3';
    selectedDateElement.id = 'selectedDate';
    selectedDateElement.style.fontSize = '13px';
    calendarContainer.appendChild(calendarHeader);
    calendarContainer.appendChild(calendarDays);
    calendarContainer.appendChild(selectedDateElement);
    updateCalendar(new Date());
    document.getElementById('prevWeekBtn').addEventListener('click', function () {
      const selectedDayEl = document.querySelector('.calendar-day.selected');
      if (selectedDayEl) {
        const selectedDate = new Date(selectedDayEl.getAttribute('data-date'));
        selectedDate.setDate(selectedDate.getDate() - 7);
        displayDateData(selectedDate);
        updateCalendar(selectedDate);
      }
    });
    document.getElementById('nextWeekBtn').addEventListener('click', function () {
      const selectedDayEl = document.querySelector('.calendar-day.selected');
      if (selectedDayEl) {
        const selectedDate = new Date(selectedDayEl.getAttribute('data-date'));
        selectedDate.setDate(selectedDate.getDate() + 7);
        displayDateData(selectedDate);
        updateCalendar(selectedDate);
      }
    });
    document.getElementById('todayBtn').addEventListener('click', function () {
      const today = new Date();
      const todayEl = document.querySelector(`.calendar-day[data-date="${today.toISOString().split('T')[0]}"]`);
      if (todayEl) {
        todayEl.classList.add('selected');
        const selectedDate = new Date(today);
        selectedDate.setDate(selectedDate.getDate() - 7);
        displayDateData(selectedDate);
        updateCalendar(today);
      }
    });
  }
  
  function updateCalendar(referenceDate) {
    const { monday, saturday } = getWeekBounds(referenceDate);
    currentWeekStart = new Date(monday);
    const weekTitle = document.getElementById('weekTitle');
    if (weekTitle) {
      weekTitle.textContent = `Week of ${monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
    }
    const calendarDays = document.getElementById('calendarDays');
    if (calendarDays) {
      calendarDays.innerHTML = '';
      for (let i = 0; i < 6; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const dayName = date.toLocaleString('en-US', { weekday: 'short' });
        const dayNum = date.getDate();
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day text-center p-2';
        dayElement.setAttribute('data-date', date.toISOString().split('T')[0]);
        const isToday = isSameDay(date, new Date());
        const dayFullName = getDayNameFromDate(date);
        const hasData = !!apiEndpoints[dayFullName];
        if (dayFullName !== getDayNameFromDate(new Date())) {
          dayElement.classList.add('disabled');
        } else {
          dayElement.addEventListener('click', function () {
            document.querySelectorAll('.calendar-day').forEach(day => day.classList.remove('selected'));
            this.classList.add('selected');
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
      const today = new Date();
      const todayEl = document.querySelector(`.calendar-day[data-date="${today.toISOString().split('T')[0]}"]`);
      if (todayEl && !todayEl.classList.contains('disabled')) {
        todayEl.classList.add('selected');
        displayDateData(today);
      } else {
        const firstEnabledDay = document.querySelector('.calendar-day:not(.disabled)');
        if (firstEnabledDay) {
          firstEnabledDay.classList.add('selected');
          const dateStr = firstEnabledDay.getAttribute('data-date');
          displayDateData(new Date(dateStr));
        }
      }
    }
    updateTodayButtonVisibility();
  }
  
  function isSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() && 
           date1.getMonth() === date2.getMonth() && 
           date1.getFullYear() === date2.getFullYear();
  }
  
  function updateTodayButtonVisibility() {
    const todayBtn = document.getElementById('todayBtn');
    if (!todayBtn || !currentWeekStart) return;
    const today = new Date();
    const { monday } = getWeekBounds(today);
    todayBtn.style.display = (currentWeekStart.getTime() === monday.getTime()) ? 'none' : 'block';
  }
  
  // Sidebar and page navigation
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
  
  // Event listener for calendar day click (in case any day element is added later)
  document.getElementById('calendarDays')?.addEventListener('click', function(event) {
    const selectedDay = event.target.closest('.calendar-day');
    if (selectedDay) {
      const dateStr = selectedDay.getAttribute('data-date');
      displayDateData(new Date(dateStr));
    }
  });
  
  // Initialize dashboard on page load
  document.addEventListener('DOMContentLoaded', function() {
    try {
      initializeWeeklyCalendar();
      setInterval(() => {
        const currentDay = new Date().toLocaleString('en-US', { weekday: 'long' });
        if (apiEndpoints[currentDay]) {
          fetchPerformanceData(currentDay).catch(error => {
            console.error(`Error fetching performance data for ${currentDay}:`, error);
            showErrorMessage(`Error fetching performance data for ${currentDay}`);
          });
        } else {
          console.warn(`No API endpoint for ${currentDay}.`);
        }
      }, 300000);
    } catch (error) {
      console.error('Error during initialization:', error);
      showErrorMessage('Error initializing the dashboard');
    }
  });