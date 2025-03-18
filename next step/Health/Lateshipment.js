// All available shops array
const allShops = [
  'All Shops',  
  'Adelmar', 'Bahemas', 'Bidarimu', 'Chairsy',
  'Das.Nature', 'Das.Nature2', 'Dutchgaming',
  'Emas Gift', 'Flashree', 'Fynnkoffer', 'Hiranai',
  'Jagerhelmet', 'Karlmobel', 'Martenkaiser',
  'Masongym', 'Murahya', 'ValueSnap'
];

// Platform-specific configurations
const platforms = {
'shopee-my': {
  buttonId: 'shopeeMyShopButton',
  menuId: 'shopeeMyShopMenu',
  tableBodyId: 'shopeeMyOrdersTableBody',
  dateRangeId: 'shopeeMyDateRangeInput',
  apiEndpoint: 'https://2zhz9n54-8000.asse.devtunnels.ms/shopee-late-shipment/'
},
'shopee-sg': {
  buttonId: 'shopeeSgShopButton',
  menuId: 'shopeeSgShopMenu',
  tableBodyId: 'shopeeSgOrdersTableBody',
  dateRangeId: 'shopeeSgDateRangeInput',
  apiEndpoint: 'https://2zhz9n54-8000.asse.devtunnels.ms/shopee-sg-late-shipment/'
},
'tiktok': {
  buttonId: 'tiktokShopButton',
  menuId: 'tiktokShopMenu',
  tableBodyId: 'tiktokOrdersTableBody',
  dateRangeId: 'tiktokDateRangeInput',
  apiEndpoint: 'https://2zhz9n54-8000.asse.devtunnels.ms/tiktok-late-shipment/'
}
};

// Initialize all platform interfaces
document.addEventListener('DOMContentLoaded', () => {
// Initialize each platform
Object.keys(platforms).forEach(platform => {
  initializePlatform(platform);
});

// Add CSS for remark editing
addRemarkEditingStyles();
});

// Function to add CSS styles for remark editing
function addRemarkEditingStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .remark-container {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .remark-input {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 5px 8px;
      font-size: 14px;
      width: 100%;
      transition: border-color 0.3s;
    }
    
    .remark-input:focus {
      border-color: #4a90e2;
      outline: none;
      box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
    }
    
    .save-remark-btn {
      background-color: #4a90e2;
      color: white;
      border: none;
      border-radius: 4px;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    
    .save-remark-btn:hover {
      background-color: #3a7fcf;
    }
    
    .save-remark-btn:disabled {
      background-color: #b5b5b5;
      cursor: not-allowed;
    }
    
    .loading-spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s ease-in-out infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .success-highlight {
      background-color: rgba(76, 175, 80, 0.1);
      border-color: #4caf50;
    }
    
    .notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 15px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      z-index: 1000;
      opacity: 1;
      transition: opacity 0.5s;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }
    
    .notification.success {
      background-color: #4caf50;
    }
    
    .notification.error {
      background-color: #f44336;
    }
    
    .notification.info {
      background-color: #2196f3;
    }
    
    .notification.fade-out {
      opacity: 0;
    }
  `;
  document.head.appendChild(styleElement);
}

// Function to initialize a specific platform
function initializePlatform(platformKey) {
const config = platforms[platformKey];
const shopButton = document.getElementById(config.buttonId);
const shopMenu = document.getElementById(config.menuId);
const ordersTableBody = document.getElementById(config.tableBodyId);

if (!shopButton || !shopMenu || !ordersTableBody) {
  console.error(`Required elements for ${platformKey} not found in DOM`);
  return;
}

// Setup shop menu
setupShopMenu(shopMenu);

// Toggle shop menu
let isShopMenuOpen = false;

shopButton.addEventListener('click', () => {
  isShopMenuOpen = !isShopMenuOpen;
  shopMenu.classList.toggle('hidden', !isShopMenuOpen);
});

// Close shop menu when clicking outside
document.addEventListener('click', (e) => {
  if (!shopButton.contains(e.target) && !shopMenu.contains(e.target)) {
    isShopMenuOpen = false;
    shopMenu.classList.add('hidden');
  }
});

// Shop selection event listener
document.querySelectorAll(`#${config.menuId} .shop-option`).forEach(option => {
  option.addEventListener('click', () => {
    const selectedShop = option.getAttribute('data-shop');
    shopButton.innerHTML = `${selectedShop} 
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="icon">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>`;
    isShopMenuOpen = false;
    shopMenu.classList.add('hidden');
    renderOrders(selectedShop, platformKey);
  });
});

