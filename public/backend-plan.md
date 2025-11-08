# Plan de Proyecto: Desarrollo de Backend en Laravel para LexConnect

## Objetivo

Desarrollar un backend robusto y escalable utilizando el framework Laravel para dar soporte a la aplicación frontend de Next.js. El proyecto se ejecutará en un plazo de 10 días hábiles.

## Tecnologías Propuestas

*   **Framework**: Laravel (última versión LTS)
*   **Base de Datos**: MySQL
*   **Autenticación**: Laravel Sanctum (para autenticación de API basada en tokens/SPA)
*   **Servidor**: Nginx / Apache con PHP-FPM

## Supuestos

*   El desarrollador de backend tiene un entorno de desarrollo local con PHP, Composer y MySQL ya configurado.
*   El esquema de base de datos SQL proporcionado es el punto de partida para los modelos y migraciones.
*   La comunicación entre el frontend de Next.js y el backend de Laravel se realizará a través de una API RESTful.

---

## Cronograma del Proyecto (10 Días)

### **Hito 1: Configuración, Autenticación y Modelos Base (Días 1-2)**

El objetivo de este hito es establecer la base del proyecto y asegurar la autenticación de usuarios.

*   **Día 1: Configuración del Proyecto y Base de Datos**
    *   **Tarea 1.1**: Inicializar un nuevo proyecto de Laravel.
    *   **Tarea 1.2**: Configurar la conexión a la base de datos MySQL.
    *   **Tarea 1.3**: Implementar las migraciones de la base de datos basadas en el script `database.sql` para las tablas principales: `users` (personal), `clients`, `leads`, `investors`.
    *   **Tarea 1.4**: Crear los modelos Eloquent correspondientes: `User`, `Client`, `Lead`, `Investor`.
    *   **Entregable**:
        *   Repositorio de Git con el proyecto Laravel inicializado.
        *   Migraciones y modelos base funcionales.

*   **Día 2: Autenticación y Endpoints de Usuario**
    *   **Tarea 2.1**: Instalar y configurar Laravel Sanctum para la autenticación de SPA.
    *   **Tarea 2.2**: Crear los endpoints para registro, login (`/login`) y logout (`/logout`).
    *   **Tarea 2.3**: Crear un endpoint protegido para obtener los datos del usuario autenticado (`/api/user`).
    *   **Entregable**:
        *   Endpoints de autenticación funcionales.
        *   Documentación básica en Postman o similar para probar la autenticación.

### **Hito 2: Módulos de Clientes y Oportunidades (Días 3-4)**

Enfocado en la gestión de clientes, leads y oportunidades de negocio.

*   **Día 3: CRUD de Clientes y Leads**
    *   **Tarea 3.1**: Crear modelos y migraciones para `Opportunities`.
    *   **Tarea 3.2**: Implementar los controladores y rutas de API (Resource Controllers) para el CRUD completo de `Leads` y `Clients`.
        *   `GET /api/leads`, `POST /api/leads`, `GET /api/leads/{id}`, `PUT /api/leads/{id}`, `DELETE /api/leads/{id}`.
        *   `GET /api/clients`, `POST /api/clients`, `GET /api/clients/{id}`, `PUT /api/clients/{id}`, `DELETE /api/clients/{id}`.
    *   **Tarea 3.3**: Implementar un endpoint para convertir un `Lead` en `Client`.
        *   `POST /api/leads/{id}/convert`.
    *   **Entregable**:
        *   Endpoints funcionales para la gestión de clientes y leads.

*   **Día 4: CRUD de Oportunidades y Análisis**
    *   **Tarea 4.1**: Implementar el CRUD para `Opportunities`.
    *   **Tarea 4.2**: Implementar el endpoint para la página de "Análisis", que obtendrá una lista combinada de leads y sus oportunidades asociadas.
        *   `GET /api/credit-analysis`.
    *   **Entregable**:
        *   Endpoints funcionales para Oportunidades.
        *   Endpoint de análisis listo para ser consumido.

### **Hito 3: Módulo Financiero - Créditos y Cobros (Días 5-6)**

Desarrollo de la lógica principal del negocio: créditos y su seguimiento.

