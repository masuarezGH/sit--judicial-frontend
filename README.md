# SIT Judicial - Frontend

Frontend del sistema **SIT Judicial – Mesa de Ayuda**, desarrollado con **HTML5, CSS3 y JavaScript**.

Este sistema permite la gestión integral de:

* Inventario de activos (hardware y software)
* Tickets de soporte técnico
* Contratos
* Usuarios del sistema

Se conecta a una API backend (Node.js + MySQL) para el manejo de datos.

---

## Tecnologías utilizadas

* HTML5
* CSS3
* JavaScript (Vanilla JS)
* Docker
* Nginx

---

## Estructura del proyecto

```
sitjudicial-frontend/
├── index.html
├── styles.css
├── app.js
├── Dockerfile
├── nginx.conf
├── .dockerignore
└── README.md
```

---

## Requisitos

Antes de ejecutar el frontend, es necesario:

* Tener **Docker** instalado
* Tener el **backend corriendo** en:

```
http://localhost:8080
```

---

## Ejecución con Docker

### 1. Construir la imagen

```bash
docker build -t sitjudicial-frontend .
```

### 2. Ejecutar el contenedor

```bash
docker run -d -p 3000:80 --name sit_front sitjudicial-frontend
```

### 3. Acceder a la aplicación

Abrir en el navegador:

```
http://localhost:3000
```

---

## Configuración de la API

En el archivo `app.js` se define la URL del backend:

```javascript
const API_BASE_URL = "http://localhost:8080";
```

Asegurate de que el backend esté corriendo en esa dirección.

---

## Funcionalidades principales

### Autenticación

* Inicio de sesión con usuarios del sistema
* Manejo de roles:

  * ADMIN
  * OPERADOR
  * TECNICO

---

### Inventario de activos

* Alta de hardware y software
* Asociación con contratos
* Estado del activo:

  * Operativo
  * Falla
  * Dado de baja
* Historial completo del activo
* Reactivación de activos

---

### Tickets

* Creación de tickets
* Asignación de técnicos
* Edición desde modal
* Bitácora técnica
* Cambio de estado:

  * Abierto
  * En proceso
  * Cerrado

---

### Contratos

* Creación de contratos
* Estado automático:

  * Vigente
  * Vencido
* Alertas:

  * URGENTE
  * POR VENCER
  * SIN ALERTA
* Filtros por estado y alerta

---

### Usuarios

* Creación de usuarios (solo ADMIN)
* Activación / desactivación
* Roles diferenciados
* Cambio de contraseña

---

## Seguridad

* Autenticación mediante JWT
* Control de acceso por roles
* Protección de endpoints en backend

---

## Consideraciones

* El frontend depende completamente del backend
* No utiliza frameworks (implementación pura en JavaScript)
* La persistencia de datos se maneja desde la API

---

## Autor

Marcos Suarez

---

## Notas finales

Este frontend fue diseñado con un enfoque simple, funcional y escalable, priorizando:

* Claridad en la interfaz
* Separación de responsabilidades
* Facilidad de mantenimiento
* Integración con backend mediante API REST

---