// Setup date picker
setupDatePicker(config.dateRangeId, platformKey);

// Initial render
renderOrders('All Shops', platformKey);
}

// Add shop options to the dropdown
function setupShopMenu(shopMenuElement) {
shopMenuElement.innerHTML = allShops.map(shop => `
  <button class="shop-option" data-shop="${shop}">${shop}</button>
`).join('');
}

// Setup date picker for a specific platform
function setupDatePicker(dateRangeId, platformKey) {
const dateRangeInput = document.getElementById(dateRangeId);

if (dateRangeInput) {
  // Initialize flatpickr
  const picker = flatpickr(dateRangeInput, {
    mode: "range",
    dateFormat: "d/m/Y",
    altFormat: "d/m/Y",
    altInput: true,
    onChange: function(selectedDates, dateStr) {
      if (selectedDates.length === 2) {
        console.log(`Date range selected: ${selectedDates[0]} to ${selectedDates[1]}`);
        // Filter shipments by date range when two dates are selected
        filterShipmentsByDateRange(selectedDates[0], selectedDates[1], platformKey);
      }
    }
  });
  
  console.log(`Date picker initialized for ${platformKey}`);
} else {
  console.error(`Date range input element not found for ${platformKey}`);
}
}

// Safe Date Formatting (Fixes `Invalid time value` issue)
function formatDate(dateString) {
// If date is null, undefined, or empty
if (!dateString) {
  return "No Date";
}

try {
  // For API dates like "22/02/2025"
  if (typeof dateString === 'string' && dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    const [day, month, year] = dateString.split('/');
    
    // Create a date from day/month/year
    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    
    if (!isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric'
      }).format(date);
    }
  }
  
  // For other date formats, try direct parsing
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    }).format(date);
  }
  
  // If all parsing attempts fail
  return dateString; // Return the original string if we can't parse it
} catch (error) {
  console.error("Error formatting date:", error, dateString);
  return dateString; // Return the original string in case of errors
}
}

