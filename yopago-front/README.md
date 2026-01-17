# YoPago - App de Gestión de Gastos Compartidos

Una aplicación React Native con Expo que permite dividir gastos fácilmente mediante el procesamiento automático de facturas usando inteligencia artificial.

## 🚀 Características

- ✅ **Crear grupos** para organizar gastos compartidos
- ✅ **Capturar facturas** con la cámara o desde la galería
- ✅ **Procesamiento automático** de facturas usando IA (API de Java)
- ✅ **División automática** de gastos entre miembros del grupo
- ✅ **Interfaz moderna** con soporte para tema claro/oscuro

##  Implemented Screens

1. **Pantalla Principal** - Hub central con acceso a todas las funcionalidades
2. **Crear Grupo** - Formulario para crear nuevos grupos de gastos
3. **Capturar Factura** - Interfaz para tomar fotos o seleccionar imágenes de facturas
4. **Procesamiento** - Integración con tu API de Java para procesar las imágenes

## 🛠️ Instalación y Configuración

### Prerrequisitos

- Node.js (versión 18 o superior)
- npm o yarn
- Expo CLI
- Tu API de Java ejecutándose

### Pasos de Instalación

1. **Clona el repositorio** (si aplica)
```bash
git clone [tu-repositorio]
cd yopago
```

2. **Instala las dependencias**
```bash
npm install
```

3. **Configura tu API de Java**

Edita el archivo `services/config.ts` y cambia la URL base:

```typescript
export const API_CONFIG = {
  // Cambia esta URL por la de tu servidor Java
  BASE_URL: 'http://tu-servidor.com:8080/api',
  
  // Para desarrollo local:
  // BASE_URL: 'http://localhost:8080/api',
  
  // Para emulador Android:
  // BASE_URL: 'http://10.0.2.2:8080/api',
  
  // Para dispositivo físico (usa la IP de tu computadora):
  // BASE_URL: 'http://192.168.1.100:8080/api',
}
```

4. **Inicia la aplicación**
```bash
npm start
```

5. **Ejecuta en tu dispositivo**
- Para Android: `npm run android`
- Para iOS: `npm run ios`
- Para web: `npm run web`

## 🔧 Configuración de tu API de Java

Tu API de Java debe implementar los siguientes endpoints:

### 1. Procesamiento de Facturas
```http
POST /api/receipts/process
Content-Type: application/json

{
  "imageBase64": "string", // Imagen en base64
  "fileName": "string",    // Nombre del archivo
  "groupId": "string"      // ID del grupo (opcional)
}

Response:
{
  "success": boolean,
  "receiptId": "string",
  "vendor": "string",      // Nombre del vendedor
  "date": "string",        // Fecha de la factura
  "total": number,         // Total de la factura
  "items": [               // Artículos de la factura
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number
    }
  ],
  "error": "string"        // Mensaje de error (opcional)
}
```

### 2. Gestión de Grupos
```http
POST /api/groups
Content-Type: application/json

{
  "name": "string",
  "description": "string" // opcional
}

Response:
{
  "success": boolean,
  "group": {
    "id": "string",
    "name": "string",
    "description": "string",
    "members": ["string"],
    "createdAt": "string",
    "totalExpenses": number
  },
  "error": "string" // opcional
}
```

```http
GET /api/groups
Response:
{
  "groups": [Group]
}
```

```http
GET /api/groups/:id
Response:
{
  "group": Group
}
```

### 3. Health Check
```http
GET /api/health
Response:
{
  "status": "ok"
}
```

## 📁 Estructura del Proyecto

```
app/
├── (tabs)/           # Navegación por pestañas
│   ├── index.tsx     # Pantalla principal
│   └── explore.tsx   # Pantalla de exploración
├── create-group.tsx  # Crear nuevo grupo
├── capture-receipt.tsx # Capturar factura
└── _layout.tsx       # Layout principal

components/           # Componentes reutilizables
├── ui/              # Componentes de UI
└── themed-*         # Componentes con tema

services/            # Servicios de API
├── apiService.ts    # Servicio principal de API
└── config.ts        # Configuración de API

constants/           # Constantes de la app
hooks/              # Hooks personalizados
assets/             # Recursos (imágenes, etc.)
```

## 🎯 Cómo Usar la App

### 1. Crear un Grupo
1. Abre la app
2. Toca "🔨 Crear Nuevo Grupo"
3. Ingresa el nombre y descripción del grupo
4. Toca "Crear Grupo"

### 2. Procesar una Factura
1. Desde la pantalla principal, toca "📷 Capturar Factura"
2. Toma una foto nueva o selecciona una imagen existente
3. Revisa la vista previa
4. Toca "🚀 Procesar Factura"
5. Espera a que tu API procese la imagen
6. Revisa los resultados extraídos

## 🛡️ Permisos Requeridos

La app solicita los siguientes permisos:
- **Cámara**: Para tomar fotos de facturas
- **Galería**: Para seleccionar imágenes existentes
- **Almacenamiento**: Para guardar imágenes temporalmente

## 🚧 Próximas Características

- [ ] Lista de grupos existentes
- [ ] Gestión de miembros del grupo
- [ ] Historial de facturas procesadas
- [ ] División manual de gastos
- [ ] Notificaciones push
- [ ] Exportar reportes
- [ ] Autenticación de usuarios

## 🔧 Troubleshooting

### Problemas Comunes

1. **Error de conexión con la API**
   - Verifica que tu API de Java esté ejecutándose
   - Confirma que la URL en `services/config.ts` sea correcta
   - Revisa que no haya problemas de CORS

2. **Permisos de cámara/galería**
   - Ve a configuración del dispositivo
   - Otorga permisos de cámara y almacenamiento a la app

3. **Problemas con Expo**
   - Ejecuta `npx expo doctor` para diagnósticos
   - Limpia caché: `npx expo start --clear`

4. **Errores de TypeScript**
   - Ejecuta `npx tsc --noEmit` para verificar tipos
   - Asegúrate de que todas las dependencias estén instaladas

## 📝 Desarrollo

### Scripts Disponibles

- `npm start` - Inicia el servidor de desarrollo
- `npm run android` - Ejecuta en Android
- `npm run ios` - Ejecuta en iOS
- `npm run web` - Ejecuta en navegador
- `npm run lint` - Ejecuta el linter

### Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🤝 Soporte

Si tienes problemas o preguntas:
1. Revisa la sección de troubleshooting
2. Abre un issue en GitHub
3. Contacta al equipo de desarrollo

---

¡Disfruta usando YoPago para gestionar tus gastos compartidos! 🎉
