# Guía de Pruebas de Autenticación (Sanctum SPA)

Esta guía describe cómo probar los endpoints de autenticación de la API utilizando `curl` y Postman, enfocándose en el flujo SPA (Stateful) de Laravel Sanctum.

## Requisitos Previos

- Backend corriendo en `http://localhost:8000` (o similar).
- Base de datos migrada (`php artisan migrate`).

## Flujo de Autenticación SPA

Laravel Sanctum en modo SPA utiliza cookies (`laravel_session` y `XSRF-TOKEN`) en lugar de tokens Bearer estáticos. El flujo es:

1.  Solicitar CSRF Cookie (`/sanctum/csrf-cookie`).
2.  Login (`/login`) enviando credenciales + Header `X-XSRF-TOKEN`.
3.  Peticiones autenticadas (`/api/user`) enviando cookies de sesión.

---

## Pruebas con cURL

### 1. Obtener CSRF Cookie

Primero, obtenemos la cookie CSRF y la guardamos en `cookies.txt`.

```bash
curl -c cookies.txt -I http://localhost:8000/sanctum/csrf-cookie
```

### 2. Registrar Usuario (Opcional)

Si no tienes usuario, regístrate. Nota que necesitamos extraer el token XSRF de `cookies.txt` manualmente para el header, pero `curl` manejará las cookies automáticamente con `-b` y `-c`.

*Nota: Para simplificar en curl, a veces es más fácil usar Postman. Pero si insistes:*

```bash
# Extraer XSRF-TOKEN de cookies.txt (valor decodificado URL)
# ... (paso manual complejo en terminal)
```

**Mejor enfoque para curl simple (API Token Flow - si estuviera habilitado):**
Como estamos usando SPA flow, curl es tedioso. Se recomienda Postman.

---

## Pruebas con Postman (Recomendado)

### Configuración Inicial

1.  Crear una nueva colección "CrediPep Auth".
2.  Configurar una variable de entorno `baseUrl` = `http://localhost:8000`.

### Paso 1: CSRF Cookie

-   **Método**: `GET`
-   **URL**: `{{baseUrl}}/sanctum/csrf-cookie`
-   **Tests**:
    ```javascript
    pm.test("Status code is 204", function () {
        pm.response.to.have.status(204);
    });
    ```
-   **Importante**: Postman maneja las cookies automáticamente.

### Paso 2: Login

-   **Método**: `POST`
-   **URL**: `{{baseUrl}}/login`
-   **Headers**:
    -   `Content-Type`: `application/json`
    -   `Accept`: `application/json`
    -   `X-XSRF-TOKEN`: `{{xsrf-token}}` (Ver script abajo)
-   **Body (JSON)**:
    ```json
    {
        "email": "test@example.com",
        "password": "password"
    }
    ```
-   **Pre-request Script** (para leer la cookie XSRF y ponerla en header):
    ```javascript
    var xsrfCookie = pm.cookies.get("XSRF-TOKEN");
    pm.environment.set("xsrf-token", decodeURIComponent(xsrfCookie));
    ```

### Paso 3: Obtener Usuario (Prueba de Auth)

-   **Método**: `GET`
-   **URL**: `{{baseUrl}}/api/user`
-   **Headers**:
    -   `Accept`: `application/json`
    -   `Referer`: `http://localhost:3000` (o tu dominio frontend)

### Errores Comunes

-   **419 CSRF Token Mismatch**: Ocurre si no envías el header `X-XSRF-TOKEN` o si la cookie no coincide. Asegúrate de ejecutar el paso 1 antes del 2.
-   **401 Unauthorized**: La sesión no se estableció o expiró. Vuelve a hacer login.
