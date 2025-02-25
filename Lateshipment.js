// All available shops array
const allShops = [
    'All Shops',  
    'Adelmar', 'Bahemas', 'Bidarimu', 'Chairsy',
    'Das.Nature', 'Das.Nature2', 'Dutchgaming',
    'Emas Gift', 'Flashree', 'Fynnkoffer', 'Hiranai',
    'Jagerhelmet', 'Karlmobel', 'Martenkaiser',
    'Masongym', 'Murahya', 'ValueSnap'
];

// DOM Elements
const shopButton = document.getElementById('shopButton');
const shopMenu = document.getElementById('shopMenu');
const ordersTableBody = document.getElementById('ordersTableBody');

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

// Safe Date Formatting (Fixes `Invalid time value` issue)
function formatDate(dateString) {
    if (!dateString) {
        console.warn("Skipping invalid date:", dateString);
        return "Invalid Date"; // Default placeholder
    }

    const dateParts = dateString.split(" ");
    if (dateParts.length !== 2) {
        console.warn("Invalid date format:", dateString);
        return "Invalid Date";
    }

    const [day, month, year] = dateParts[0].split("/");
    const time = dateParts[1];

    const formattedDate = `${year}-${month}-${day}T${time}:00`; 

    let date = new Date(formattedDate);
    
    if (isNaN(date.getTime())) {
        console.warn("Invalid converted date:", formattedDate);
        return "Invalid Date";
    }

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);
}

// Fetch all shipments
async function fetchShipments() {
    try {
        console.log("Fetching shipments...");
        const response = await fetch("https://2zhz9n54-8000.asse.devtunnels.ms/shopee-late-shipment/");

        if (!response.ok) {
            throw new Error(`Failed to fetch shipments. HTTP Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("API Response:", data);

        // Map the API data into a more usable format
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
        console.error("Error fetching shipments:", error);
        return [];
    }
}

// Render orders based on selected shop
async function renderOrders(selectedShop = 'All Shops') {
    let shipments = await fetchShipments();

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
            <td>${shipment.remark}</td>
        </tr>
    `).join('');
}

// Add shop options to the dropdown
function setupShopMenu() {
    shopMenu.innerHTML = allShops.map(shop => `
        <button class="shop-option" data-shop="${shop}">${shop}</button>
    `).join('');
}

// Shop selection event listener
document.addEventListener('DOMContentLoaded', () => {
    setupShopMenu(); // Populate the shop menu once the DOM is ready

    // Event listener for shop selection
    document.querySelectorAll('.shop-option').forEach(option => {
        option.addEventListener('click', () => {
            const selectedShop = option.getAttribute('data-shop');
            shopButton.innerHTML = `${selectedShop} 
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                    stroke="currentColor" class="icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>`;
            isShopMenuOpen = false;
            shopMenu.classList.add('hidden');
            renderOrders(selectedShop); // Re-render with selected shop
        });
    });

    // Initial render with no shop selected (default)
    renderOrders();
});
