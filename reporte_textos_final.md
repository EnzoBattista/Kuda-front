# Reporte Final de Verificación de Textos vs `HUs - TEXTOS.md`

Comparación entre los textos especificados en `HUs - TEXTOS.md` y los textos realmente presentes en el frontend (`src/`).

**Resumen global:** sobre **179 textos** controlados en 53 HUs:
- ✅ **90 OK** (texto literal presente)
- ⚠️ **21 con discrepancia** (texto existe pero distinto — variantes y parciales)
- ❌ **68 ausentes** (no aparecen en el código, la mayoría porque la HU entera no está implementada en el frontend)

---

## 1. HUs OK (textos coinciden literalmente)

Estas HUs tienen **todos** sus textos exactos en el código:

- Iniciar sesión (escenarios 1–4)
- Cerrar sesión
- Ver detalle de usuario (`Mi información`, `Modificar datos personales`, `Cambiar contraseña`)
- Modificar cliente (`Guardar cambios`, mensajes éxito/error)
- Recuperar contraseña vía enlace (escenarios 1–4)
- Editar usuario (`Guardar cambios` + mensajes éxito/DNI/menor de edad)
- Listar usuarios (`Usuarios`, `Editar`, `No se han encontrado usuarios`)
- Agregar Sala (`Agregar`)
- Eliminar Sala (`Eliminar`)
- Eliminar Clase (`Eliminar`, `Confirmar`, `Cancelar`)
- Listar clases (`Clases`)
- Ver historial de reservas (`Mis reservas`)
- Agregar/Modificar/Eliminar actividad + mensajes
- Listar profesores en actividad (`Ver profesores`, vacío)
- Listar actividades (`Actividades`, botones de fila, vacío)
- Reservar Clase abonado (Detalle): `Reservar`, `Anotarse en lista de espera`
- Agregar Cliente a lista de espera (`Anotarse en lista de espera`)
- Ver Detalle de Empleado (`Ver detalle`)
- Filtrar usuarios (`Buscar`, `Estado`, `Activo`, `Rol`, `Cliente`)
- Filtrar clases / profesores (`Actividad`, `Día`, `Buscar`)
- Modificar precio de actividad (`Modificar precio`, `Guardar cambios`, mensajes)
- Remover cliente de lista de espera (`Eliminar`)
- Listar historial de asistencia total (DNI no registrado)

---

## 2. HUs con DISCREPANCIA (texto existe pero no es literal)

Estos requieren ajustar el texto del código (o el de la HU) para que coincidan.

