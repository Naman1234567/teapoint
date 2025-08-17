document.addEventListener('DOMContentLoaded', () => {
    const menu = [
        { id: '1', name: 'Matka Chiya', price: 35 },
        { id: '2', name: 'Chiya Normal', price: 30 },
        { id: '3', name: 'Black tea', price: 20 },
        { id: '4', name: 'Lemon Tea', price: 25 },
        { id: '5', name: 'Frooti', price: 30 },
        { id: '6', name: 'Water', price: 25 },
        { id: '7', name: 'Surya Red', price: 25 },
        { id: '8', name: 'Surya Fusion', price: 25 },
        { id: '9', name: 'Shikhar', price: 20 },
        { id: '10', name: 'Brown', price: 20 },
    ];

    const menuContainer = document.getElementById('menu-container');
    const orderButton = document.getElementById('order-button');
    const totalPriceElement = document.getElementById('total-price');
    const tableHeader = document.getElementById('table-header');
    const tableNumberDisplay = document.getElementById('table-number-display');

    // Modal elements
    const statusModal = document.getElementById('status-modal');
    const modalHeading = document.getElementById('modal-heading');
    const modalMessage = document.getElementById('modal-message');
    const closeModalButton = document.querySelector('.close-button');

    const urlParams = new URLSearchParams(window.location.search);
    const currentTableNumber = urlParams.get('table');
    const broadcastChannel = new BroadcastChannel('orders_channel');
    let db;

    // Initialize IndexedDB
    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TeaPointDB', 1);

            request.onerror = (event) => {
                console.error('Database error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                console.log('Database initialized');
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('orders')) {
                    db.createObjectStore('orders', { keyPath: 'id' });
                }
            };
        });
    }

    // Add order to IndexedDB
    function addOrder(order) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');
            const request = store.add(order);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                console.error('Error adding order:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    function renderMenu() {
        menuContainer.innerHTML = '';
        menu.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';
            menuItem.innerHTML = `
                <div class="item-info">
                    <h3>${item.name}</h3>
                    <p>Rs: ${item.price.toFixed(2)}</p>
                </div>
                <div class="item-controls">
                    <input type="number" class="quantity-input" data-item-id="${item.id}" value="0" min="0">
                </div>
            `;
            menuContainer.appendChild(menuItem);
        });
    }

    function updateCart() {
        let total = 0;
        document.querySelectorAll('.quantity-input').forEach(input => {
            const quantity = parseInt(input.value);
            const itemId = input.dataset.itemId;
            const item = menu.find(i => i.id === itemId);
            if (item && quantity > 0) {
                total += item.price * quantity;
            }
        });
        totalPriceElement.textContent = total.toFixed(2);
    }

    async function placeOrder() {
        const orderItems = [];
        let totalOrderPrice = 0;

        document.querySelectorAll('.quantity-input').forEach(input => {
            const quantity = parseInt(input.value);
            const itemId = input.dataset.itemId;
            const item = menu.find(i => i.id === itemId);

            if (item && quantity > 0) {
                orderItems.push({
                    name: item.name,
                    price: item.price,
                    quantity: quantity
                });
                totalOrderPrice += item.price * quantity;
            }
        });

        if (orderItems.length === 0) {
            showModal('No Items Selected', 'Please select some items to place an order.', false);
            return;
        }

        const newOrder = {
            id: Date.now().toString(),
            tableNumber: currentTableNumber,
            items: orderItems,
            total: totalOrderPrice,
            timestamp: new Date().toISOString(),
            synced: false
        };

        try {
            await addOrder(newOrder);
            
            // Broadcast the new order to other tabs
            broadcastChannel.postMessage({
                type: 'new_order',
                order: newOrder
            });

            if (navigator.onLine) {
                // In a real app, you would sync with server here
                // For this demo, we'll just mark as synced
                newOrder.synced = true;
                showModal('Order Placed!', `Your order from Table ${currentTableNumber} has been received.`, true);
            } else {
                showModal('Order Saved', 'Your order has been saved locally and will be synced when online.', true);
            }

            clearCart();
        } catch (error) {
            console.error('Error placing order:', error);
            showModal('Error', 'There was an error placing your order. Please try again.', false);
        }
    }

    function clearCart() {
        document.querySelectorAll('.quantity-input').forEach(input => {
            input.value = 0;
        });
        updateCart();
    }

    function showModal(heading, message, isSuccess) {
        modalHeading.textContent = heading;
        modalMessage.textContent = message;

        const modalIcon = statusModal.querySelector('.modal-icon');
        modalIcon.textContent = isSuccess ? '✅' : '❌';
        modalIcon.style.color = isSuccess ? 'var(--primary-color)' : '#e74c3c';

        statusModal.style.display = 'flex';
    }

    function closeModal() {
        statusModal.style.display = 'none';
    }

    // Set table number in header
    if (tableHeader && tableNumberDisplay) {
        tableHeader.textContent = `☕ Table ${currentTableNumber} - Order ☕`;
        tableNumberDisplay.textContent = `Table: ${currentTableNumber}`;
    }

    // Event listeners
    menuContainer.addEventListener('input', updateCart);
    orderButton.addEventListener('click', placeOrder);
    closeModalButton.addEventListener('click', closeModal);

    window.addEventListener('click', (event) => {
        if (event.target === statusModal) {
            closeModal();
        }
    });

    // Sync when coming back online
    window.addEventListener('online', () => {
        // In a real app, you would sync with server here
        // For this demo, we'll just mark as synced
        showModal('Back Online', 'You are now online. Orders will be synced.', true);
    });

    // Initial render
    initDB().then(() => {
        renderMenu();
        updateCart();
    }).catch(error => {
        console.error('Failed to initialize database:', error);
    });
});