// Function to update remark to the server
async function updateRemark(platformKey, orderId, newRemark) {
  try {
    const config = platforms[platformKey];
    const apiUrl = `${config.apiEndpoint}update-remark/`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        remark: newRemark
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update remark. HTTP Status: ${response.status}`);
    }

    // Show success message
    showNotification('Remark updated successfully', 'success');
    return true;
  } catch (error) {
    console.error(`Error updating remark for ${platformKey}:`, error);
    showNotification(`Error updating remark: ${error.message}`, 'error');
    return false;
  }
}

// Add this function to show notifications
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}

// Fetch shipments for a specific platform
async function fetchShipments(platformKey) {
  try {
    const config = platforms[platformKey];
    const response = await fetch(config.apiEndpoint);

    if (!response.ok) {
      throw new Error(`Failed to fetch shipments. HTTP Status: ${response.status}`);
    }

    const data = await response.json();

    // If platformKey is 'tiktok', map the TikTok fields:
    if (platformKey === 'tiktok') {
      return data.map(shipment => ({
        id: shipment.order_id || "N/A",
        date: shipment.date_ordered || "Invalid Date",
        shop: shipment.shop_name || "Unknown Shop",
        product: shipment.sku || "Unknown Product",
        shippingChannel: shipment.courier_name || "N/A",
        status: shipment.shipment_status || "N/A",
        remark: shipment.shipment_caution || " "
      }));
    }

    // Otherwise, assume Shopee-style mapping
    return data.map(shipment => ({
      id: shipment.order_id || "N/A",
      date: shipment.date || "Invalid Date",
      shop: shipment.shop_name || "Unknown Shop",
      product: shipment.skus || "Unknown Product",
      shippingChannel: shipment.courier || "N/A",
      status: shipment.status || "N/A",
      remark: shipment.remark || " "
    }));
  } catch (error) {
    console.error(`Error fetching shipments for ${platformKey}:`, error);
    return [];
  }
}

// Render orders based on selected shop and platform
async function renderOrders(selectedShop = 'All Shops', platformKey) {
const config = platforms[platformKey];
const ordersTableBody = document.getElementById(config.tableBodyId);

if (!ordersTableBody) {
  console.error(`Orders table body element not found for ${platformKey}`);
  return;
}

// Show loading indicator
ordersTableBody.innerHTML = `
  <tr>
    <td colspan="7" class="text-center py-4">Loading orders...</td>
  </tr>
`;

let shipments = await fetchShipments(platformKey);

// Filter shipments if a shop is selected (excluding 'All Shops')
if (selectedShop !== 'All Shops') {
  shipments = shipments.filter(shipment => shipment.shop.toLowerCase() === selectedShop.toLowerCase());
}

if (shipments.length === 0) {
  ordersTableBody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center py-4">No Orders Found for ${selectedShop}</td>
    </tr>
  `;
  return;
}

ordersTableBody.innerHTML = shipments.map(shipment => ` 
  <tr>
    <td>${shipment.id}</td>
    <td>${formatDate(shipment.date)}</td>
    <td>${shipment.shop}</td>
    <td>${shipment.product}</td>
    <td>${shipment.shippingChannel}</td>
    <td><span class="status-badge">${shipment.status}</span></td>
    <td>
      <div class="remark-container">
        <input type="text" class="remark-input" value="${shipment.remark || ''}" 
               data-order-id="${shipment.id}" data-platform="${platformKey}">
        <button class="save-remark-btn" title="Save Remark">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
          </svg>
        </button>
      </div>
    </td>
  </tr>
`).join('');

// Add event listeners to the save buttons
ordersTableBody.querySelectorAll('.save-remark-btn').forEach(button => {
  button.addEventListener('click', async function() {
    const inputElement = this.previousElementSibling;
    const orderId = inputElement.getAttribute('data-order-id');
    const platform = inputElement.getAttribute('data-platform');
    const newRemark = inputElement.value;
    
    // Disable input and button while saving
    inputElement.disabled = true;
    this.disabled = true;
    
    // Show loading state
    this.innerHTML = `<span class="loading-spinner"></span>`;
    
    // Call the update function
    const success = await updateRemark(platform, orderId, newRemark);
    
    // Re-enable input and update UI
    inputElement.disabled = false;
    this.disabled = false;
    
    // Restore button icon
    this.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
      </svg>
    `;
    
    if (success) {
      // Visual feedback on success
      inputElement.classList.add('success-highlight');
      setTimeout(() => {
        inputElement.classList.remove('success-highlight');
      }, 2000);
    }
  });
});
}

function parseShipmentDate(dateString) {
if (!dateString) return null;

// For "DD/MM/YYYY" format from the API
if (typeof dateString === 'string' && dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
  const [day, month, year] = dateString.split('/');
  // Set time to noon to avoid timezone issues
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
}

// Try standard parsing as fallback
const date = new Date(dateString);
return isNaN(date.getTime()) ? null : date;
}

// Filter shipments by date range for a specific platform
async function filterShipmentsByDateRange(startDate, endDate, platformKey) {
try {
  const config = platforms[platformKey];
  const ordersTableBody = document.getElementById(config.tableBodyId);
  const shopButton = document.getElementById(config.buttonId);
  
  if (!ordersTableBody || !shopButton) {
    console.error(`Required elements not found for ${platformKey}`);
    return;
  }
  
  // Show loading indicator
  ordersTableBody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center py-4">Filtering orders...</td>
    </tr>
  `;
  
  // Get all shipments
  let shipments = await fetchShipments(platformKey);
  
  // Get currently selected shop
  const selectedShop = shopButton.textContent.trim().split(' ')[0];
  
  // Filter by shop if needed
  if (selectedShop !== 'All' && selectedShop !== 'Choose') {
    shipments = shipments.filter(shipment => 
      shipment.shop && shipment.shop.toLowerCase() === selectedShop.toLowerCase()
    );
  }
  
  console.log(`Filtering by date range: ${startDate} to ${endDate}`);
  console.log(`Total shipments before filtering: ${shipments.length}`);
  
  // Remove time component from selected dates for comparison
  const startDateNoTime = new Date(startDate);
  startDateNoTime.setHours(0, 0, 0, 0);
  
  const endDateNoTime = new Date(endDate);
  endDateNoTime.setHours(23, 59, 59, 999);
  
  // Filter by date range
  shipments = shipments.filter(shipment => {
    const shipmentDate = parseShipmentDate(shipment.date);
    
    return shipmentDate && 
           shipmentDate >= startDateNoTime && 
           shipmentDate <= endDateNoTime;
  });
  
  console.log(`Filtered shipments count: ${shipments.length}`);
  
  // Render the filtered shipments
  if (shipments.length === 0) {
    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4">No shipments found in selected date range</td>
      </tr>
    `;
  } else {
    // Render the filtered shipments
    ordersTableBody.innerHTML = shipments.map(shipment => {
      const formattedDate = formatDate(shipment.date);
      
      let statusClass = "status-badge";
      if (shipment.status && shipment.status.toLowerCase().includes("to ship")) {
        statusClass += " to-ship";
      }
      
      return `
        <tr>
          <td>${shipment.id || "N/A"}</td>
          <td>${formattedDate}</td>
          <td>${shipment.shop || "Unknown Shop"}</td>
          <td>${shipment.product || "Unknown Product"}</td>
          <td>${shipment.shippingChannel || "N/A"}</td>
          <td><span class="${statusClass}">${shipment.status || "N/A"}</span></td>
          <td>
            <div class="remark-container">
              <input type="text" class="remark-input" value="${shipment.remark || ''}" 
                    data-order-id="${shipment.id}" data-platform="${platformKey}">
              <button class="save-remark-btn" title="Save Remark">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    // Add event listeners to the save buttons
    ordersTableBody.querySelectorAll('.save-remark-btn').forEach(button => {
      button.addEventListener('click', async function() {
        const inputElement = this.previousElementSibling;
        const orderId = inputElement.getAttribute('data-order-id');
        const platform = inputElement.getAttribute('data-platform');
        const newRemark = inputElement.value;
        
        // Disable input and button while saving
        inputElement.disabled = true;
        this.disabled = true;
        
        // Show loading state
        this.innerHTML = `<span class="loading-spinner"></span>`;
        
        // Call the update function
        const success = await updateRemark(platform, orderId, newRemark);
        
        // Re-enable input and update UI
        inputElement.disabled = false;
        this.disabled = false;
        
        // Restore button icon
        this.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
          </svg>
        `;
        
        if (success) {
          // Visual feedback on success
          inputElement.classList.add('success-highlight');
          setTimeout(() => {
            inputElement.classList.remove('success-highlight');
          }, 2000);
        }
      });
    });
  }
} catch (error) {
  console.error(`Error filtering by date range for ${platformKey}:`, error);
  ordersTableBody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center py-4">Error filtering shipments: ${error.message}</td>
    </tr>
  `;
}
}