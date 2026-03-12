/**
 * JY Rent A Car — Security Utilities Module
 * Provides: HTML sanitization, SHA-256 hashing, rate limiting,
 * session management, file validation, and input validation.
 */
const JYSecurity = (() => {

    // ===== 1. HTML Sanitization (XSS Prevention) =====
    const _entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#96;'
    };

    /**
     * Escapes HTML special characters to prevent XSS injection.
     * @param {string} str - Raw string to sanitize
     * @returns {string} Safe HTML string
     */
    function sanitizeHTML(str) {
        if (typeof str !== 'string') return String(str ?? '');
        return str.replace(/[&<>"'`/]/g, char => _entityMap[char]);
    }

    /**
     * Sanitize a URL string — only allows http, https, and data URIs for images.
     * @param {string} url
     * @returns {string} Safe URL or empty string
     */
    function sanitizeURL(url) {
        if (typeof url !== 'string') return '';
        const trimmed = url.trim();
        // Allow https, http, and data:image URIs only
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed)) return trimmed;
        return '';
    }


    // ===== 2. SHA-256 Password Hashing =====

    /**
     * Hashes a string using SHA-256 (Web Crypto API).
     * @param {string} message - The plaintext to hash
     * @returns {Promise<string>} Hex-encoded hash
     */
    async function hashPassword(message) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }


    // ===== 3. Rate Limiter (Brute-Force Protection) =====

    class RateLimiter {
        /**
         * @param {number} maxAttempts - Max attempts before lockout
         * @param {number} baseCooldownMs - Base cooldown in ms (doubles each lockout)
         */
        constructor(maxAttempts = 5, baseCooldownMs = 30000) {
            this.maxAttempts = maxAttempts;
            this.baseCooldownMs = baseCooldownMs;
            this.attempts = 0;
            this.lockoutCount = 0;
            this.lockedUntil = 0;
        }

        /**
         * Check if currently locked out.
         * @returns {{ locked: boolean, remainingSeconds: number }}
         */
        getStatus() {
            const now = Date.now();
            if (this.lockedUntil > now) {
                return {
                    locked: true,
                    remainingSeconds: Math.ceil((this.lockedUntil - now) / 1000)
                };
            }
            return { locked: false, remainingSeconds: 0 };
        }

        /**
         * Record a failed attempt. Returns lockout status.
         * @returns {{ locked: boolean, remainingSeconds: number }}
         */
        recordFailure() {
            this.attempts++;
            if (this.attempts >= this.maxAttempts) {
                this.lockoutCount++;
                const cooldown = this.baseCooldownMs * Math.pow(2, this.lockoutCount - 1);
                this.lockedUntil = Date.now() + cooldown;
                this.attempts = 0;
                return {
                    locked: true,
                    remainingSeconds: Math.ceil(cooldown / 1000)
                };
            }
            return { locked: false, remainingSeconds: 0, attemptsLeft: this.maxAttempts - this.attempts };
        }

        /** Reset after successful login */
        reset() {
            this.attempts = 0;
            this.lockoutCount = 0;
            this.lockedUntil = 0;
        }
    }


    // ===== 4. Secure Session Management (Backend Bridge) =====

    const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000/api' 
        : '/api';
    const SESSION_KEY = 'jy_session';

    /**
     * Authenticate with the backend
     * @param {string} username
     * @param {string} password
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async function login(username, password) {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            
            if (response.ok) {
                const session = {
                    token: data.token,
                    username: data.username,
                    role: data.role,
                    expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
                };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
                return { success: true };
            }
            return { success: false, error: data.error };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Error de conexión con el servidor' };
        }
    }

    /**
     * Get the current JWT token
     * @returns {string|null}
     */
    function getToken() {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        try {
            const session = JSON.parse(raw);
            if (Date.now() > session.expiresAt) {
                destroySession();
                return null;
            }
            return session.token;
        } catch {
            return null;
        }
    }

    /**
     * Validate the current session.
     * @returns {{ valid: boolean, username: string|null }}
     */
    function validateSession() {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return { valid: false, username: null };
        try {
            const session = JSON.parse(raw);
            if (Date.now() > session.expiresAt) {
                destroySession();
                return { valid: false, username: null };
            }
            return { valid: true, username: session.username };
        } catch {
            destroySession();
            return { valid: false, username: null };
        }
    }

    /** Destroy the current session */
    function destroySession() {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.hash = '#home';
        location.reload();
    }

    /**
     * Perform an authenticated API request
     * @param {string} endpoint
     * @param {object} options
     */
    async function apiRequest(endpoint, options = {}) {
        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': token } : {}),
            ...options.headers
        };

        try {
            const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
            if (response.status === 401 || response.status === 403) {
                destroySession();
                throw new Error('Sesión expirada');
            }
            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }


    // ===== 5. File Upload Validation =====

    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

    /**
     * Validate an uploaded file.
     * @param {File} file
     * @returns {{ valid: boolean, error: string|null }}
     */
    function validateFileUpload(file) {
        if (!file) return { valid: false, error: 'No se seleccionó archivo.' };

        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return {
                valid: false,
                error: `Tipo de archivo no permitido (${file.type || 'desconocido'}). Solo se permiten: JPG, PNG, GIF, WEBP.`
            };
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            return {
                valid: false,
                error: `Archivo demasiado grande (${sizeMB}MB). Máximo permitido: 5MB.`
            };
        }

        return { valid: true, error: null };
    }


    // ===== 6. Input Validation =====

    /**
     * Validate an input value by type.
     * @param {string} value
     * @param {'email'|'phone'|'text'|'number'|'date'} type
     * @returns {{ valid: boolean, error: string|null }}
     */
    function validateInput(value, type) {
        const trimmed = (value || '').trim();

        if (!trimmed) return { valid: false, error: 'Este campo es requerido.' };

        switch (type) {
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
                    return { valid: false, error: 'Correo electrónico no válido.' };
                break;
            case 'phone':
                if (!/^[\d\s\-+()]{7,20}$/.test(trimmed))
                    return { valid: false, error: 'Número de teléfono no válido.' };
                break;
            case 'text':
                if (trimmed.length < 2)
                    return { valid: false, error: 'Mínimo 2 caracteres.' };
                if (trimmed.length > 200)
                    return { valid: false, error: 'Máximo 200 caracteres.' };
                break;
            case 'number':
                if (isNaN(Number(trimmed)) || Number(trimmed) <= 0)
                    return { valid: false, error: 'Debe ser un número positivo.' };
                break;
            case 'date':
                if (isNaN(Date.parse(trimmed)))
                    return { valid: false, error: 'Fecha no válida.' };
                break;
        }

        return { valid: true, error: null };
    }


    // ===== Public API =====
    return {
        sanitizeHTML,
        sanitizeURL,
        hashPassword,
        RateLimiter,
        login,
        validateSession,
        destroySession,
        apiRequest,
        getToken,
        validateFileUpload,
        validateInput
    };

})();
