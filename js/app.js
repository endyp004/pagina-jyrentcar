document.addEventListener('DOMContentLoaded', () => {
    // ==== UI Interaction: Navigation SPA & Mobile Menu ====
    const navLinks = document.querySelectorAll('[data-view]');
    const viewSections = document.querySelectorAll('.view-section');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navLinksContainer = document.querySelector('.nav-links');
    const header = document.querySelector('.main-header');

    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 50);
    });

    hamburgerMenu?.addEventListener('click', () => {
        navLinksContainer.classList.toggle('show');
    });

    function switchView(targetViewId) {
        navLinks.forEach(link => {
            const isMatch = link.getAttribute('data-view') === targetViewId;
            if(!link.classList.contains('btn')) link.classList.toggle('active', isMatch);
        });

        viewSections.forEach(section => {
            section.classList.toggle('active', section.id === `view-${targetViewId}`);
        });

        navLinksContainer.classList.remove('show');
        window.scrollTo(0, 0);
    }

    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && document.getElementById(`view-${initialHash}`)) {
        switchView(initialHash);
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if(href && href.startsWith('#')) {
                e.preventDefault();
                const targetViewId = link.getAttribute('data-view');
                if (targetViewId) {
                    history.pushState(null, '', `#${targetViewId}`);
                    switchView(targetViewId);
                }
            }
        });
    });

    window.addEventListener('popstate', () => {
        const hash = window.location.hash.replace('#', '') || 'home';
        switchView(hash);
    });

    // ==== Data Management ====
    const STORAGE_KEY_CARS = 'jy_cars';
    const STORAGE_KEY_RESERVATIONS = 'jy_reservations';
    const STORAGE_KEY_USERS = 'jy_users';

    const defaultCars = [
        { id: 'car-1', brand: 'Mercedes-Benz', model: 'C-Class', year: 2024, type: 'sedan', price: 120, image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=800&auto=format&fit=crop', features: ['Automático', '5 Pasajeros', 'Piel', 'GPS'] },
        { id: 'car-2', brand: 'BMW', model: 'X5', year: 2023, type: 'suv', price: 180, image: 'https://images.unsplash.com/photo-1556189250-72ba497e0bde?q=80&w=800&auto=format&fit=crop', features: ['Automático', '7 Pasajeros', 'Techo Panorámico'] },
        { id: 'car-3', brand: 'Porsche', model: '911 Carrera', year: 2024, type: 'sport', price: 350, image: 'https://images.unsplash.com/photo-1503376712341-ea4cf45f6eb6?q=80&w=800&auto=format&fit=crop', features: ['Automático', '2 Pasajeros', '450 HP'] }
    ];

    let cars = JSON.parse(localStorage.getItem(STORAGE_KEY_CARS)) || defaultCars;
    let reservations = JSON.parse(localStorage.getItem(STORAGE_KEY_RESERVATIONS)) || [];
    let users = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS)) || [
        { id: 1, username: 'admin', password: '1234', role: 'Super Admin' }
    ];

    const saveToStorage = () => {
        localStorage.setItem(STORAGE_KEY_CARS, JSON.stringify(cars));
        localStorage.setItem(STORAGE_KEY_RESERVATIONS, JSON.stringify(reservations));
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    };

    if (!localStorage.getItem(STORAGE_KEY_CARS)) saveToStorage();

    // ==== Catalog Logic ====
    const catalogGrid = document.getElementById('catalog-grid');
    const filterBtns = document.querySelectorAll('.filter-btn');

    function renderCatalog(filterType = 'all') {
        if (!catalogGrid) return;
        catalogGrid.innerHTML = '';
        const filteredCars = filterType === 'all' ? cars : cars.filter(c => c.type === filterType);

        if (filteredCars.length === 0) {
            catalogGrid.innerHTML = '<p style="grid-column:1/-1; text-align:center; opacity:0.6;">No hay vehículos disponibles.</p>';
            return;
        }

        filteredCars.forEach(car => {
            const typeLabels = { sedan: 'Sedán', suv: 'SUV', sport: 'Deportivo' };
            const featuresHTML = (Array.isArray(car.features) ? car.features : car.features.split(',')).map(f => `<span class="feature-tag">${f.trim()}</span>`).join('');
            
            const card = document.createElement('div');
            card.className = 'car-card';
            card.innerHTML = `
                <div class="car-image-container">
                    <div class="car-badge">${typeLabels[car.type] || car.type}</div>
                    <img src="${car.image}" alt="${car.brand}" class="car-image" onerror="this.src='https://via.placeholder.com/800x500'">
                </div>
                <div class="car-content">
                    <h3 class="car-brand-model">${car.brand} <span>${car.model}</span></h3>
                    <p class="car-year">Año: ${car.year}</p>
                    <div class="car-features-list">${featuresHTML}</div>
                    <div class="car-footer">
                        <div class="car-price">$${car.price} <span>/día</span></div>
                        <button class="btn btn-primary btn-reserve-trigger" data-id="${car.id}">Reservar</button>
                    </div>
                </div>
            `;
            catalogGrid.appendChild(card);
        });

        document.querySelectorAll('.btn-reserve-trigger').forEach(btn => {
            btn.onclick = () => openReservationModal(btn.dataset.id);
        });
    }

    // ==== Reservation Modal ====
    const resModal = document.getElementById('reservation-modal');
    const resForm = document.getElementById('reservation-form');
    const WHATSAPP_NUMBER = "18296196000";

    function openReservationModal(carId) {
        const car = cars.find(c => c.id === carId);
        if(!car) return;

        document.getElementById('modal-car-preview').innerHTML = `
            <img src="${car.image}" alt="${car.brand}" style="width:80px; height:50px; object-fit:cover; border-radius:4px;">
            <div class="preview-details"><strong>${car.brand} ${car.model}</strong><span>$${car.price}/día</span></div>
        `;
        document.getElementById('res-car-name').value = `${car.brand} ${car.model}`;
        document.getElementById('res-car-price').value = car.price;
        document.getElementById('res-date').valueAsDate = new Date();
        
        resForm.reset();
        delete resForm.dataset.editId;
        updateResTotal();
        resModal.style.display = 'flex';
    }

    const updateResTotal = () => {
        const days = parseInt(document.getElementById('res-days').value) || 1;
        const price = parseFloat(document.getElementById('res-car-price').value) || 0;
        document.getElementById('res-total-estimated').textContent = `$${(days * price).toFixed(2)}`;
    };

    document.getElementById('res-days')?.addEventListener('input', updateResTotal);
    document.getElementById('close-modal-btn')?.addEventListener('click', () => resModal.style.display = 'none');

    resForm?.addEventListener('submit', (e) => {
        const editId = resForm.dataset.editId;
        const resData = {
            id: editId ? parseInt(editId) : Date.now(),
            timestamp: editId ? reservations.find(r => r.id == editId).timestamp : Date.now(),
            carName: document.getElementById('res-car-name').value,
            customerName: document.getElementById('res-name').value,
            customerPhone: document.getElementById('res-phone').value,
            startDate: document.getElementById('res-date').value,
            days: document.getElementById('res-days').value,
            total: document.getElementById('res-total-estimated').textContent
        };

        if (editId) {
            const idx = reservations.findIndex(r => r.id == editId);
            reservations[idx] = resData;
        } else {
            reservations.push(resData);
        }
        
        saveToStorage();

        // WhatsApp redirect (only for new reservations)
        if (!editId) {
            const msg = `*NUEVA SOLICITUD DE RESERVA* 🚗\n\n*Vehículo:* ${resData.carName}\n*Cliente:* ${resData.customerName}\n*Teléfono:* ${resData.customerPhone}\n*Inicio:* ${resData.startDate}\n*Días:* ${resData.days}\n*Total:* ${resData.total}\n\nHola JY Rent A Car, me gustaría confirmar disponibilidad.`;
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
        } else {
            alert('Reserva actualizada correctamente.');
        }
        
        resModal.style.display = 'none';
        if(isLoggedIn) renderReservations();
    });

    // ==== Admin Panel Logic ====
    const adminLoginView = document.getElementById('admin-login-view');
    const adminDashboardView = document.getElementById('admin-dashboard-view');
    const loginForm = document.getElementById('login-form');
    let isLoggedIn = sessionStorage.getItem('jy_admin_logged_in') === 'true';

    function checkAdminAuth() {
        const authed = sessionStorage.getItem('jy_admin_logged_in') === 'true';
        adminLoginView.style.display = authed ? 'none' : 'flex';
        adminDashboardView.style.display = authed ? 'block' : 'none';
        if (authed) {
            renderInventory();
            renderReservations();
            renderUsers();
        }
    }

    loginForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        const found = users.find(user => user.username === u && user.password === p);

        if (found) {
            sessionStorage.setItem('jy_admin_logged_in', 'true');
            isLoggedIn = true;
            document.getElementById('login-error').style.display = 'none';
            loginForm.reset();
            checkAdminAuth();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        sessionStorage.removeItem('jy_admin_logged_in');
        isLoggedIn = false;
        checkAdminAuth();
    });

    // Tabs
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        };
    });

    // CRUD: Inventory
    const inventoryList = document.getElementById('inventory-list');
    const adminForm = document.getElementById('admin-form');
    const adminFormContainer = document.getElementById('admin-form-container');
    const carImagesInput = document.getElementById('car-images-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    let tempCarImages = [];

    carImagesInput?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                tempCarImages.push(base64);
                renderImagePreviews();
            };
            reader.readAsDataURL(file);
        });
        carImagesInput.value = ''; // Reset to allow same file re-upload
    });

    function renderImagePreviews() {
        if(!imagePreviewContainer) return;
        imagePreviewContainer.innerHTML = '';
        tempCarImages.forEach((src, index) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${src}" alt="Preview">
                <button type="button" class="remove-img" data-index="${index}">&times;</button>
            `;
            imagePreviewContainer.appendChild(div);
        });

        document.querySelectorAll('.remove-img').forEach(btn => {
            btn.onclick = () => {
                tempCarImages.splice(btn.dataset.index, 1);
                renderImagePreviews();
            };
        });
    }

    const iconEdit = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    const iconTrash = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

    function renderInventory() {
        if(!inventoryList) return;
        inventoryList.innerHTML = '';
        cars.forEach(car => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${car.brand}</strong> ${car.model}</td>
                <td><span class="type-badge">${car.type}</span></td>
                <td>$${car.price}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit-action" data-id="${car.id}" title="Editar">${iconEdit}</button>
                        <button class="btn-action btn-delete-action" data-id="${car.id}" title="Borrar">${iconTrash}</button>
                    </div>
                </td>
            `;
            inventoryList.appendChild(tr);
        });
        document.querySelectorAll('.btn-edit-action').forEach(b => b.onclick = () => loadCar(b.dataset.id));
        document.querySelectorAll('.btn-delete-action').forEach(b => b.onclick = () => {
            if(confirm('¿Borrar auto?')) { cars = cars.filter(c => c.id !== b.dataset.id); saveToStorage(); renderInventory(); renderCatalog(); }
        });
    }

    document.getElementById('add-car-btn')?.addEventListener('click', () => {
        adminForm.reset();
        document.getElementById('car-id').value = '';
        document.getElementById('form-title').textContent = 'Añadir Nuevo Vehículo';
        tempCarImages = [];
        renderImagePreviews();
        adminFormContainer.style.display = 'block';
    });

    adminForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('car-id').value;
        const data = {
            id: id || `car-${Date.now()}`,
            brand: document.getElementById('car-brand').value,
            model: document.getElementById('car-model').value,
            year: document.getElementById('car-year').value,
            type: document.getElementById('car-type').value,
            price: document.getElementById('car-price').value,
            image: tempCarImages[0] || 'https://via.placeholder.com/800x500', // Principal image
            allImages: [...tempCarImages],
            features: document.getElementById('car-features').value
        };

        if(id) {
            const idx = cars.findIndex(c => c.id === id);
            cars[idx] = data;
        } else {
            cars.push(data);
        }
        saveToStorage();
        adminFormContainer.style.display = 'none';
        renderInventory();
        renderCatalog();
    });

    document.getElementById('admin-cancel-btn')?.addEventListener('click', () => adminFormContainer.style.display = 'none');

    function loadCar(id) {
        const car = cars.find(c => c.id === id);
        if(!car) return;
        document.getElementById('form-title').textContent = 'Editar Vehículo';
        document.getElementById('car-id').value = car.id;
        document.getElementById('car-brand').value = car.brand;
        document.getElementById('car-model').value = car.model;
        document.getElementById('car-year').value = car.year;
        document.getElementById('car-type').value = car.type;
        document.getElementById('car-price').value = car.price;
        tempCarImages = car.allImages || (car.image ? [car.image] : []);
        renderImagePreviews();
        document.getElementById('car-features').value = Array.isArray(car.features) ? car.features.join(', ') : car.features;
        adminFormContainer.style.display = 'block';
    }

    // CRUD: Reservations
    window.editRes = (id) => {
        const res = reservations.find(r => r.id == id);
        if(!res) return;
        
        // Find the car to get price
        const car = cars.find(c => c.brand + ' ' + c.model === res.carName);
        
        // Open the modal and fill it
        openReservationModal(car ? car.id : null);
        
        // Override fields with existing reservation data
        document.getElementById('res-name').value = res.customerName;
        document.getElementById('res-phone').value = res.customerPhone;
        document.getElementById('res-date').value = res.startDate;
        document.getElementById('res-days').value = res.days;
        updateResTotal();
        
        // Mark form for update
        resForm.dataset.editId = id;
    };
    const resSearchInput = document.getElementById('res-search-input');

    function renderReservations(searchTerm = '') {
        const list = document.getElementById('reservations-list');
        if(!list) return;
        list.innerHTML = '';
        
        let filteredRes = [...reservations];
        
        if (searchTerm) {
            const lowTerm = searchTerm.toLowerCase();
            filteredRes = filteredRes.filter(res => 
                res.customerName.toLowerCase().includes(lowTerm) || 
                res.carName.toLowerCase().includes(lowTerm) ||
                res.customerPhone.includes(lowTerm)
            );
        }

        filteredRes.sort((a,b) => b.timestamp - a.timestamp).forEach(res => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(res.timestamp).toLocaleDateString()}</td>
                <td>${res.customerName}<br><small>${res.customerPhone}</small></td>
                <td>${res.carName}</td>
                <td>${res.days}d / ${res.total}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit-action" onclick="editRes(${res.id})" title="Editar">${iconEdit}</button>
                        <button class="btn-action btn-delete-action" onclick="deleteRes(${res.id})" title="Borrar">${iconTrash}</button>
                    </div>
                </td>
            `;
            list.appendChild(tr);
        });
    }

    resSearchInput?.addEventListener('input', (e) => {
        renderReservations(e.target.value);
    });

    window.deleteRes = (id) => {
        if(confirm('¿Borrar reserva?')) { reservations = reservations.filter(r => r.id !== id); saveToStorage(); renderReservations(); }
    };

    // CRUD: Users
    const userList = document.getElementById('users-list');
    const userForm = document.getElementById('user-form');
    const userContainer = document.getElementById('user-form-container');

    function renderUsers() {
        if(!userList) return;
        userList.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.username}</td>
                <td>${u.role}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit-action" onclick="loadUser(${u.id})" title="Editar">${iconEdit}</button>
                        ${u.username !== 'admin' ? `<button class="btn-action btn-delete-action" onclick="deleteUser(${u.id})" title="Borrar">${iconTrash}</button>` : ''}
                    </div>
                </td>
            `;
            userList.appendChild(tr);
        });
    }

    window.loadUser = (id) => {
        const u = users.find(user => user.id == id);
        if(!u) return;
        document.getElementById('user-id').value = u.id;
        document.getElementById('new-username').value = u.username;
        document.getElementById('new-password').value = u.password;
        document.getElementById('new-role').value = u.role || 'Admin';
        document.getElementById('user-form-title').textContent = 'Editar Administrador';
        userContainer.style.display = 'block';
    };

    document.getElementById('add-user-btn')?.addEventListener('click', () => {
        userForm.reset();
        document.getElementById('user-id').value = '';
        document.getElementById('user-form-title').textContent = 'Crear Administrador';
        userContainer.style.display = 'block';
    });
    document.getElementById('user-cancel-btn')?.addEventListener('click', () => userContainer.style.display = 'none');

    userForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('user-id').value;
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const role = document.getElementById('new-role').value;
// turbo
        if (id) {
            const idx = users.findIndex(u => u.id == id);
            if (idx !== -1) {
                users[idx].username = username;
                users[idx].password = password;
                users[idx].role = role;
            }
        } else {
            users.push({ id: Date.now(), username, password, role: role });
        }
        
        saveToStorage();
        userContainer.style.display = 'none';
        userForm.reset();
        document.getElementById('user-id').value = '';
        renderUsers();
    });

    window.deleteUser = (id) => {
        if(confirm('¿Borrar usuario?')) { users = users.filter(u => u.id !== id); saveToStorage(); renderUsers(); }
    };

    // Filters
    filterBtns.forEach(btn => {
        btn.onclick = () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCatalog(btn.dataset.filter);
        };
    });

    // Final Init
    renderCatalog();
    checkAdminAuth();
});
