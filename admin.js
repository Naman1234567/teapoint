document.addEventListener('DOMContentLoaded', () => {
    const ordersContainer = document.getElementById('orders-container');
    const refreshButton = document.getElementById('refresh-button');
    const notificationSound = document.getElementById('notification-sound');
    const tableSelect = document.getElementById('table-select');
    const billItemsBody = document.getElementById('bill-items-body');
    const billTotalAmount = document.getElementById('bill-total-amount');
    const markPaidButton = document.getElementById('mark-paid-button');
    const billDetails = document.getElementById('bill-details');
    const enableSoundButton = document.getElementById('enable-sound-button');
    const soundPrompt = document.getElementById('sound-prompt');

    // Menu data (assuming this is also available on the admin side)
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

    // Check for sound preference in localStorage
    let isSoundEnabled = localStorage.getItem('soundEnabled') === 'true';
    updateSoundPrompt();

    function updateSoundPrompt() {
        if (isSoundEnabled) {
            soundPrompt.style.display = 'none';
        } else {
            soundPrompt.style.display = 'flex';
        }
    }

    function playNotificationSound() {
        if (notificationSound && isSoundEnabled) {
            notificationSound.currentTime = 0;
            notificationSound.play().catch(e => console.log("Audio play failed:", e));
        }
    }

    function enableSound() {
        isSoundEnabled = true;
        localStorage.setItem('soundEnabled', 'true');
        updateSoundPrompt();
        playNotificationSound();
    }

    function displayOrderCard(orderId, order, isNew = false) {
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card';
        if (isNew) {
            orderCard.classList.add('new-order');
            setTimeout(() => {
                orderCard.classList.remove('new-order');
            }, 15000); // Remove class after 15 seconds
        }

        const totalOrderPrice = order.items.reduce((total, item) => {
            const itemPrice = menu.find(i => i.id == item.id)?.price || 0;
            return total + (itemPrice * item.quantity);
        }, 0);

        orderCard.innerHTML = `
            <div class="order-header">
                <span class="order-time">${order.timestamp ? new Date(order.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                <span class="order-total">Rs: ${totalOrderPrice.toFixed(2)}</span>
            </div>
            <ul class="order-item-list">
                ${order.items.map(item => `<li>${item.quantity} x ${item.name} (Rs: ${(menu.find(i => i.id == item.id)?.price || 0).toFixed(2)} each)</li>`).join('')}
            </ul>
            <div class="table-actions">
                <button class="btn-clear" data-order-id="${orderId}">Clear Order</button>
            </div>
        `;
        return orderCard;
    }

    function showBillPaidMessage(tableNumber) {
        const ordersSection = document.getElementById('orders');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'bill-paid-message';
        messageDiv.innerHTML = `
            <h2>✅ Bill for Table ${tableNumber} has been paid.</h2>
        `;
        ordersSection.prepend(messageDiv);
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    // New function to render orders from Firebase
    function renderOrders(snapshot) {
        const ordersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const uniqueTables = new Set();
        const ordersByTable = {};

        ordersData.forEach(order => {
            if (!ordersByTable[order.table]) {
                ordersByTable[order.table] = [];
            }
            ordersByTable[order.table].push(order);
            uniqueTables.add(order.table);
        });

        ordersContainer.innerHTML = '';
        const sortedTableNumbers = [...uniqueTables].sort((a, b) => parseInt(a) - parseInt(b));

        sortedTableNumbers.forEach(tableNumber => {
            const tableSection = document.createElement('div');
            tableSection.className = 'table-section';
            tableSection.innerHTML = `<h2 class="table-header">Table ${tableNumber}</h2>`;

            const sortedOrders = ordersByTable[tableNumber].sort((a, b) => b.timestamp - a.timestamp);
            sortedOrders.forEach(order => {
                const orderCard = displayOrderCard(order.id, order, false);
                tableSection.appendChild(orderCard);
            });
            ordersContainer.appendChild(tableSection);
        });
        updateTableSelect(sortedTableNumbers);
    }
    
    function updateTableSelect(tables) {
        const currentTableValue = tableSelect.value;
        tableSelect.innerHTML = '<option value="">-- Select Table --</option>';
        tables.sort((a, b) => a - b).forEach(table => {
            const option = document.createElement('option');
            option.value = table;
            option.textContent = `Table ${table}`;
            tableSelect.appendChild(option);
        });
        tableSelect.value = currentTableValue; // Restore selection
    }

    // Function to clear a table's orders (mark as paid)
    async function clearTableOrders(tableNumber) {
        const ordersRef = db.collection('tables').doc(`table-${tableNumber}`).collection('orders');

        try {
            const snapshot = await ordersRef.where('status', '==', 'pending').get();
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { status: 'paid' });
            });
            await batch.commit();
            showBillPaidMessage(tableNumber);
            document.getElementById('billing').classList.remove('active');
            document.getElementById('orders').classList.add('active');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelector('[data-tab="orders"]').classList.add('active');
        } catch (error) {
            console.error("Error clearing orders: ", error);
            alert('Failed to mark orders as paid. Please try again.');
        }
    }

    // Listen for real-time updates for new orders
    db.collectionGroup('orders').where('status', '==', 'pending').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                console.log("New order detected.");
                playNotificationSound();
                // We'll re-render all orders to keep the UI simple and in sync
            }
        });
        renderOrders(snapshot);
    });

    // Update the billing section
    function generateBillForTable(tableNumber) {
        billDetails.style.display = 'block';
        billItemsBody.innerHTML = '';
        let total = 0;

        db.collection('tables').doc(`table-${tableNumber}`).collection('orders').where('status', '==', 'pending').get().then(snapshot => {
            snapshot.forEach(doc => {
                const order = doc.data();
                const itemsList = Array.isArray(order.items) ? order.items : Object.values(order.items);
                itemsList.forEach(item => {
                    const itemPrice = menu.find(i => i.id == item.id)?.price || 0;
                    const itemTotal = itemPrice * item.quantity;
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>Rs: ${itemPrice.toFixed(2)}</td>
                        <td>Rs: ${itemTotal.toFixed(2)}</td>
                    `;
                    billItemsBody.appendChild(row);
                    total += itemTotal;
                });
            });
            billTotalAmount.textContent = total.toFixed(2);
            document.getElementById('bill-table-number').textContent = tableNumber;
        }).catch(error => {
            console.error("Error generating bill: ", error);
        });
    }

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
        // The onSnapshot listener handles real-time updates, but this can force a re-render
        db.collectionGroup('orders').where('status', '==', 'pending').get().then(renderOrders);
        const currentTable = tableSelect.value;
        if (currentTable) {
            generateBillForTable(currentTable);
        }
    });

    enableSoundButton.addEventListener('click', enableSound);
});