*   **Día 5: Gestión de Créditos y Calculadora**
    *   **Tarea 5.1**: Crear modelo y migración para `Credits` y `CreditConfigs`.
    *   **Tarea 5.2**: Implementar el CRUD para `Credits`.
    *   **Tarea 5.3**: Crear endpoints para obtener y actualizar la configuración de los tipos de crédito (regular, micro).
        *   `GET /api/credit-configs`, `PUT /api/credit-configs`.
    *   **Entregable**:
        *   Endpoints para la gestión completa de créditos y su configuración.

*   **Día 6: Gestión de Cobros y Abonos**
    *   **Tarea 6.1**: Crear modelo y migración para `Payments` (Abonos).
    *   **Tarea 6.2**: Implementar endpoint para la vista de "Gestión de Cobros", que permita filtrar créditos por días de mora.
        *   `GET /api/collections?days_in_arrears_start=30&days_in_arrears_end=60`.
    *   **Tarea 6.3**: Implementar el CRUD para `Payments` (Abonos), incluyendo la carga masiva desde planilla (CSV).
    *   **Entregable**:
        *   API para el módulo de cobros y abonos finalizada.

### **Hito 4: Módulos Legales e Inversiones (Días 7-8)**

Implementación de la gestión de casos legales e inversiones.

*   **Día 7: Módulos de Amparos y Cobro Judicial**
    *   **Tarea 7.1**: Crear modelos y migraciones para `Cases` (amparos, ejecuciones), `CaseTasks`, `JudicialNotifications`.
    *   **Tarea 7.2**: Implementar el CRUD para `Cases` filtrando por tipo (Amparo CCSS, Amparo MEP, Ejecución).
    *   **Tarea 7.3**: Implementar los endpoints para las pestañas de "Cobro Judicial" (Casos, Notificaciones Judiciales, Notificaciones Indefinidas).
    *   **Entregable**:
        *   Endpoints para la gestión de todos los tipos de casos legales y sus notificaciones.

*   **Día 8: Módulo de Inversiones**
    *   **Tarea 8.1**: Crear modelo y migración para `Investments` y `InterestPayments` (pago a inversionistas).
    *   **Tarea 8.2**: Implementar el CRUD para `Investors` e `Investments`.
    *   **Tarea 8.3**: Implementar los endpoints para las pestañas de "Inversiones": Inversionistas, Inversiones, Pago a Inversionistas y Retenciones.
    *   **Entregable**:
        *   API completa para el módulo de Inversiones.

### **Hito 5: Módulos Operativos y Despliegue (Días 9-10)**

Finalización de funcionalidades secundarias y preparación para producción.

*   **Día 9: Módulos de Soporte y Comunicaciones**
    *   **Tarea 9.1**: Crear modelos y migraciones para `Conversations`, `ChatMessages`, `InternalNotes`, `Branches`, `Volunteers` y `Routes`.
    *   **Tarea 9.2**: Implementar los endpoints para el CRUD de cada uno de estos módulos.
    *   **Tarea 9.3**: Implementar la lógica para el chat en el módulo de "Comunicaciones".
    *   **Entregable**:
        *   Endpoints para los módulos operativos restantes.

*   **Día 10: Pruebas Finales, Documentación y Despliegue**
    *   **Tarea 10.1**: Realizar pruebas de integración de todos los endpoints.
    *   **Tarea 10.2**: Finalizar la documentación de la API (Colección de Postman o similar).
    *   **Tarea 10.3**: Escribir un script de despliegue básico (ej. usando `git pull`, `composer install`, `php artisan migrate`).
    *   **Tarea 10.4**: Configurar el entorno del servidor (Nginx, PHP-FPM, MySQL) y realizar el primer despliegue en el servidor del cliente.
    *   **Entregable**:
        *   Aplicación desplegada en el servidor.
        *   Documentación final de la API.
        *   Guía básica de despliegue.

---
Este plan es ambicioso pero factible. Se recomienda una comunicación constante entre el desarrollador de backend y el de frontend para asegurar que los endpoints cumplan con los requisitos de la interfaz de usuario.