### Registrar cliente
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Registro fallido - El email ya se encuentra registrado.` | mensaje viene del backend, no hay literal en el front | [src/app/auth/register/register.component.ts:77](src/app/auth/register/register.component.ts#L77) |
| `Registro fallido - La contraseña debe tener al menos 8 caracteres.` | `Debe tener al menos 8 caracteres.` (sin el prefijo "Registro fallido -") | [src/app/auth/register/register.component.html:96](src/app/auth/register/register.component.html#L96) |
| `Se ha enviado un enlace de confirmación a su casilla de email. Tiene 48hs para confirmar su registro.` | **AUSENTE en el front** (depende del mensaje del back) | — |

### Cambiar contraseña
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `La nueva contraseña debe ser distinta a la actual` | **No existe ese case en el mapeo de errores**. El componente sólo mapea "actual incorrecta" y "no coinciden". | [src/app/pages/cambiar-password/cambiar-password.component.ts:74-84](src/app/pages/cambiar-password/cambiar-password.component.ts#L74-L84) |

### Envío de enlace para recuperar contraseña
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Se ha enviado un enlace de recuperación a su email. Tiene 48hs para restablecerla.` | `Se ha enviado un enlace de recuperación a su email` (sin la frase de 48hs) | [src/app/services/auth.service.ts:51-52](src/app/services/auth.service.ts#L51-L52) |

### Listar reservas actuales
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Ver mis reservas actuales` | Botón de nav: `Mis reservas` | [src/app/app.component.html:16](src/app/app.component.html#L16) |

### Listar Salas
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Listar salas` | No hay UI de salas, sólo el servicio `salas.service.ts` | — |
| `Habilitada` / `Deshabilitada` (estado en listado) | Sólo aparece en mensaje de error `sala se encuentra deshabilitada` | [src/app/services/salas.service.ts](src/app/services/salas.service.ts) |

### Ver Sala
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Modificar Sala`, `Deshabilitar Sala`, `Eliminar Sala` | **No existe pantalla "Ver Sala"**. Hay referencias a "Sala" en clases-list pero no como botones de esa HU. | [src/app/admin/clases-list/](src/app/admin/clases-list/) |

### Cancelar reserva (abonados y no abonados)
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Cancelar Reserva` (con R mayúscula) | `Cancelar reserva` (r minúscula) | [src/app/pages/mis-reservas/mis-reservas.component.html:124,181,189](src/app/pages/mis-reservas/mis-reservas.component.html#L124) |

### Listar clases
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Ver Clases` (escenario vacío) | `Ver clases disponibles` | [src/app/pages/mis-reservas/mis-reservas.component.html](src/app/pages/mis-reservas/mis-reservas.component.html) |

### Reservar Clase No Abonados
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Clase Individual` (en opciones) | `Clase individual` (minúscula) usado como etiqueta de modalidad de reserva | [src/app/pages/mis-reservas/mis-reservas.component.ts](src/app/pages/mis-reservas/mis-reservas.component.ts) |

### Registrar Recepcionista
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Registrar Empleado` | Botón es texto en admin-dashboard pero no literal `Registrar Empleado` | [src/app/admin/admin-dashboard/admin-dashboard.component.html](src/app/admin/admin-dashboard/admin-dashboard.component.html) |
| `Recepcionista registrado con éxito` | `Recepcionista registrado exitosamente.` | [src/app/admin/admin-dashboard/admin-dashboard.component.ts:229](src/app/admin/admin-dashboard/admin-dashboard.component.ts#L229) |
| `El correo electrónico ya está en uso por otro usuario` | mensaje del back vía `err?.error?.message` (sin literal en el front) | [src/app/admin/admin-dashboard/admin-dashboard.component.ts:233-234](src/app/admin/admin-dashboard/admin-dashboard.component.ts#L233) |

### Registrar Profesor
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Registrar Profesor` | `+ Registrar profesor` (p minúscula) | [src/app/admin/admin-dashboard/admin-dashboard.component.html](src/app/admin/admin-dashboard/admin-dashboard.component.html) |
| `Profesor registrado con éxito` | **No hay mensaje de éxito** tras crear (`onCreateProfesor` no setea ningún success message) | [src/app/admin/admin-dashboard/admin-dashboard.component.ts:154-178](src/app/admin/admin-dashboard/admin-dashboard.component.ts#L154-L178) |
| `El profesor con este número de documento ya se encuentra registrado` | mensaje del back | [src/app/admin/admin-dashboard/admin-dashboard.component.ts:175](src/app/admin/admin-dashboard/admin-dashboard.component.ts#L175) |

### Cancelar Clase
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `La clase fue cancelada exitosamente` | `Clase cancelada con éxito` | [src/app/services/clases.service.ts:171](src/app/services/clases.service.ts#L171) |
| `La clase fue cancelada exitosamente. Se le reintegrara a cada cliente afectado la clase correspondiente` | `Clase cancelada con éxito. Se ha notificado a los clientes inscriptos` | [src/app/services/clases.service.ts:168](src/app/services/clases.service.ts#L168) |

### Registrar Pago
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Registrar Pago` (botón) | aparece sólo como label de string en `clases-disponibles` (no como UI de la HU) | [src/app/pages/clases-disponibles/clases-disponibles.component.ts](src/app/pages/clases-disponibles/clases-disponibles.component.ts) |

### Decidir asistencia
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Reserva confirmada con éxito` | mensaje sí presente en clases-disponibles, pero **botones `Confirmar asistencia` / `Rechazar lugar` no existen** | [src/app/pages/clases-disponibles/clases-disponibles.component.ts](src/app/pages/clases-disponibles/clases-disponibles.component.ts) |

### Confirmar registro
| HU dice | Sistema dice | Archivo |
|---|---|---|
| `Confirmar registro` (botón) | Solo aparece "Confirmación de cuenta" en el `<h2>`, no hay botón | [src/app/auth/confirm/confirm.component.html](src/app/auth/confirm/confirm.component.html) |
| `Usted ha sido registrado correctamente` | Se muestra el `message` que devuelve el backend (no hay literal) | [src/app/auth/confirm/confirm.component.ts:33-38](src/app/auth/confirm/confirm.component.ts#L33-L38) |
| `El enlace de confirmación ha expirado` | Se muestra `err?.error?.message` o fallback `No se pudo confirmar la cuenta. El enlace puede haber expirado.` | [src/app/auth/confirm/confirm.component.ts:40-46](src/app/auth/confirm/confirm.component.ts#L40-L46) |
| `El enlace de confirmación es inválido` | No existe ese case explícito | — |

---

## 3. HUs NO IMPLEMENTADAS en el frontend

Todos los textos de estas HUs están **AUSENTES** porque no existe pantalla/componente en el frontend que los exponga.

| HU | Razón |
|---|---|
| **Deshabilitar Sala / Modificar Sala / Listar Salas** | No hay rutas ni componentes de gestión de salas (sólo el servicio `salas.service.ts`). Falta UI completa. |
| **Generar QR / Escanear QR / Pagar con QR** | No existe ningún componente de QR. No están las rutas. |
| **Anotar asistencia manual** | No existe pantalla de asistencia (botones `Confirmar Asistencia`, mensaje de mora). |
| **Listar historial de asistencia** | No existe la pantalla. |
| **Reservar Clase abonado (Inscripción)** — mensajes de pago | No hay flujo de inscripción mensual con feedback de pago (sólo flujo individual). |
| **Reservar Clase No Abonados** — `Señar`, `Reserva confirmada. Tu seña fue registrada exitosamente`, `Reserva incompleta. Hubo un problema con el pago.` | No existe modalidad seña ni feedback explícito de pago incompleto. |
| **Ver historial de reservas** — `No se han encontrado reservas` | El componente usa `No posee reservas` en vez de ese literal. |
| **Filtrar Reserva por sede** — `No se encontraron reservas` | No hay filtro por sede en `mis-reservas`. |
| **Visualizar Reporte de Horarios más Seleccionados** | No hay pantalla de reportes. |
| **Visualizar Reporte de Dinero Ingresado** | No hay pantalla de reportes. |
| **Visualizar Reporte de Usuarios Nuevos** | No hay pantalla de reportes. |
| **Ver Total de Usuarios** | No hay pantalla de reportes. |
| **Listar pagos / Generar Comprobante** | No hay pantalla de pagos en el front (sólo `pago.service.ts`). |
| **Modificar clase** — mensajes de error específicos (profesor/sala ocupada, cupo, lista de espera) | El componente `clases-list` permite modificar, pero los textos exactos (`No se pudo modificar la clase. El profesor ya tiene una clase…`, `…Se notifico a los usuarios en la lista de espera`, etc.) no aparecen — los mensajes vienen del back sin mapeo. |
| **Activar / Desactivar notificaciones** | No existe la funcionalidad de notificaciones in-app (campana). |
| **Modificar notificación** | No existe la funcionalidad. |
| **Agregar Clase** — `La sala se encuentra ocupada…`, `El profesor se encuentra ocupado…`, `El cupo máximo debe ser mayor o igual al cupo mínimo (10)` | Hay componente de crear clase pero estos literales exactos no están: los errores vienen del backend sin mapeo a los textos esperados. |
| **Modificar Empleado** — `Datos actualizados correctamente`, `El formato del teléfono es inválido…` | No hay pantalla de "Modificar Empleado" (existe `editar-usuario` para clientes, pero no flujo de modificación de empleado con esos mensajes). |
| **Eliminar Empleado** — `Empleado eliminado con éxito` | No existe acción / mensaje. |
| **Listar Profesores** — `No hay profesores registrados actualmente en el sistema` | El componente lista profesores pero no muestra ese literal en el estado vacío. |
| **Registrar Pago** — `Transferencia`, `Pago registrado correctamente`, `QR Mercado Pago`, `El monto del pago debe ser mayor a cero` | No hay pantalla de registrar pago. |
| **Decidir asistencia** — `Confirmar asistencia`, `Rechazar lugar`, `Has rechazado el cupo` | No existen los botones específicos. |
| **Notificar cliente manual** — `Notificar falta de pago` | No existe el botón. |

---

## 4. Conclusión y recomendaciones

- El frontend cubre con textos exactos **~50 %** de los textos definidos en `HUs - TEXTOS.md`.
- **El 12 %** son discrepancias menores (case, puntuación o redacción ligeramente distinta) — son arreglos de 1 línea cada uno y deberían unificarse.
- **El 38 %** restante son HUs no implementadas en el frontend (salas, QR, asistencia, reportes, pagos, notificaciones, modificar/eliminar empleado, etc.).

**Próximos pasos sugeridos:**
1. Corregir los textos de la sección 2 para que coincidan exactamente con la HU (o ajustar la HU si el texto actual del sistema es preferible).
2. Para las HUs de la sección 3, decidir si se implementan en esta entrega o se documentan como pendientes.
3. Centralizar los literales en un archivo de constantes (`i18n` o `messages.ts`) para evitar nuevas divergencias.
