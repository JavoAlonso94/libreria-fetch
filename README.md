SecureFetch

SecureFetch es una librería moderna que extiende fetch() con seguridad mejorada, protección CSRF automática, reintentos configurables, validación de respuestas, timeout avanzado y manejo robusto de errores tipificados.
Ideal para aplicaciones web que consumen APIs seguras o requieren mayor control en el flujo de peticiones HTTP.

📦 Instalación
NPM / Node
npm install secure-fetch

Uso desde CDN
<script src="secure-fetch.js"></script>

🚀 Características principales
🔒 Protección CSRF automática

Obtiene automáticamente el token desde cookies y lo envía en headers configurables.

⏱ Timeout integrado

Cada petición se aborta automáticamente si supera el tiempo límite.

🔁 Reintentos automáticos

Reintenta peticiones fallidas por errores de red o timeout.

🛡 Validación de respuestas

Permite detectar respuestas HTTP inválidas, errores CSRF e inconsistencias.

⚠️ Manejo robusto de errores tipificados

Errores siempre estructurados con:

type

message

details

timestamp

🔧 Métodos HTTP simplificados

.get(), .post(), .put(), .patch(), .delete()

📦 Parseo seguro

Métodos especializados:

processJsonResponse()

processTextResponse()

📘 Ejemplos de uso
1. Uso básico (similar a un fetch tradicional)
try {
  const response = await secureFetch('https://api.example.com/data', {
    method: 'POST',
    body: JSON.stringify({ key: 'value' })
  });
  const data = await response.json();
} catch (error) {
  console.error('Error:', error.type, error.message);
}

2. Uso recomendado con la clase SecureFetch
const api = new SecureFetch({
  baseURL: 'https://api.example.com',
  timeout: 15000,
  csrf: {
    enabled: true,
    cookieName: 'myCsrfToken'
  },
  retry: {
    enabled: true,
    maxRetries: 3
  }
});

try {
  // GET
  const response = await api.get('/users');
  const result = await api.processJsonResponse(response);
  console.log('Usuarios:', result.data);

  // POST con CSRF automático
  const postResponse = await api.post('/users', {
    name: 'John Doe',
    email: 'john@example.com'
  });
  const postResult = await api.processJsonResponse(postResponse);

} catch (error) {
  console.error('Error completo:', error);

  switch (error.type) {
    case api.errorTypes.TIMEOUT_ERROR:
      console.warn('La petición expiró.');
      break;
    case api.errorTypes.HTTP_ERROR:
      console.warn('Error HTTP:', error.details.status);
      break;
    case api.errorTypes.CSRF_ERROR:
      console.warn('Token CSRF faltante o inválido.');
      break;
  }
}

3. Configuración para API con CSRF (Laravel, Spring, etc.)
const secureApi = new SecureFetch({
  baseURL: '/api',
  csrf: {
    enabled: true,
    tokenName: 'X-XSRF-TOKEN',
    cookieName: 'XSRF-TOKEN',
    headerName: 'X-XSRF-TOKEN'
  },
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

⚙️ Configuración completa
{
  baseURL: string,
  timeout: number,
  credentials: string,

  defaultHeaders: {
    'Content-Type': string,
    'X-Content-Type-Options': string
  },

  csrf: {
    enabled: boolean,
    tokenName: string,
    cookieName: string,
    headerName: string
  },

  retry: {
    enabled: boolean,
    maxRetries: number,
    retryDelay: number
  }
}

🔧 Métodos HTTP
Método	Descripción
get(url, options)	Realiza una petición GET
post(url, data, options)	POST con JSON
put(url, data, options)	PUT con JSON
patch(url, data, options)	PATCH con JSON
delete(url, options)	DELETE simple
🔍 Manejo de errores

Todos los errores tienen la forma:

{
  "name": "SecureFetchError",
  "type": "HTTP_ERROR",
  "message": "Error HTTP 404: Not Found",
  "details": { ... },
  "timestamp": "2025-12-01T10:00:00.000Z"
}

Tipos de error disponibles
Tipo	Descripción
NETWORK_ERROR	Error de red / conexión
TIMEOUT_ERROR	Excedió el tiempo límite
HTTP_ERROR	Status 4xx/5xx
ABORT_ERROR	Aborto manual / timeout
CSRF_ERROR	Token CSRF ausente o inválido
VALIDATION_ERROR	Fallo al parsear JSON/texto
🧪 Parseo seguro
JSON:
const result = await api.processJsonResponse(response);

Texto:
const text = await api.processTextResponse(response);


Cada uno devuelve:

{
  success: true,
  data: ...,
  status: 200,
  headers: {}
}

📄 API Helper: secureFetch()

La librería incluye una función simple que crea una instancia por defecto:

async function secureFetch(url, options = {})


Ideal para usos rápidos o scripts pequeños.

📂 Exportación

Compatible con:

Node.js / CommonJS

AMD

Browser global

module.exports = { SecureFetch, secureFetch };

🧩 Ejemplo de uso global (browser)
<script src="secure-fetch.js"></script>
<script>
  async function run() {
    const api = new SecureFetch({ baseURL: '/api' });
    const res = await api.get('/status');
    console.log(await res.json());
  }
  run();
</script>

📜 Licencia
Apche 2
