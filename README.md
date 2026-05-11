# Surtido HH

Aplicación Hand Held para el surtido de mercancía en almacén. Permite escanear o ingresar manualmente códigos de barras para registrar el surtido de artículos de un pedido.

## Tecnología

HTML + CSS + JavaScript puro (ES6+), sin dependencias externas. Compatible con GitHub Pages.

## Estructura

```
Surtido-HH/
├── index.html   — Estructura de pantallas y overlays
├── styles.css   — Design system (heredado de Revision-HH)
├── app.js       — Lógica de negocio completa
└── README.md
```

## Pantallas

| Pantalla | Descripción |
|---|---|
| Menú | Acceso a los módulos del sistema |
| Asignación de tareas | Confirmación del pedido asignado |
| Surtido de órdenes | Lista de artículos con avance del pedido y scanner |
| Detalle del producto | Información del artículo con stepper de cantidad |
| Resumen final | Estadísticas del surtido completado |

## Flujo de escaneo

- **Código de 18 dígitos** `[producto 7][cantidad 6][peso 5]` → suma la cantidad directamente
- **Código de 7 dígitos** → abre bottom sheet para ingresar cantidad manualmente
- **Otro formato** → muestra error de código inválido

## Publicar en GitHub Pages

1. Ir a **Settings → Pages**
2. Source: `Deploy from a branch`
3. Branch: `main` / `root`
4. Guardar — la URL estará disponible en unos minutos
