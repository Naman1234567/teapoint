document.addEventListener('DOMContentLoaded', () => {
    const ordersContainer = document.getElementById('orders-container');
    const refreshButton = document.getElementById('refresh-button');
    const notificationSound = document.getElementById('notification-sound');
    const tableSelect = document.getElementById('table-select');
    const billTableHeader = document.getElementById('bill-table-header');
    const billItemsBody = document.getElementById('bill-items-body');
    const billTotalAmount = document.getElementById('bill-total-amount');
    const markPaidButton = document.getElementById('mark-paid-button');
    const billDetails = document.getElementById('bill-details');
    const enableSoundButton = document.getElementById('enable-sound-button');
    const soundPrompt = document.getElementById('sound-prompt');

    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;

            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update active tab content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');

            // Refresh bill if billing tab is selected
            if (tabId === 'billing' && tableSelect.value) {
                generateBillForTable(tableSelect.value);
            }
        });
    });

    let previousOrders = [];
    let db;
    const broadcastChannel = new BroadcastChannel('orders_channel');
    let isSoundEnabled = false;

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

    // Get all orders from IndexedDB
    function getAllOrders() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = (event) => {
                console.error('Error getting orders:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Delete order from IndexedDB
    function deleteOrder(orderId) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');
            const request = store.delete(orderId);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                console.error('Error deleting order:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Delete all orders for a table from IndexedDB
    function deleteTableOrders(tableNumber) {
        return new Promise((resolve, reject) => {
            getAllOrders().then(orders => {
                const ordersToDelete = orders.filter(order => order.tableNumber === tableNumber);
                const transaction = db.transaction(['orders'], 'readwrite');
                const store = transaction.objectStore('orders');
                
                ordersToDelete.forEach(order => {
                    store.delete(order.id);
                });

                transaction.oncomplete = () => {
                    resolve();
                };

                transaction.onerror = (event) => {
                    console.error('Error deleting table orders:', event.target.error);
                    reject(event.target.error);
                };
            });
        });
    }

    function playNotificationSound() {
        if (notificationSound && isSoundEnabled) {
            notificationSound.currentTime = 0;
            notificationSound.play().catch(e => console.log("Audio play failed:", e));
        }
    }

    async function renderOrders() {
        try {
            const currentOrders = await getAllOrders();

            // Identify new orders by checking if they are not in the previousOrders array
            const newOrders = currentOrders.filter(
                currentOrder => !previousOrders.some(prevOrder => prevOrder.id === currentOrder.id)
            );

            // Play sound if new orders exist
            if (newOrders.length > 0) {
                playNotificationSound();
            }

            // Group orders by table
            const tables = {};
            currentOrders.forEach(order => {
                if (!tables[order.tableNumber]) {
                    tables[order.tableNumber] = [];
                }
                tables[order.tableNumber].push(order);
            });

            ordersContainer.innerHTML = '';

            // Display orders by table
            const sortedTableNumbers = Object.keys(tables).sort((a, b) => parseInt(a) - parseInt(b));
            sortedTableNumbers.forEach(tableNumber => {
                const tableSection = document.createElement('div');
                tableSection.className = 'table-section';
                tableSection.innerHTML = `<h2 class="table-header">Table ${tableNumber}</h2>`;

                tables[tableNumber].forEach(order => {
                    const orderCard = document.createElement('div');
                    orderCard.className = 'order-card';
                    // Add the 'new-order' class if it's a new order
                    if (newOrders.some(newOrder => newOrder.id === order.id)) {
                        orderCard.classList.add('new-order');
                        setTimeout(() => {
                            orderCard.classList.remove('new-order');
                        }, 15000); // Remove class after 15 seconds
                    }
                    orderCard.innerHTML = `
                        <div class="order-header">
                            <span class="order-time">${new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span class="order-total">Rs: ${order.total.toFixed(2)}</span>
                        </div>
                        <ul class="order-item-list">
                            ${order.items.map(item => `<li>${item.quantity} x ${item.name} (Rs: ${item.price.toFixed(2)} each)</li>`).join('')}
                        </ul>
                        <div class="table-actions">
                            <button class="btn-clear" data-order-id="${order.id}">Clear Order</button>
                        </div>
                    `;
                    tableSection.appendChild(orderCard);
                });

                ordersContainer.appendChild(tableSection);
            });

            // Update previousOrders for the next check
            previousOrders = currentOrders;

            // Add event listeners to clear buttons
            document.querySelectorAll('.btn-clear').forEach(button => {
                button.addEventListener('click', (e) => {
                    const orderId = e.target.dataset.orderId;
                    clearOrder(orderId);
                });
            });
        } catch (error) {
            console.error('Error rendering orders:', error);
        }
    }

    async function generateBillForTable(tableNumber) {
        try {
            const orders = await getAllOrders();
            const tableOrders = orders.filter(order => order.tableNumber === tableNumber);

            if (tableOrders.length === 0) {
                billDetails.style.display = 'none';
                return;
            }

            billDetails.style.display = 'block';
            billTableHeader.textContent = `Bill for Table: ${tableNumber}`;

            const allItems = {};
            let tableTotal = 0;

            tableOrders.forEach(order => {
                order.items.forEach(item => {
                    const itemName = item.name;
                    if (!allItems[itemName]) {
                        allItems[itemName] = {
                            quantity: 0,
                            price: item.price
                        };
                    }
                    allItems[itemName].quantity += item.quantity;
                    tableTotal += item.price * item.quantity;
                });
            });

            billItemsBody.innerHTML = '';

            for (const [itemName, itemData] of Object.entries(allItems)) {
                const row = document.createElement('tr');
                const totalItemPrice = itemData.quantity * itemData.price;
                row.innerHTML = `
                    <td>${itemName}</td>
                    <td>${itemData.quantity}</td>
                    <td>Rs: ${itemData.price.toFixed(2)}</td>
                    <td>Rs: ${totalItemPrice.toFixed(2)}</td>
                `;
                billItemsBody.appendChild(row);
            }

            billTotalAmount.textContent = tableTotal.toFixed(2);
        } catch (error) {
            console.error('Error generating bill:', error);
        }
    }

    async function clearTableOrders(tableNumber) {
        try {
            await deleteTableOrders(tableNumber);
            await renderOrders();

            // Hide bill details after clearing
            billDetails.style.display = 'none';
            tableSelect.value = '';
        } catch (error) {
            console.error('Error clearing table orders:', error);
        }
    }

    async function clearOrder(orderId) {
        try {
            await deleteOrder(orderId);
            await renderOrders();

            const currentTable = tableSelect.value;
            if (currentTable) {
                await generateBillForTable(currentTable);
            }
        } catch (error) {
            console.error('Error clearing order:', error);
        }
    }

    function enableSound() {
        notificationSound.play()
            .then(() => {
                console.log("Audio playback enabled.");
                isSoundEnabled = true;
                soundPrompt.style.display = 'none';
                localStorage.setItem('soundEnabled', 'true');
            })
            .catch(e => {
                console.error("Audio playback failed:", e);
                soundPrompt.style.display = 'block';
            });
    }

    // Check sound preference from localStorage
    if (localStorage.getItem('soundEnabled') === 'true') {
        isSoundEnabled = true;
        soundPrompt.style.display = 'none';
    }

    // Listen for broadcast messages
    broadcastChannel.addEventListener('message', (event) => {
        if (event.data.type === 'new_order') {
            renderOrders();
        }
    });

    // Event listeners
    tableSelect.addEventListener('change', (e) => {
        const tableNumber = e.target.value;
        if (tableNumber) {
            generateBillForTable(tableNumber);
        } else {
            billDetails.style.display = 'none';
        }
    });

    markPaidButton.addEventListener('click', () => {
        const tableNumber = tableSelect.value;
        if (tableNumber) {
            if (confirm(`Mark all orders for Table ${tableNumber} as paid? This cannot be undone.`)) {
                clearTableOrders(tableNumber);
            }
        }
    });

    refreshButton.addEventListener('click', () => {
        renderOrders();
        const currentTable = tableSelect.value;
        if (currentTable) {
            generateBillForTable(currentTable);
        }
    });

    enableSoundButton.addEventListener('click', enableSound);

    // Initialize and render
    initDB().then(() => {
        renderOrders();
        
        // Auto-refresh every 5 seconds
        setInterval(() => {
            renderOrders();
            const currentTable = tableSelect.value;
            if (currentTable && document.getElementById('billing').classList.contains('active')) {
                generateBillForTable(currentTable);
            }
        }, 5000);
    }).catch(error => {
        console.error('Failed to initialize database:', error);
    });
});