<p align="center">
  🌐 &nbsp;
  <a href="README.md">English</a> &nbsp;|&nbsp;
  <a href="README_ch.md">中文</a> &nbsp;|&nbsp;
  <strong>Español</strong> &nbsp;|&nbsp;
  <a href="README_fr.md">Français</a> &nbsp;|&nbsp;
  <a href="README_ja.md">日本語</a> &nbsp;|&nbsp;
  <a href="README_ko.md">한국어</a>
</p>

# AssetPilot — Gestión de Activos Personales

<p align="center">
  <img src="logo.svg" alt="AssetPilot Logo" width="120">
</p>

<p align="center">
  Una aplicación web de gestión de activos personales — contabilidad, seguimiento de acciones y gestión de presupuesto, todo en un solo lugar.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.0.4-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="license">
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="docker">
</p>

---

## Tabla de Contenidos

- [Introducción](#introducción)
- [Características Principales](#características-principales)
- [Funcionalidades](#funcionalidades)
  - [Panel de Control](#panel-de-control)
  - [Gestión Financiera](#gestión-financiera)
  - [Registros de Acciones](#registros-de-acciones)
  - [Informes](#informes)
  - [Gestión de Presupuesto](#gestión-de-presupuesto)
  - [Gestión de Cuentas](#gestión-de-cuentas)
  - [Configuración y Administración](#configuración-y-administración)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Instalación](#instalación)
  - [Opción 1: Despliegue con un clic en Docker Hub (Recomendado)](#opción-1-despliegue-con-un-clic-en-docker-hub-recomendado)
  - [Opción 2: Docker Compose](#opción-2-docker-compose)
  - [Opción 3: Ejecución directa con Node.js](#opción-3-ejecución-directa-con-nodejs)
- [Variables de Entorno](#variables-de-entorno)
- [Guía de Despliegue](#guía-de-despliegue)
  - [Synology NAS](#synology-nas)
  - [VPS en la Nube](#vps-en-la-nube)
  - [Proxy Inverso con Nginx](#proxy-inverso-con-nginx)
  - [Proxy Inverso con Caddy](#proxy-inverso-con-caddy)
- [Configuración de Google SSO](#configuración-de-google-sso)
- [Guía de Uso](#guía-de-uso)
  - [Configuración Inicial](#configuración-inicial)
  - [Agregar una Transacción](#agregar-una-transacción)
  - [Guía de Pago con Tarjeta de Crédito](#guía-de-pago-con-tarjeta-de-crédito)
  - [Gestión de Acciones](#gestión-de-acciones)
  - [Gestión de Tipos de Cambio](#gestión-de-tipos-de-cambio)
  - [Exportación e Importación CSV](#exportación-e-importación-csv)
  - [Operaciones de Administrador](#operaciones-de-administrador)
- [Gestión Avanzada de Docker](#gestión-avanzada-de-docker)
- [Seguridad](#seguridad)
- [Estructura de Archivos](#estructura-de-archivos)
- [Fuentes de API](#fuentes-de-api)
- [Licencia](#licencia)

---

## Introducción

**AssetPilot** es una aplicación web de gestión de activos personales diseñada con privacidad como prioridad.

Todos los datos se almacenan localmente (o en tu servidor propio) — no se requiere ninguna base de datos en la nube de terceros. Se despliega con un solo comando de Docker, siendo ideal para NAS domésticos (como Synology), VPS o tu equipo local.

**¿Para quién es?**

- Personas que desean controlar su flujo de caja personal, ingresos/gastos mensuales y presupuesto
- Inversores en el mercado de valores de Taiwán que necesitan gestionar posiciones, ganancias/pérdidas y dividendos
- Usuarios preocupados por la privacidad que no quieren que sus datos financieros sean almacenados en plataformas de terceros

---

## Características Principales

| Característica | Descripción |
|----------------|-------------|
| 🏠 **Auto-alojado, Control de Datos** | Base de datos cifrada almacenada localmente; ningún dato financiero se sube a servidores externos |
| 🐳 **Despliegue con un clic en Docker** | Sin configuración requerida; claves JWT y de cifrado generadas automáticamente |
| 📊 **Integración Profunda con TWSE** | Precios de acciones en tiempo real, sincronización automática de ex-dividendos, cálculo de P&G con FIFO mediante la API de TWSE |
| 💱 **Soporte Multidivisa** | Más de 150 divisas compatibles, con tipos de cambio en tiempo real desde exchangerate-api.com |
| 📱 **Diseño Responsivo** | Funciona fluidamente tanto en escritorio como en móvil |
| 🔒 **Seguridad Empresarial** | Cifrado de base de datos ChaCha20-Poly1305, cabeceras de seguridad Helmet, limitación de velocidad, CSP |
| 👥 **Gestión Multiusuario** | Soporta múltiples usuarios; el administrador puede controlar la política de registro y auditar registros de inicio de sesión |
| 🔑 **Google SSO** | Inicio de sesión opcional con Google mediante OAuth Authorization Code Flow |

---

## Funcionalidades

### Panel de Control

- Tarjeta de resumen de activos totales (suma de todos los saldos de cuentas)
- Resumen mensual de ingresos / gastos
- Gráfico de dona por categoría de gastos (soporta gráfico de doble anillo: anillo interior = categoría padre, anillo exterior = subcategoría)
- Gráfico de dona de asignación de activos (activos en cuenta + valor de mercado de acciones, intercambiable a doble anillo)
- Lista de transacciones recientes

### Gestión Financiera

**Transacciones**
- CRUD de ingresos / gastos / transferencias con notas, categorías, cuentas y divisas
- Transacciones con fecha futura etiquetadas automáticamente con "Futuro" para identificación y filtrado
- Operaciones por lotes con selección múltiple: eliminación masiva, cambio masivo de categoría / cuenta / fecha
- Transferencias entre cuentas con emparejamiento bidireccional automático (`linked_id`)

**Gestión de Presupuesto**
- Presupuesto mensual total + presupuestos por categoría
- Barras de progreso visuales que muestran el presupuesto restante en tiempo real

**Gestión de Cuentas**
- Múltiples cuentas (efectivo, banco, tarjeta de crédito, etc.)
- Saldos calculados automáticamente a partir de los registros de transacciones
- Cuentas multidivisa con conversión de tipo de cambio en tiempo real

**Configuración de Tipos de Cambio**
- Conectado a exchangerate-api.com, con soporte para más de 150 divisas
- Activación manual o sincronización automática; muestra la marca de tiempo de la última actualización

**Gestión de Categorías**
- Estructura de categorías padre-hijo de dos niveles (ej. Comida → Desayuno / Almuerzo / Cena)
- Colores de categoría personalizados

**Transacciones Recurrentes**
- Configurar ingresos/gastos periódicos (alquiler, salario, etc.) que generan automáticamente registros de transacciones

### Registros de Acciones

**Resumen de Cartera**
- Cálculo en tiempo real del valor de mercado, P&G no realizado y tasa de retorno
- Obtiene automáticamente precios en vivo / de cierre de TWSE (estrategia de 3 fases)
- Actualización masiva de precios con fuente (precio en tiempo real / precio de cierre) y marca de tiempo por acción

**Registros de Transacciones**
- Registros de compra / venta con soporte para lotes completos y fracciones
- Comisión de corretaje calculada automáticamente (`0.1425%`, mínimo NT$20 para lotes completos)
- Impuesto de transacción de valores calculado automáticamente en ventas (acciones regulares `0.3%`, ETF/warrants `0.1%`)
- Introduce un símbolo bursátil para consultar TWSE automáticamente y crear la entrada de la acción (sin necesidad de agregarla manualmente primero)
- Búsqueda/filtro, paginación, eliminación masiva con selección múltiple

**Registros de Dividendos**
- Registros de dividendos en efectivo / dividendos en acciones
- Sincronización automática de ex-dividendos desde TWSE (`TWT49U` + `TWT49UDetail`), sin duplicados

**P&G Realizadas**
- Cálculo FIFO del coste medio, P&G realizado y tasa de retorno por venta
- Tarjetas de resumen: total de P&G realizadas, tasa de retorno global, P&G del año en curso

**Plan de Inversión Regular (DCA)**
- Establece un período y presupuesto por ciclo; las transacciones de compra se generan automáticamente

### Informes

- **Informe por Categorías**: Gráfico de dona de categorías padre, intercambiable a doble anillo (interior = padre, exterior = hijo); la leyenda y el tooltip muestran el importe y el porcentaje
- **Análisis de Tendencias**: Gráfico de líneas de ingresos / gastos mensuales
- **Gasto Diario**: Gráfico de barras de gastos diarios
- Filtro de rango de fechas personalizado

### Gestión de Cuentas

- Agregar, editar y eliminar múltiples cuentas
- Muestra el saldo en tiempo real de cada cuenta

### Configuración y Administración

**Configuración de Cuenta**
- Editar nombre de visualización y contraseña
- Ver historial de inicio de sesión personal (últimas 100 entradas) con marca de tiempo, IP, país y método de inicio de sesión

**Exportación e Importación de Datos**
- Exportación / importación CSV de registros de transacciones (incluida la estructura de categorías)
- Exportación / importación CSV de transacciones de acciones
- Exportación / importación CSV de registros de dividendos

**Funciones de Administrador**
- Activar/desactivar el registro público; configurar lista blanca de correos electrónicos
- Agregar / eliminar cuentas de usuario
- Ver todos los registros de inicio de sesión de usuarios (incluidos los intentos fallidos)
- Sincronizar manualmente los registros de inicio de sesión sin actualizar la página

---

## Tecnologías Utilizadas

| Capa | Tecnología |
|------|------------|
| Frontend | HTML / CSS / JavaScript puro (SPA con `history.pushState`) |
| Backend | Node.js + Express |
| Base de Datos | SQLite (sql.js, en memoria + persistencia en archivo) |
| Cifrado | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 |
| Autenticación | JWT (Bearer Token) + bcryptjs; Google OAuth Code Flow (opcional) |
| Gráficos | Chart.js |
| Iconos | Font Awesome 6 |
| Seguridad | Helmet, express-rate-limit, SRI, lista blanca CORS, CSP |

---

## Instalación

### Opción 1: Despliegue con un clic en Docker Hub (Recomendado)

Sin configuración necesaria — simplemente ejecuta:

```bash
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  es94111/assetpilot:latest
```

Abre [http://localhost:3000](http://localhost:3000) y estás listo para empezar.

> **¡Eso es todo!** La base de datos, la clave JWT, la clave de cifrado y el volumen se crean automáticamente.

---

### Opción 2: Docker Compose

Crea un archivo `docker-compose.yml`:

```yaml
services:
  assetpilot:
    image: es94111/assetpilot:latest
    container_name: assetpilot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - assetpilot-data:/app/data
    environment:
      - GOOGLE_CLIENT_ID=          # Opcional: introduce tu Google OAuth Client ID para habilitar SSO
      # - ALLOWED_ORIGINS=https://your-domain.com

volumes:
  assetpilot-data:
```

Inicia el contenedor:

```bash
docker compose up -d
```

---

### Opción 3: Ejecución directa con Node.js

**Requisitos:** Node.js >= 18

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env según sea necesario

# 3. Iniciar el servidor
node server.js
```

Abre [http://localhost:3000](http://localhost:3000) para comenzar a usar la aplicación.

---

## Variables de Entorno

| Variable | Descripción | Valor Predeterminado |
|----------|-------------|---------------------|
| `PORT` | Puerto del servidor | `3000` |
| `JWT_SECRET` | Clave de firma JWT (debe cambiarse en producción) | Generado automáticamente por Docker |
| `JWT_EXPIRES` | Período de expiración del JWT | `7d` |
| `DB_ENCRYPTION_KEY` | Clave de cifrado de la base de datos | Generado automáticamente por Docker |
| `DB_PATH` | Ruta del archivo de base de datos | `/app/data/database.db` |
| `ENV_PATH` | Ruta del archivo .env generado automáticamente | `/app/data/.env` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (opcional) | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret (opcional) | — |
| `ALLOWED_ORIGINS` | Lista blanca CORS, separada por comas (sin restricciones si está vacío) | — |
| `EXCHANGE_RATE_API_KEY` | Clave API de exchangerate-api.com (opcional) | — |
| `IPINFO_TOKEN` | Token de ipinfo.io para mayor cuota de consultas de IP (opcional) | — |
| `CHANGELOG_URL` | URL remota del changelog.json | URL predeterminada del repositorio en GitHub |

---

## Guía de Despliegue

### Synology NAS

**Opción A: Interfaz gráfica de Container Manager (Más sencilla)**

1. DSM → **Container Manager** → **Registro** → Buscar `es94111/assetpilot` → Descargar
2. **Contenedor** → **Crear** → Seleccionar `es94111/assetpilot:latest`
3. Configurar Puerto: `3000 → 3000`; el volumen se crea automáticamente
4. Iniciar el contenedor

**Opción B: Comando SSH**

```bash
sudo docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /volume1/docker/assetpilot/data:/app/data \
  es94111/assetpilot:latest
```

**Proxy Inverso (Dominio Personalizado + HTTPS)**

DSM → **Panel de Control** → **Portal de Inicio de Sesión** → **Avanzado** → **Proxy Inverso**, agregar una regla:

| Campo | Valor |
|-------|-------|
| Protocolo de Origen | HTTPS |
| Nombre de Host de Origen | `your-domain.com` |
| Puerto de Origen | 443 |
| Protocolo de Destino | HTTP |
| Nombre de Host de Destino | `localhost` |
| Puerto de Destino | `3000` |

Agregar cabecera personalizada: `X-Forwarded-For` → `$proxy_add_x_forwarded_for`

---

### VPS en la Nube

```bash
mkdir assetpilot && cd assetpilot

cat > docker-compose.yml << 'EOF'
services:
  assetpilot:
    image: es94111/assetpilot:latest
    container_name: assetpilot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - assetpilot-data:/app/data
    environment:
      - ALLOWED_ORIGINS=https://your-domain.com

volumes:
  assetpilot-data:
EOF

docker compose up -d
```

---

### Proxy Inverso con Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /ruta/al/cert.pem;
    ssl_certificate_key /ruta/al/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Proxy Inverso con Caddy

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy aprovisiona y renueva automáticamente los certificados HTTPS.

---

## Configuración de Google SSO

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) y crea un ID de cliente OAuth 2.0 (tipo: Aplicación web)
2. Configura los **Orígenes de JavaScript autorizados**:
   - Local: `http://localhost:3000`
   - Producción: `https://your-domain.com`
3. Configura los **URI de redireccionamiento autorizados**:
   - Local: `http://localhost:3000/`
   - Producción: `https://your-domain.com/`
4. Establece `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` como variables de entorno y reinicia
5. Si no está configurado, el botón de inicio de sesión con Google se oculta automáticamente y no afecta al inicio de sesión con contraseña

> ⚠️ Si te quedas atascado en `/?code=...` después del inicio de sesión, asegúrate de que el URI de redireccionamiento en Google Console coincida exactamente con tu dominio (incluyendo `https://` y la `/` final).

---

## Guía de Uso

### Configuración Inicial

1. Abre tu navegador y ve a `http://localhost:3000`
2. Haz clic en **"Registrarse ahora"** para crear una cuenta
3. **El primer usuario registrado se convierte automáticamente en administrador**
4. Las categorías predeterminadas (comida, ropa, vivienda, transporte, etc.) y las cuentas (efectivo, cuenta bancaria) se crean automáticamente
5. Estás listo para comenzar a usar la aplicación después de iniciar sesión

---

### Agregar una Transacción

1. Haz clic en **"Finanzas"** en la barra lateral
2. Haz clic en **"+ Agregar Transacción"** en la parte superior derecha
3. Completa la fecha, el tipo (ingreso / gasto / transferencia), el importe, la categoría y la cuenta
4. Opcionalmente agrega notas y divisa
5. Haz clic en **"Guardar"**

**Operaciones por Lotes:** Selecciona múltiples transacciones con casillas de verificación, luego usa la barra de acciones para eliminar en lote o cambiar en lote la categoría / cuenta / fecha.

---

### Guía de Pago con Tarjeta de Crédito

Al gastar con una tarjeta de crédito, regístralo como un **gasto** con la tarjeta de crédito como cuenta, permitiendo que el saldo sea negativo (reflejando tu deuda real).

**Al pagar la factura de tu tarjeta de crédito:**

1. **Finanzas** → **Agregar Transacción**
2. Establece el tipo como **Transferencia**
3. Cuenta de origen: tu **cuenta bancaria**
4. Cuenta de destino: tu **cuenta de tarjeta de crédito**
5. Introduce el importe del pago y guarda

Esto descuenta de tu saldo bancario y compensa el saldo negativo de la tarjeta de crédito — sin contarlo doble como gasto.

---

### Gestión de Acciones

**Agregar una Posición**

1. **Registros de Acciones** → **Transacciones** → **+ Agregar Transacción de Acciones**
2. Introduce el símbolo bursátil (ej. `2330`); el sistema consulta automáticamente TWSE y completa el nombre y el precio actual
3. Completa la fecha de compra, el número de acciones y el precio de transacción
4. La comisión de corretaje y el impuesto de transacción se calculan automáticamente (editables)
5. La posición se añade a tu cartera después de guardar

**Actualizar Precios de Acciones**

Haz clic en **"Actualizar Precios"** en la página de Cartera. El sistema utiliza una estrategia de 3 fases para obtener los últimos precios:
- Durante las horas de negociación → precio en tiempo real de TWSE
- Después del cierre del mercado → precio de cierre de STOCK_DAY
- En otros momentos → STOCK_DAY_ALL como respaldo

**Sincronizar Ex-dividendos**

**Registros de Dividendos** → **Sincronizar Ex-dividendos** — agrega automáticamente dividendos en efectivo y en acciones según tu período de tenencia (sin duplicados).

---

### Gestión de Tipos de Cambio

1. **Finanzas** → **Gestión de Cuentas** → **Configuración de Tipos de Cambio**
2. Haz clic en **"Obtener Tasas en Tiempo Real Ahora"** para sincronizar manualmente
3. O habilita **"Actualización Automática de Tipos de Cambio"** para sincronizar automáticamente al entrar en la página
4. Agrega cualquier código de divisa de 3 letras como divisa personalizada

---

### Exportación e Importación CSV

**Ruta:** **Configuración** → **Exportación e Importación de Datos**

| Tipo | Campos Exportados |
|------|-------------------|
| Transacciones | Fecha, tipo, importe, divisa, categoría, cuenta, notas |
| Transacciones de Acciones | Fecha, símbolo, nombre, tipo (compra/venta), acciones, precio, comisión, impuesto, cuenta, notas |
| Registros de Dividendos | Fecha, símbolo, nombre, dividendo en efectivo, dividendo en acciones, notas |

**Notas de Importación:** Si un símbolo bursátil no existe, se creará automáticamente al importar. Si el nombre es incorrecto, se actualizará con el nombre del CSV.

---

### Operaciones de Administrador

**Ruta:** **Configuración** → **Administrador**

| Función | Descripción |
|---------|-------------|
| Activar/Desactivar Registro Público | Controlar si cualquier persona puede registrarse por sí misma |
| Lista Blanca de Correos | Solo permitir que los correos de la lista blanca se registren (uno por línea) |
| Agregar Cuenta | Crear directamente un nuevo usuario, opcionalmente como administrador |
| Eliminar Cuenta | Eliminar permanentemente un usuario y todos sus datos asociados |
| Auditoría de Inicio de Sesión | Ver las marcas de tiempo, IPs, países y estado de éxito/fallo de inicio de sesión de todos los usuarios |

---

## Gestión Avanzada de Docker

### Información de la Imagen

| Elemento | Valor |
|----------|-------|
| Docker Hub | [`es94111/assetpilot`](https://hub.docker.com/r/es94111/assetpilot) |
| Arquitecturas Soportadas | `linux/amd64`, `linux/arm64` |
| Imagen Base | `node:24-alpine` |
| Tamaño de la Imagen | ~180 MB |
| Verificación de Salud | Comprobación automática cada 30 segundos |

### Volumen y Persistencia de Datos

El directorio `/app/data` dentro del contenedor almacena todos los datos persistentes:

```
/app/data/
├── database.db    # Base de datos SQLite cifrada
└── .env           # Claves generadas automáticamente (JWT_SECRET, DB_ENCRYPTION_KEY)
```

**Tres opciones de montaje:**

```bash
# 1. Volumen Anónimo (más sencillo)
docker run -d -p 3000:3000 es94111/assetpilot:latest

# 2. Volumen con Nombre (recomendado, fácil de gestionar)
docker run -d -p 3000:3000 -v assetpilot-data:/app/data es94111/assetpilot:latest

# 3. Montaje de Enlace (para acceso directo a archivos)
docker run -d -p 3000:3000 -v /ruta/a/data:/app/data es94111/assetpilot:latest
```

### Copia de Seguridad y Restauración

```bash
# Copia de seguridad
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/assetpilot-backup.tar.gz -C /data .

# Restauración
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar xzf /backup/assetpilot-backup.tar.gz -C /data
```

> ⚠️ **Importante:** Eliminar un volumen destruirá permanentemente tu base de datos y las claves de cifrado. Siempre haz una copia de seguridad antes de hacerlo.

### Comandos de Gestión Habituales

```bash
# Ver el estado del contenedor (incluida la verificación de salud)
docker ps

# Ver registros en tiempo real
docker logs -f assetpilot

# Detener / Reiniciar
docker stop assetpilot
docker restart assetpilot

# Actualizar a la última versión
docker pull es94111/assetpilot:latest
docker rm -f assetpilot
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v assetpilot-data:/app/data \
  es94111/assetpilot:latest
```

### Construir tu Propia Imagen

```bash
docker build -t assetpilot .

docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  assetpilot
```

---

## Seguridad

| Mecanismo | Descripción |
|-----------|-------------|
| **Cifrado de Base de Datos** | ChaCha20-Poly1305 AEAD + derivación de clave PBKDF2-SHA256 |
| **Hash de Contraseñas** | Almacenamiento hash con bcryptjs — las contraseñas nunca se guardan en texto plano |
| **Protección XSS** | Toda entrada del usuario se escapa mediante `escHtml()` antes de insertarse en el DOM |
| **Cabeceras de Seguridad** | Helmet (HSTS, X-Content-Type-Options, Referrer-Policy) |
| **Protección CSP** | Scripts en línea bloqueados; fuentes de scripts y recursos restringidas |
| **Limitación de Velocidad** | API de inicio de sesión / registro limitada a 20 solicitudes por IP cada 15 minutos |
| **Control CORS** | `ALLOWED_ORIGINS` restringe los dominios de origen permitidos |
| **Validación de Estado OAuth** | El inicio de sesión de Google utiliza un token de estado de un solo uso para prevenir ataques CSRF / de repetición |
| **Verificación SRI** | Los scripts externos de CDN (Font Awesome, Chart.js) incluyen atributos de integridad |
| **Protección contra Inyección de Atributos** | El campo de icono de cuenta se valida contra una lista blanca (solo se permite `fa-*`) |
| **Auditoría de Inicio de Sesión** | Registra la marca de tiempo, IP, país y método de inicio de sesión; los administradores pueden ver los intentos fallidos |
| **Verificación de Salud** | Docker HEALTHCHECK detecta automáticamente el estado del servicio cada 30 segundos |

---

## Estructura de Archivos

```
├── server.js              # Backend Express (API + base de datos)
├── app.js                 # Lógica SPA frontend (módulo IIFE)
├── index.html             # HTML de página única (todas las páginas + modales)
├── style.css              # Estilos globales
├── logo.svg               # Logo del sitio web (página de inicio de sesión)
├── favicon.svg            # Favicon + logo de la barra lateral
├── changelog.json         # Registros de actualizaciones de versión
├── Dockerfile             # Configuración de compilación de Docker
├── docker-compose.yml     # Configuración de Docker Compose
├── .env.example           # Plantilla de variables de entorno
├── .gitignore             # Lista de ignorados de Git
├── SRS.md                 # Especificación de Requisitos de Software
├── .github/workflows/
│   └── docker-publish.yml # Compilación y publicación automatizada CI/CD
└── data/                  # Directorio de datos (montaje de Docker Volume)
    ├── database.db        # Base de datos SQLite cifrada (generada automáticamente)
    └── .env               # Archivo de claves (generado automáticamente)
```

---

## Fuentes de API

| Servicio | Propósito | Enlace |
|----------|-----------|--------|
| **TWSE OpenAPI** | Precios de acciones en tiempo real y datos de ex-dividendos de Taiwán | [openapi.twse.com.tw](https://openapi.twse.com.tw/) |
| **exchangerate-api.com** | Tipos de cambio en tiempo real a nivel global (divisa base: TWD) | [exchangerate-api.com](https://www.exchangerate-api.com/) |
| **Google Identity Services** | Inicio de sesión con Google SSO | [developers.google.com/identity](https://developers.google.com/identity) |
| **IPinfo Lite** | Consulta de país por IP | [ipinfo.io/lite](https://ipinfo.io/lite) |

Los datos de direcciones IP son proporcionados por <a href="https://ipinfo.io/lite" target="_blank" rel="noopener noreferrer">IPinfo</a>.

---

## Licencia

[GNU AGPL v3](LICENSE)
