/**
 * SecureFetch - Librería de Fetch con seguridad mejorada y control de errores
 * @version 1.0.0
 * @license MIT
 */

class SecureFetch {
  /**
   * Constructor de la librería
   * @param {Object} config - Configuración global
   */
  constructor(config = {}) {
    this.config = {
      baseURL: config.baseURL || '',
      timeout: config.timeout || 10000,
      credentials: config.credentials || 'same-origin',
      defaultHeaders: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        ...config.defaultHeaders
      },
      csrf: {
        enabled: config.csrf?.enabled !== false,
        tokenName: config.csrf?.tokenName || 'X-CSRF-Token',
        cookieName: config.csrf?.cookieName || 'csrfToken',
        headerName: config.csrf?.headerName || 'X-CSRF-Token'
      },
      retry: {
        enabled: config.retry?.enabled || false,
        maxRetries: config.retry?.maxRetries || 3,
        retryDelay: config.retry?.retryDelay || 1000
      }
    };

    this.errorTypes = {
      NETWORK_ERROR: 'NETWORK_ERROR',
      TIMEOUT_ERROR: 'TIMEOUT_ERROR',
      HTTP_ERROR: 'HTTP_ERROR',
      ABORT_ERROR: 'ABORT_ERROR',
      CSRF_ERROR: 'CSRF_ERROR',
      VALIDATION_ERROR: 'VALIDATION_ERROR'
    };
  }

  /**
   * Obtiene el token CSRF de las cookies
   * @returns {string|null} Token CSRF o null si no existe
   */
  getCsrfToken() {
    if (!this.config.csrf.enabled) return null;
    
    const name = this.config.csrf.cookieName + '=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length);
      }
    }
    return null;
  }

  /**
   * Valida la respuesta HTTP
   * @param {Response} response - Respuesta de fetch
   * @returns {Response} Respuesta validada
   * @throws {Error} Error de validación
   */
  validateResponse(response) {
    if (!response) {
      throw this.createError(
        'No se recibió respuesta del servidor',
        this.errorTypes.NETWORK_ERROR
      );
    }

    // Validar CSRF para métodos no seguros
    if (this.config.csrf.enabled && 
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(response.url?.method || '')) {
      const csrfHeader = response.headers.get(this.config.csrf.headerName);
      if (!csrfHeader) {
        console.warn('Advertencia: No se encontró header CSRF en la respuesta');
      }
    }

    return response;
  }

  /**
   * Crea un error estructurado
   * @param {string} message - Mensaje de error
   * @param {string} type - Tipo de error
   * @param {any} details - Detalles adicionales
   * @returns {Error} Error estructurado
   */
  createError(message, type = this.errorTypes.NETWORK_ERROR, details = null) {
    const error = new Error(message);
    error.name = 'SecureFetchError';
    error.type = type;
    error.details = details;
    error.timestamp = new Date().toISOString();
    return error;
  }

  /**
   * Intenta reintentar la petición en caso de error
   * @param {Function} fetchFn - Función que ejecuta el fetch
   * @param {number} retriesLeft - Intentos restantes
   * @returns {Promise<Response>} Respuesta de la petición
   */
  async retryFetch(fetchFn, retriesLeft) {
    try {
      return await fetchFn();
    } catch (error) {
      if (retriesLeft > 0 && 
          (error.type === this.errorTypes.NETWORK_ERROR || 
           error.type === this.errorTypes.TIMEOUT_ERROR)) {
        
        await new Promise(resolve => 
          setTimeout(resolve, this.config.retry.retryDelay)
        );
        
        return this.retryFetch(fetchFn, retriesLeft - 1);
      }
      throw error;
    }
  }

  /**
   * Ejecuta una petición fetch segura
   * @param {string} url - URL de la petición
   * @param {Object} options - Opciones de fetch
   * @returns {Promise<Response>} Respuesta de la petición
   */
  async fetch(url, options = {}) {
    // Construir URL completa
    const fullUrl = this.config.baseURL ? 
      `${this.config.baseURL}${url}` : url;

    // Configuración por defecto
    const defaultOptions = {
      credentials: this.config.credentials,
      headers: { ...this.config.defaultHeaders },
      signal: null
    };

    // Añadir token CSRF si está habilitado
    if (this.config.csrf.enabled && 
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || '')) {
      const csrfToken = this.getCsrfToken();
      if (csrfToken) {
        defaultOptions.headers[this.config.csrf.headerName] = csrfToken;
      } else {
        console.warn('Token CSRF no encontrado. La petición puede ser rechazada por el servidor.');
      }
    }

    // Combinar headers (los proporcionados por el usuario tienen prioridad)
    const headers = {
      ...defaultOptions.headers,
      ...options.headers
    };

    // Preparar opciones finales
    const fetchOptions = {
      ...defaultOptions,
      ...options,
      headers
    };

    // Control de timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, options.timeout || this.config.timeout);

    fetchOptions.signal = controller.signal;

    // Función interna de fetch
    const fetchFn = async () => {
      try {
        const response = await fetch(fullUrl, fetchOptions);
        clearTimeout(timeoutId);
        
        // Validar respuesta
        this.validateResponse(response);
        
        // Si la respuesta no es exitosa, lanzar error
        if (!response.ok) {
          let errorDetails = null;
          
          try {
            const errorData = await response.clone().json();
            errorDetails = errorData;
          } catch {
            try {
              const errorText = await response.clone().text();
              errorDetails = errorText;
            } catch {
              errorDetails = null;
            }
          }
          
          throw this.createError(
            `Error HTTP ${response.status}: ${response.statusText}`,
            this.errorTypes.HTTP_ERROR,
            {
              status: response.status,
              statusText: response.statusText,
              url: fullUrl,
              details: errorDetails
            }
          );
        }
        
        return response;
        
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Determinar tipo de error
        if (error.name === 'AbortError') {
          throw this.createError(
            `Timeout: La petición excedió el tiempo límite de ${options.timeout || this.config.timeout}ms`,
            this.errorTypes.TIMEOUT_ERROR,
            { url: fullUrl }
          );
        } else if (error.name === 'SecureFetchError') {
          throw error;
        } else {
          throw this.createError(
            `Error de red: ${error.message}`,
            this.errorTypes.NETWORK_ERROR,
            { 
              url: fullUrl,
              originalError: error.message 
            }
          );
        }
      }
    };

    // Ejecutar con reintentos si está configurado
    if (this.config.retry.enabled) {
      return this.retryFetch(fetchFn, this.config.retry.maxRetries);
    }
    
    return fetchFn();
  }

  /**
   * Métodos HTTP simplificados
   */
  async get(url, options = {}) {
    return this.fetch(url, { ...options, method: 'GET' });
  }

  async post(url, data = {}, options = {}) {
    return this.fetch(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put(url, data = {}, options = {}) {
    return this.fetch(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async patch(url, data = {}, options = {}) {
    return this.fetch(url, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async delete(url, options = {}) {
    return this.fetch(url, { ...options, method: 'DELETE' });
  }

  /**
   * Método para procesar respuestas JSON con manejo de errores
   * @param {Response} response - Respuesta de fetch
   * @returns {Promise<any>} Datos parseados
   */
  async processJsonResponse(response) {
    try {
      const data = await response.json();
      return {
        success: true,
        data,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      throw this.createError(
        'Error al parsear la respuesta JSON',
        this.errorTypes.VALIDATION_ERROR,
        { originalError: error.message }
      );
    }
  }

  /**
   * Método para procesar respuestas de texto con manejo de errores
   * @param {Response} response - Respuesta de fetch
   * @returns {Promise<string>} Texto de respuesta
   */
  async processTextResponse(response) {
    try {
      const text = await response.text();
      return {
        success: true,
        data: text,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      throw this.createError(
        'Error al leer la respuesta de texto',
        this.errorTypes.VALIDATION_ERROR,
        { originalError: error.message }
      );
    }
  }
}

/**
 * Función helper para uso rápido (similar a tu función original)
 * @param {string} url - URL de la petición
 * @param {Object} options - Opciones de fetch
 * @returns {Promise<Response>} Respuesta de la petición
 */
async function secureFetch(url, options = {}) {
  const instance = new SecureFetch();
  return instance.fetch(url, options);
}

// Exportar para diferentes entornos
if (typeof module !== 'undefined' && module.exports) {
  // Node.js/CommonJS
  module.exports = { SecureFetch, secureFetch };
} else if (typeof define === 'function' && define.amd) {
  // AMD
  define([], () => ({ SecureFetch, secureFetch }));
} else {
  // Browser global
  window.SecureFetch = SecureFetch;
  window.secureFetch = secureFetch;
}
