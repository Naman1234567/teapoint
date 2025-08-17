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

    // Firebase instance
    const db = firebase.firestore();

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

    // New placeOrder function to use Firebase
    async function placeOrder() {
        if (!currentTableNumber) {
            showModal('Error', 'Table number not set. Please scan the QR code again.', false);
            return;
        }

        const cart = getCart();
        if (Object.keys(cart).length === 0) {
            showModal('Info', 'Your cart is empty!', false);
            return;
        }

        const order = {
            table: currentTableNumber,
            items: Object.values(cart),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
        };

        try {
            // Create a document for the table if it doesn't exist and add a new order as a subcollection
            const tableDocRef = db.collection('tables').doc(`table-${currentTableNumber}`);
            await tableDocRef.set({ lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
            await tableDocRef.collection('orders').add(order);

            showModal('Order Placed!', 'Your order has been sent to the kitchen.', true);
            clearQuantities();
        } catch (error) {
            console.error("Error placing order: ", error);
            showModal('Error', 'Failed to place order. Please try again or call a staff member.', false);
        }
    }

    function getCart() {
        const cart = {};
        document.querySelectorAll('.quantity-input').forEach(input => {
            const quantity = parseInt(input.value);
            const itemId = input.dataset.itemId;
            const item = menu.find(i => i.id === itemId);
            if (item && quantity > 0) {
                cart[itemId] = {
                    id: itemId,
                    name: item.name,
                    quantity: quantity
                };
            }
        });
        return cart;
    }

    function clearQuantities() {
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
    if (tableHeader && tableNumberDisplay && currentTableNumber) {
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

    // Initial render
    renderMenu();
});