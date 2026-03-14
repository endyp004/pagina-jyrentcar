document.addEventListener('DOMContentLoaded', () => {
    // Aliases for security utilities
    const S = JYSecurity.sanitizeHTML;
    const SURL = JYSecurity.sanitizeURL;

    // ==== Data Management (API State) ====
    let cars = [];
    let reservations = [];
    let users = [];
    let isLoggedIn = false;

    // ==== UI Elements ====
    // Navigation
    const navLinks = document.querySelectorAll('[data-view]');
    const viewSections = document.querySelectorAll('.view-section');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navLinksContainer = document.querySelector('.nav-links');
    const header = document.querySelector('.main-header');

    // Catalog & Modal
    const catalogGrid = document.getElementById('catalog-grid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const resModal = document.getElementById('reservation-modal');
    const resForm = document.getElementById('reservation-form');

    // Admin Panel
    const adminLoginView = document.getElementById('admin-login-view');
    const adminDashboardView = document.getElementById('admin-dashboard-view');
    const loginForm = document.getElementById('login-form');
    const inventoryList = document.getElementById('inventory-list');
    const adminForm = document.getElementById('admin-form');
    const adminFormContainer = document.getElementById('admin-form-container');
    const carImagesInput = document.getElementById('car-images-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');

    // Utilities
    const loginLimiter = new JYSecurity.RateLimiter(5, 30000);
    const WHATSAPP_NUMBER = "18296196000";

    // ==== UI Interaction: Navigation SPA & Mobile Menu ====

    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 50);
    });

    hamburgerMenu?.addEventListener('click', () => {
        navLinksContainer.classList.toggle('show');
    });

    function switchView(targetViewId) {
        const allowedViews = ['home', 'catalog', 'contact', 'admin'];
        if (!allowedViews.includes(targetViewId)) return;

        navLinks.forEach(link => {
            const isMatch = link.getAttribute('data-view') === targetViewId;
            if(!link.classList.contains('btn')) link.classList.toggle('active', isMatch);
        });

        viewSections.forEach(section => {
            section.classList.toggle('active', section.id === `view-${targetViewId}`);
        });

        navLinksContainer.classList.remove('show');
        window.scrollTo(0, 0);

        // Fetch data when switching to relevant views
        if (targetViewId === 'catalog') fetchCars();
        if (targetViewId === 'admin') checkAdminAuth();
    }

    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && document.getElementById(`view-${initialHash}`)) {
        switchView(initialHash);
    } else {
        switchView('home');
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
    // (Variables moved to top)

    async function fetchCars() {
        try {
            cars = await JYSecurity.apiRequest('/cars');
            renderCatalog();
            if (isLoggedIn) renderInventory();
        } catch (err) {
            console.error('Error fetching cars:', err);
        }
    }

    async function fetchReservations() {
        try {
            reservations = await JYSecurity.apiRequest('/reservations');
            renderReservations();
        } catch (err) {
            console.error('Error fetching reservations:', err);
        }
    }

    // (Moved to top)

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
            const rawFeatures = Array.isArray(car.features) ? car.features : (car.features || '').split(',');
            const featuresHTML = rawFeatures.map(f => `<span class="feature-tag">${S(f.trim())}</span>`).join('');
            
            const images = Array.isArray(car.image) ? car.image : [];
            const safeImage = images.length > 0 ? JYSecurity.resolveImageURL(images[0]) : 'images/car-placeholder.png';
            const safeBrand = S(car.brand);
            const safeModel = S(car.model);
            const safeYear = S(String(car.year));
            const safePrice = S(String(car.price));
            const safeType = S(typeLabels[car.type] || car.type);
            const safeId = S(car.id);

            const card = document.createElement('div');
            card.className = 'car-card';
            card.innerHTML = `
                <div class="car-image-container">
                    <img src="${safeImage}" alt="${safeBrand} ${safeModel}" class="car-image" loading="lazy">
                    <span class="car-badge">${safeType}</span>
                </div>
                <div class="car-content">
                    <div class="car-header">
                        <h3>${safeBrand} ${safeModel}</h3>
                        <span class="car-year">${safeYear}</span>
                    </div>
                    <div class="car-features">
                        ${featuresHTML}
                    </div>
                    <div class="car-footer">
                        <div class="car-price">
                            <span class="price-amount">$${safePrice}</span>
                            <span class="price-unit">/día</span>
                        </div>
                        <button class="btn btn-primary btn-reserve-trigger" data-id="${safeId}">Reservar</button>
                    </div>
                </div>
            `;

            catalogGrid.appendChild(card);

            // Make entire card clickable
            card.onclick = (e) => {
                // If the user didn't click the reserve button specifically
                if (!e.target.classList.contains('btn-reserve-trigger')) {
                    openReservationModal(car.id);
                }
            };
        });

        document.querySelectorAll('.btn-reserve-trigger').forEach(btn => {
            btn.onclick = () => openReservationModal(btn.dataset.id);
        });
    }

    // (Moved to top)

    function openReservationModal(carId) {
        const car = cars.find(c => c.id === carId);
        if(!car) return;

        const images = Array.isArray(car.image) ? car.image : [];
        const mainImage = images.length > 0 ? JYSecurity.resolveImageURL(images[0]) : 'images/car-placeholder.png';
        
        let galleryHTML = '';
        if (images.length > 1) {
            galleryHTML = `
                <div class="car-gallery-small">
                    ${images.map((img, idx) => `
                        <img src="${JYSecurity.resolveImageURL(img)}" class="gallery-thumb ${idx === 0 ? 'active' : ''}" 
                             onclick="const mainImg = this.parentElement.parentElement.querySelector('.main-modal-img');
                                      mainImg.src=this.src; 
                                      mainImg.dataset.index='${idx}';
                                      this.parentElement.querySelectorAll('.gallery-thumb').forEach(t=>t.classList.remove('active')); 
                                      this.classList.add('active');">
                    `).join('')}
                </div>
            `;
        }

        document.getElementById('modal-car-preview').innerHTML = `
            <div class="modal-gallery-container">
                <div class="main-img-wrapper" onclick="openLightbox(${JSON.stringify(images).replace(/"/g, '&quot;')})">
                    <img src="${mainImage}" alt="${S(car.brand)}" class="main-modal-img" data-index="0">
                    <div class="img-overlay"><i class="fas fa-search-plus"></i> Ver Galería</div>
                </div>
                ${galleryHTML}
            </div>
            <div class="preview-details">
                <strong>${S(car.brand)} ${S(car.model)}</strong>
                <span>$${S(String(car.price))}/día</span>
            </div>
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

    function openLightbox(images) {
        if (!images || images.length === 0) return;
        
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox-overlay';
        
        let currentIndex = 0;
        const resolvedImages = images.map(img => JYSecurity.resolveImageURL(img));

        lightbox.innerHTML = `
            <div class="lightbox-content">
                <button class="lightbox-close">&times;</button>
                <div class="lightbox-main">
                    <img src="${resolvedImages[currentIndex]}" class="lightbox-img">
                </div>
                ${resolvedImages.length > 1 ? `
                <button class="lightbox-prev">&lsaquo;</button>
                <button class="lightbox-next">&rsaquo;</button>
                <div class="lightbox-counter">1 / ${resolvedImages.length}</div>
                ` : ''}
            </div>
        `;

        document.body.appendChild(lightbox);
        document.body.style.overflow = 'hidden';

        const updateLightbox = (idx) => {
            currentIndex = (idx + resolvedImages.length) % resolvedImages.length;
            const img = lightbox.querySelector('.lightbox-img');
            img.style.opacity = '0';
            setTimeout(() => {
                img.src = resolvedImages[currentIndex];
                img.style.opacity = '1';
                const counter = lightbox.querySelector('.lightbox-counter');
                if(counter) counter.textContent = `${currentIndex + 1} / ${resolvedImages.length}`;
            }, 200);
        };

        lightbox.querySelector('.lightbox-close').onclick = () => {
            lightbox.remove();
            document.body.style.overflow = '';
        };

        lightbox.querySelector('.lightbox-prev')?.addEventListener('click', () => updateLightbox(currentIndex - 1));
        lightbox.querySelector('.lightbox-next')?.addEventListener('click', () => updateLightbox(currentIndex + 1));
        
        lightbox.onclick = (e) => {
            if (e.target === lightbox) lightbox.querySelector('.lightbox-close').click();
        };

        // Keyboard navigation
        const keyHandler = (e) => {
            if (e.key === 'ArrowLeft') updateLightbox(currentIndex - 1);
            if (e.key === 'ArrowRight') updateLightbox(currentIndex + 1);
            if (e.key === 'Escape') {
                lightbox.querySelector('.lightbox-close').click();
                document.removeEventListener('keydown', keyHandler);
            }
        };
        document.addEventListener('keydown', keyHandler);
    }

    document.getElementById('res-days')?.addEventListener('input', updateResTotal);
    document.getElementById('close-modal-btn')?.addEventListener('click', () => resModal.style.display = 'none');

    resForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameVal = document.getElementById('res-name').value;
        const phoneVal = document.getElementById('res-phone').value;
        const dateVal = document.getElementById('res-date').value;
        const daysVal = document.getElementById('res-days').value;

        const validations = [
            JYSecurity.validateInput(nameVal, 'text'),
            JYSecurity.validateInput(phoneVal, 'phone'),
            JYSecurity.validateInput(dateVal, 'date'),
            JYSecurity.validateInput(daysVal, 'number')
        ];

        const firstError = validations.find(v => !v.valid);
        if (firstError) {
            alert(firstError.error);
            return;
        }

        const resData = {
            timestamp: Date.now(),
            carName: document.getElementById('res-car-name').value,
            customerName: nameVal.trim(),
            customerPhone: phoneVal.trim(),
            startDate: dateVal,
            days: daysVal,
            total: document.getElementById('res-total-estimated').textContent
        };

        try {
            await JYSecurity.apiRequest('/reservations', {
                method: 'POST',
                body: JSON.stringify(resData)
            });
            
            const msg = `*NUEVA SOLICITUD DE RESERVA* 🚗\n\n*Vehículo:* ${resData.carName}\n*Cliente:* ${resData.customerName}\n*Teléfono:* ${resData.customerPhone}\n*Inicio:* ${resData.startDate}\n*Días:* ${resData.days}\n*Total:* ${resData.total}\n\nHola JY Rent A Car, me gustaría confirmar disponibilidad.`;
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
            
            resModal.style.display = 'none';
            if(isLoggedIn) fetchReservations();
        } catch (err) {
            alert('Error al guardar la reserva.');
        }
    });

    // ==== Admin Panel Logic ====
    // (Elements moved to top)

    function checkAdminAuth() {
        const session = JYSecurity.validateSession();
        isLoggedIn = session.valid;
        adminLoginView.style.display = isLoggedIn ? 'none' : 'flex';
        adminDashboardView.style.display = isLoggedIn ? 'block' : 'none';
        
        if (isLoggedIn) {
            fetchCars();
            fetchReservations();
            fetchUsers();
        }
    }

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Login attempt started...');
        const loginError = document.getElementById('login-error');
        loginError.style.display = 'none'; // Clear previous

        const status = loginLimiter.getStatus();
        if (status.locked) {
            console.warn('Login locked:', status);
            loginError.textContent = `⏳ Demasiados intentos. Espera ${status.remainingSeconds} segundos.`;
            loginError.style.display = 'block';
            return;
        }

        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        console.log('Username:', u);

        if (!u || !p) {
            loginError.textContent = 'Por favor, completa ambos campos.';
            loginError.style.display = 'block';
            return;
        }

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = '⏱️ Cargando...';
            console.log('Calling JYSecurity.login...');
            const res = await JYSecurity.login(u, p);
            console.log('Login Result:', res);
            if (res.success) {
                loginLimiter.reset();
                isLoggedIn = true;
                loginError.style.display = 'none';
                loginForm.reset();
                checkAdminAuth();
            } else {
                const result = loginLimiter.recordFailure();
                if (result.locked) {
                    loginError.textContent = `🔒 Cuenta bloqueada temporalmente. Espera ${result.remainingSeconds} segundos.`;
                } else {
                    loginError.textContent = `❌ ${res.error || 'Credenciales inválidas'}. ${result.attemptsLeft} intentos restantes.`;
                }
                loginError.style.display = 'block';
            }
        } catch (err) {
            console.error('Login submit error:', err);
            loginError.textContent = '❌ Error de comunicación con el servidor. Inténtalo de nuevo.';
            loginError.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        JYSecurity.destroySession();
    });

    // Tabs
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            const allowedTabs = ['tab-inventory', 'tab-reservations', 'tab-users'];
            if (allowedTabs.includes(tabId)) {
                document.getElementById(tabId).classList.add('active');
            }
        };
    });

    // (Elements moved to top)
    let tempCarImages = [];

    carImagesInput?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const validation = JYSecurity.validateFileUpload(file);
            if (!validation.valid) {
                alert(`⚠️ ${file.name}: ${validation.error}`);
                return;
            }

            // Store file and a local preview URL
            tempCarImages.push({
                file: file,
                preview: URL.createObjectURL(file)
            });
            renderImagePreviews();
        });
        carImagesInput.value = '';
    });

    function renderImagePreviews() {
        if(!imagePreviewContainer) return;
        imagePreviewContainer.innerHTML = '';
        tempCarImages.forEach((imgObj, index) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${imgObj.preview}" alt="Preview">
                <button type="button" class="remove-img" data-index="${index}">&times;</button>
            `;
            imagePreviewContainer.appendChild(div);
        });

        document.querySelectorAll('.remove-img').forEach(btn => {
            btn.onclick = () => {
                const index = parseInt(btn.dataset.index);
                // Revoke URL to prevent memory leaks
                URL.revokeObjectURL(tempCarImages[index].preview);
                tempCarImages.splice(index, 1);
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
                <td><strong>${S(car.brand)}</strong> ${S(car.model)}</td>
                <td><span class="type-badge">${S(car.type)}</span></td>
                <td>$${S(String(car.price))}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit-action" data-id="${S(car.id)}" title="Editar">${iconEdit}</button>
                        <button class="btn-action btn-delete-action" data-id="${S(car.id)}" title="Borrar">${iconTrash}</button>
                    </div>
                </td>
            `;
            inventoryList.appendChild(tr);
        });
        document.querySelectorAll('.btn-edit-action').forEach(b => b.onclick = () => loadCar(b.dataset.id));
        document.querySelectorAll('.btn-delete-action').forEach(b => b.onclick = async () => {
            if(confirm('¿Borrar auto?')) {
                try {
                    await JYSecurity.apiRequest(`/cars/${b.dataset.id}`, { method: 'DELETE' });
                    fetchCars();
                } catch (err) { alert('Error al borrar car'); }
            }
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

    adminForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const brand = document.getElementById('car-brand').value.trim();
        const model = document.getElementById('car-model').value.trim();
        const year = document.getElementById('car-year').value;
        const price = document.getElementById('car-price').value;
        const features = document.getElementById('car-features').value.trim();

        if (!brand || !model || !year || !price || !features) {
            alert('Por favor, completa todos los campos.');
            return;
        }

        const id = document.getElementById('car-id').value || `car-${Date.now()}`;
        
        const formData = new FormData();
        formData.append('id', id);
        formData.append('brand', brand);
        formData.append('model', model);
        formData.append('year', year);
        formData.append('type', document.getElementById('car-type').value);
        formData.append('price', price);
        formData.append('features', features);

        // Append all selected files
        if (tempCarImages.length > 0) {
            tempCarImages.forEach(imgObj => {
                if (imgObj.file) {
                    formData.append('imageFiles', imgObj.file);
                }
            });
            
            // If some are already uploaded (editing), keep them? 
            // For now, if NEW files are uploaded, they replace all old ones in the backend.
            // If NO new files are uploaded, we send the existing ones.
        }
        
        // Find existing images if editing and no new files uploaded
        const carId = document.getElementById('car-id').value;
        const existingCar = carId ? cars.find(c => c.id === carId) : null;
        
        if (tempCarImages.length === 0 && existingCar) {
            formData.append('image', JSON.stringify(existingCar.image));
        } else if (tempCarImages.length === 0) {
            formData.append('image', JSON.stringify(['images/car-placeholder.png']));
        }

        try {
            await JYSecurity.apiRequest('/cars', {
                method: 'POST',
                body: formData
            });
            adminFormContainer.style.display = 'none';
            fetchCars();
        } catch (err) { alert('Error al guardar vehículo.'); }
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
        const images = Array.isArray(car.image) ? car.image : (car.image ? [car.image] : []);
        tempCarImages = images.map(img => ({
            file: null,
            preview: JYSecurity.resolveImageURL(img)
        }));
        renderImagePreviews();
        document.getElementById('car-features').value = Array.isArray(car.features) ? car.features.join(', ') : car.features;
        adminFormContainer.style.display = 'block';
    }

    // CRUD: Reservations
    function renderReservations(searchTerm = '') {
        const list = document.getElementById('reservations-list');
        if(!list) return;
        list.innerHTML = '';
        
        let filteredRes = [...reservations];
        
        if (searchTerm) {
            const lowTerm = searchTerm.toLowerCase();
            filteredRes = filteredRes.filter(res => 
                (res.customerName || '').toLowerCase().includes(lowTerm) || 
                (res.carName || '').toLowerCase().includes(lowTerm) ||
                (res.customerPhone || '').includes(lowTerm)
            );
        }

        filteredRes.forEach(res => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${S(new Date(res.timestamp).toLocaleDateString())}</td>
                <td>${S(res.customerName)}<br><small>${S(res.customerPhone)}</small></td>
                <td>${S(res.carName)}</td>
                <td>${S(String(res.days))}d / ${S(res.total)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-delete-action" onclick="deleteRes(${res.id})" title="Borrar">${iconTrash}</button>
                    </div>
                </td>
            `;
            list.appendChild(tr);
        });
    }

    window.deleteRes = async (id) => {
        if(confirm('¿Borrar reserva?')) {
            try {
                await JYSecurity.apiRequest(`/reservations/${id}`, { method: 'DELETE' });
                fetchReservations();
            } catch (err) { alert('Error al borrar reserva.'); }
        }
    };

    // CRUD: Users
    async function fetchUsers() {
        try {
            users = await JYSecurity.apiRequest('/users');
            renderUsers();
        } catch (err) { console.error('Error fetching users:', err); }
    }

    function renderUsers() {
        const list = document.getElementById('users-list');
        if(!list) return;
        list.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${S(user.username)}</strong></td>
                <td><span class="type-badge">${S(user.role)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit-user" data-id="${user.id}" title="Editar">${iconEdit}</button>
                        <button class="btn-action btn-delete-user" data-id="${user.id}" title="Borrar">${iconTrash}</button>
                    </div>
                </td>
            `;
            list.appendChild(tr);
        });
        document.querySelectorAll('.btn-edit-user').forEach(b => b.onclick = () => loadUser(Number(b.dataset.id)));
        document.querySelectorAll('.btn-delete-user').forEach(b => b.onclick = () => deleteUser(Number(b.dataset.id)));
    }

    document.getElementById('add-user-btn')?.addEventListener('click', () => {
        document.getElementById('user-form').reset();
        document.getElementById('user-id').value = '';
        document.getElementById('user-form-title').textContent = 'Crear Administrador';
        document.getElementById('user-form-container').style.display = 'block';
    });

    document.getElementById('user-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('user-id').value;
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value;
        const role = document.getElementById('new-role').value;

        try {
            await JYSecurity.apiRequest('/users', {
                method: 'POST',
                body: JSON.stringify({ id, username, password, role })
            });
            document.getElementById('user-form-container').style.display = 'none';
            fetchUsers();
        } catch (err) { alert('Error al guardar usuario.'); }
    });

    document.getElementById('user-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('user-form-container').style.display = 'none';
    });

    function loadUser(id) {
        const user = users.find(u => u.id === id);
        if(!user) return;
        document.getElementById('user-form-title').textContent = 'Editar Usuario';
        document.getElementById('user-id').value = user.id;
        document.getElementById('new-username').value = user.username;
        document.getElementById('new-password').value = ''; // Don't show old hash
        document.getElementById('new-password').required = false; // Not required for edit
        document.getElementById('new-role').value = user.role;
        document.getElementById('user-form-container').style.display = 'block';
    }

    async function deleteUser(id) {
        if(confirm('¿Seguro que deseas eliminar este usuario?')) {
            try {
                const res = await JYSecurity.apiRequest(`/users/${id}`, { method: 'DELETE' });
                if (res.error) {
                    alert(res.error);
                } else {
                    fetchUsers();
                }
            } catch (err) { alert('Error al borrar usuario.'); }
        }
    }

    // Contact Form
    document.getElementById('contact-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const message = document.getElementById('contact-message').value.trim();

        const validations = [
            JYSecurity.validateInput(name, 'text'),
            JYSecurity.validateInput(email, 'email'),
            JYSecurity.validateInput(message, 'text')
        ];
        const firstError = validations.find(v => !v.valid);
        if (firstError) {
            alert(firstError.error);
            return;
        }

        const contactMsg = `*NUEVO MENSAJE DE CONTACTO* ✉️\n\n*Nombre:* ${name}\n*Correo:* ${email}\n*Mensaje:* ${message}`;
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(contactMsg)}`, '_blank', 'noopener,noreferrer');
        document.getElementById('contact-form').reset();
    });

    // Filters
    filterBtns.forEach(btn => {
        btn.onclick = () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCatalog(btn.dataset.filter);
        };
    });

    // Final Init
    function init() {
        fetchCars();
        checkAdminAuth();
    }

    init();
});
