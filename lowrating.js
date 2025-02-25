document.addEventListener('DOMContentLoaded', function () {
    // Cache DOM elements
    const shopButton = document.querySelector('.low-rating-shop-button');
    const starsButton = document.querySelector('#low-rating-stars-button');
    const shopMenu = document.querySelector('.low-rating-shop-menu');
    const starsMenu = document.querySelector('.low-rating-stars-menu');
    const tableBody = document.querySelector('#low-rating-orders-table-body');
    const commentModal = document.querySelector('#commentModal');
    const startDateInput = document.querySelector('#startDate');
    const endDateInput = document.querySelector('#endDate');
    
    if (!shopButton || !starsButton || !shopMenu || !starsMenu || !tableBody || !commentModal) {
        console.error('Required elements not found');
        return;
    }

    // Initialize flatpickr for date inputs
    flatpickr(startDateInput, {
        enableTime: false,
        dateFormat: "Y-m-d",
        onChange: function(selectedDates) {
            startDate = selectedDates[0] ? selectedDates[0].toISOString().split('T')[0] : '';
            filterData();
        }
    });

    flatpickr(endDateInput, {
        enableTime: false,
        dateFormat: "Y-m-d",
        onChange: function(selectedDates) {
            endDate = selectedDates[0] ? selectedDates[0].toISOString().split('T')[0] : '';
            filterData();
        }
    });

    let selectedShop = ''; // Default to empty string
    let selectedStars = '';
    let startDate = '';
    let endDate = '';

    // Add styles for the modal images
    const style = document.createElement('style');
    style.textContent = `
        .modal-image-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            padding: 1rem;
        }
        
        .modal-image-wrapper {
            position: relative;
            aspect-ratio: 1;
            overflow: hidden;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.3s ease;
        }
        
        .review-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s ease;
        }
        
        .modal-image-wrapper.zoomed {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90vw;
            height: 90vh;
            z-index: 1060;
            background: rgba(0, 0, 0, 0.9);
            border-radius: 0;
        }
        
        .modal-image-wrapper.zoomed .review-image {
            object-fit: contain;
            width: 100%;
            height: 100%;
        }
        
        .modal-backdrop.zoomed {
            opacity: 0.9;
        }
    `;
    document.head.appendChild(style);

    const lowRatingOrders = [
        {
          "date": "2025-02-14",
          "shop": "Hiranai",
          "orderId": "250125CNP5BE1E",
          "username": "has_merya",
          "stars": 1,
          "item": "Women Dress Kaftan-Batik Muslim Bat Sleeves Cotton Hemp Loose Long Vintage Beach Dress Short Sleeve Maxi Dress",
          "comment": "Material:cotton nipis Comfortability:comfortable",
          "pictures": []
        },
        {
          "date": "2025-02-14",
          "shop": "Hiranai",
          "orderId": "250209P873180W",
          "username": "qaininiey",
          "stars": 1,
          "item": "Men Short Sleeve Shirt Baju Kemeja Lelaki Lengan Pendek Summer Korean Style Fashion Ice Silk Abstinence Top",
          "comment": "",
          "pictures": []
        },
        {
          "date": "2025-02-13",
          "shop": "Hiranai",
          "orderId": "250206FU4VHP90",
          "username": "ainaalisa195",
          "stars": 1,
          "item": "Women Sweater Shirt Knit Top Long Sleeve Loose Fit Blouse Baju Perempuan Lengan Panjang",
          "comment": "kain nipis sangat pengahantaran pun lambat 5hari bru sampai,  baju agak singkat untuk tinggi 150+",
          "pictures": []
        },
        {
          "date": "2025-02-13",
          "shop": "Hiranai",
          "orderId": "250210T6K11WAV",
          "username": "izatishahira",
          "stars": 1,
          "item": "Women Cotton Western Sweater Top Checkered Knit Vest V-Neck Sleeveless Style Fashion Knitwear",
          "comment": "Kecik",
          "pictures": [
            "https://cf.shopee.com.my/file/my-11134103-7rasl-m66mkysue5ih08",
            "https://cf.shopee.com.my/file/my-11134103-7rasi-m66mkysufk6g0d"
          ]
        },
        {
          "date": "2025-02-13",
          "shop": "Hiranai",
          "orderId": "250212W0M6EFWF",
          "username": "renaldijulio800",
          "stars": 1,
          "item": "Men Short Sleeve Shirt Baju Kemeja Lelaki Lengan Pendek Summer Korean Style Fashion Ice Silk Abstinence Top",
          "comment": "",
          "pictures": []
        },
        {
          "date": "2025-02-13",
          "shop": "Hiranai",
          "orderId": "250209Q6P6AXPP",
          "username": "hafizfahusna",
          "stars": 1,
          "item": "Polo Shirt For Woman Men T-Shirt Loose Sleeves Oversized Unisex Foldover Collar Korean Style American Vintage Retro",
          "comment": "",
          "pictures": []
        },
        {
          "date": "2025-02-13",
          "shop": "Hiranai",
          "orderId": "250204A4PFWJVR",
          "username": "",
          "stars": 1,
          "item": "Women Sleeveless Spaghetti Strap Top Sleeveless Blouse Shirt Causal Fashion",
          "comment": "",
          "pictures": []
        },
        {
          "date": "2025-02-08",
          "shop": "Wilmermobel",
          "orderId": "250206FVEX6NHC",
          "username": "mdselimmia",
          "stars": 1,
          "item": "Tortilla Press Maker Foldable Cast Iron Corn Tortillas Dough Pressing Tool Kitchen Supplies",
          "comment": "Functionality:Liar, 20 cm in the picture but its 16 cm",
          "pictures": [
            "https://cf.shopee.com.my/file/my-11134103-7ras8-m5zi0ff4e05v13",
            "https://cf.shopee.com.my/file/my-11134103-7ras8-m5zi0raf0pjn97"
          ]
        },
        {
          "date": "2025-02-08",
          "shop": "Wilmermobel",
          "orderId": "250212X7JMKTSW",
          "username": "zeelafaeza",
          "stars": 2,
          "item": "Wooden Kitchen Set Toy for Kids, Role Play Kitchen Set with Accessories",
          "comment": "Not as expected, didn't meet the description. Poor quality.",
          "pictures": []
        },
        {
          "date": "2025-02-07",
          "shop": "Wilmermobel",
          "orderId": "250201P3P3C52S",
          "username": "johnnygrape",
          "stars": 4,
          "item": "Compact Modern Coffee Table, White and Black Design",
          "comment": "Good quality, easy to assemble, but one leg was slightly damaged.",
          "pictures": [
            "https://cf.shopee.com.my/file/my-11134103-7ras8-m5zi0ff4e05v13"
          ]
        },
        {
          "date": "2025-02-06",
          "shop": "Wilmermobel",
          "orderId": "250202A2VTF8N4",
          "username": "janetbydesign",
          "stars": 5,
          "item": "Ergonomic Office Chair, Adjustable Seat and Armrest",
          "comment": "Excellent chair, very comfortable, highly recommended!",
          "pictures": [
            "https://cf.shopee.com.my/file/my-11134103-7ras8-m5zi0ff4e05v13",
            "https://cf.shopee.com.my/file/my-11134103-7ras8-m5zi0raf0pjn97"
          ]
        },
        {
          "date": "2025-02-05",
          "shop": "Wilmermobel",
          "orderId": "250207K6PVMX39",
          "username": "fitzgerald29",
          "stars": 3,
          "item": "Adjustable Wooden Shelf for Living Room",
          "comment": "It's okay. Sturdy but took longer than expected to arrive.",
          "pictures": []
        },
        {
          "date": "2025-02-04",
          "shop": "Wilmermobel",
          "orderId": "250201QXP57E6V",
          "username": "lilithstar",
          "stars": 1,
          "item": "Luxury Memory Foam Mattress Topper, Queen Size",
          "comment": "Horrible, nothing like the picture. Very disappointed.",
          "pictures": [
            "https://cf.shopee.com.my/file/my-11134103-7ras8-m5zi0ff4e05v13"
          ]
        },
        {
          "date": "2025-02-03",
          "shop": "Wilmermobel",
          "orderId": "250202FWWEK4L9",
          "username": "chrispino",
          "stars": 2,
          "item": "Industrial Style Wall Shelf, Black and Gold",
          "comment": "Came damaged and I had to fix it myself.",
          "pictures": [
            "https://cf.shopee.com.my/file/my-11134103-7ras8-m5zi0ff4e05v13"
          ]
        },
        {
          "date": "2025-02-02",
          "shop": "Wilmermobel",
          "orderId": "250209L8EK5U4J",
          "username": "georgeknight",
          "stars": 4,
          "item": "Portable Blender, Rechargeable USB Blender for Smoothies",
          "comment": "Works well, but the battery life is shorter than expected.",
          "pictures": []
        },
        {
          "date": "2025-02-01",
          "shop": "Wilmermobel",
          "orderId": "250210C8KFVN3Z",
          "username": "lisamarie23",
          "stars": 5,
          "item": "Smart Electric Kettle, Fast Boiling",
          "comment": "Love it! Fast boiling and looks sleek on the counter.",
          "pictures": [
            "https://cf.shopee.com.my/file/my-11134103-7ras8-m5zi0ff4e05v13"
          ]
        }
    ];

    // Function to close all menus
    function closeAllMenus() {
        shopMenu.classList.add('hidden');
        starsMenu.classList.add('hidden');
    }

    // Toggle shop menu
    shopButton.addEventListener('click', function(e) {
        e.stopPropagation();
        starsMenu.classList.add('hidden');
        shopMenu.classList.toggle('hidden');
    });

    // Toggle stars menu
    starsButton.addEventListener('click', function(e) {
        e.stopPropagation();
        shopMenu.classList.add('hidden');
        starsMenu.classList.toggle('hidden');
    });

    // Close menus when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.low-rating-selector')) {
            closeAllMenus();
        }
    });

    // Handle shop selection
    document.querySelectorAll('.low-rating-shop-option').forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            selectedShop = this.dataset.shop;
            shopButton.textContent = selectedShop;
            const icon = document.createElement('svg');
            icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            icon.setAttribute('fill', 'none');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('stroke-width', '1.5');
            icon.setAttribute('stroke', 'currentColor');
            icon.setAttribute('class', 'icon');
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />';
            shopButton.appendChild(icon);
            closeAllMenus();
            filterData();
        });
    });

    // Handle stars selection
    document.querySelectorAll('.low-rating-stars-option').forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            selectedStars = this.dataset.stars;
            if (selectedStars === 'all') {
                starsButton.textContent = 'All Stars';
            } else {
                starsButton.textContent = `${selectedStars} Star${selectedStars > 1 ? 's' : ''}`;
            }
            const icon = document.createElement('svg');
            icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            icon.setAttribute('fill', 'none');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('stroke-width', '1.5');
            icon.setAttribute('stroke', 'currentColor');
            icon.setAttribute('class', 'icon');
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />';
            starsButton.appendChild(icon);
            closeAllMenus();
            filterData();
        });
    });

    // Filter data based on selections
    function filterData() {
        if (!selectedShop || selectedShop === '') {
            showMessage('Please select a shop');
            return;
        }

        let filteredOrders = [...lowRatingOrders];

        if (startDate) {
            filteredOrders = filteredOrders.filter(order => order.date >= startDate);
        }
        if (endDate) {
            filteredOrders = filteredOrders.filter(order => order.date <= endDate);
        }

        if (selectedShop && selectedShop !== 'All Shops' && selectedShop !== 'All shops') {
            filteredOrders = filteredOrders.filter(order => order.shop === selectedShop);
        }

        if (selectedStars && selectedStars !== 'all') {
            filteredOrders = filteredOrders.filter(order => order.stars === parseInt(selectedStars));
        }

        if (filteredOrders.length === 0) {
            showMessage('No orders found');
            return;
        }

        populateTable(filteredOrders);
    }

    // Function to show messages in the table body
    function showMessage(message) {
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    ${message}
                </td>
            </tr>
        `;
    }

    // Populate table with filtered data
    function populateTable(orders) {
        if (!tableBody) return;
        
        tableBody.innerHTML = '';

        orders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.date}</td>
                <td>${order.shop}</td>
                <td>${order.orderId}</td>
                <td>${order.username}</td>
                <td>${order.stars} Stars</td>
                <td>${order.item}</td>
                <td>
                    <button 
                        class="btn btn-info view-comment-btn" 
                        data-bs-toggle="modal" 
                        data-bs-target="#commentModal"
                        data-comment="${order.comment || ''}"
                        data-pictures='${JSON.stringify(order.pictures)}'
                    >
                        View Comment
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add click handlers for view comment buttons
        document.querySelectorAll('.view-comment-btn').forEach(button => {
            button.addEventListener('click', function() {
                const comment = this.getAttribute('data-comment');
                let pictures = [];
                try {
                    pictures = JSON.parse(this.getAttribute('data-pictures') || '[]');
                } catch (e) {
                    console.error('Error parsing pictures:', e);
                    pictures = [];
                }

                const modalComment = document.querySelector('#modal-comment');
                const modalPictures = document.querySelector('#modal-pictures');
                
                if (modalComment) {
                    modalComment.textContent = comment || 'No comment provided';
                }

                if (modalPictures) {
                    modalPictures.innerHTML = '';
                    if (pictures.length === 0) {
                        modalPictures.innerHTML = '<p>No images available</p>';
                    } else {
                        const container = document.createElement('div');
                        container.className = 'modal-image-container';
                        
                        pictures.forEach(pic => {
                            if (pic && pic.trim() !== '') {
                                const wrapper = document.createElement('div');
                                wrapper.className = 'modal-image-wrapper';
                                
                                const img = document.createElement('img');
                                img.src = pic;
                                img.alt = 'Review Picture';
                                img.className = 'review-image';
                                
                                wrapper.appendChild(img);
                                container.appendChild(wrapper);
                                
                                // Add click handler for image zoom
                                wrapper.addEventListener('click', function() {
                                    this.classList.toggle('zoomed');
                                    if (this.classList.contains('zoomed')) {
                                        document.body.style.overflow = 'hidden';
                                    } else {
                                        document.body.style.overflow = '';
                                    }
                                });
                            }
                        });
                        
                        modalPictures.appendChild(container);
                    }
                }
            });
        });

        // Close zoomed images when clicking outside
        document.addEventListener('click', function(e) {
            const zoomed = document.querySelector('.modal-image-wrapper.zoomed');
            if (zoomed && !e.target.closest('.modal-image-wrapper.zoomed')) {
                zoomed.classList.remove('zoomed');
                document.body.style.overflow = '';
            }
        });
    }

    // Initialize table with "Please select a shop" message
    showMessage('Please select a shop');
});