# Reporte de Verificación de Textos - Detallado

Resumen: 90 OK, 7 variantes, 14 parciales, 68 ausentes

Estado por texto:
- OK = encontrado literal
- VARIANTE = encontrado con normalización (acentos/case/puntuación diferentes)
- AUSENTE = no encontrado, ni siquiera por palabras clave
- PARCIAL = palabras clave aparecen en algún archivo pero no la frase

## Registrar cliente
  - AUSENTE: `Se ha enviado un enlace de confirmación a su casilla de email. Tiene 48hs para confirmar su registro.`
  - PARCIAL: `Registro fallido - El email ya se encuentra registrado.`
    └─ src/app/auth/register/register.component.ts (4/5 palabras clave)
  - PARCIAL: `Registro fallido - La contraseña debe tener al menos 8 caracteres.`
    └─ src/app/auth/register/register.component.html (6/7 palabras clave)
    └─ src/app/auth/login/login.component.html (6/7 palabras clave)

## Listar reservas actuales
  - AUSENTE: `Ver mis reservas actuales`

## Cambiar contraseña
  - PARCIAL: `La nueva contraseña debe ser distinta a la actual`
    └─ src/app/pages/cambiar-password/cambiar-password.component.html (4/5 palabras clave)
    └─ src/app/services/auth.service.ts (4/5 palabras clave)

## Envío de enlace vía email para recuperar contraseña
  - AUSENTE: `Se ha enviado un enlace de recuperación a su email. Tiene 48hs para restablecerla.`

## Deshabilitar Sala
  - AUSENTE: `Deshabilitar`

## Modificar Sala
  - AUSENTE: `Aplicar cambios.`

## Listar Salas
  - AUSENTE: `Listar salas`
  - VARIANTE: `Habilitada`
    └─ src/app/services/salas.service.ts
    └─ texto real: `msg.includes('sala se encuentra deshabilitada')`
  - VARIANTE: `Deshabilitada`
    └─ src/app/services/salas.service.ts
    └─ texto real: `msg.includes('sala se encuentra deshabilitada')`

## Ver Sala
  - PARCIAL: `Modificar Sala`
    └─ src/app/admin/clases-list/clases-list.component.ts (2/2 palabras clave)
    └─ src/app/admin/clases-list/clases-list.component.html (2/2 palabras clave)
  - AUSENTE: `Deshabilitar Sala`
  - PARCIAL: `Eliminar Sala`
    └─ src/app/admin/clases-list/clases-list.component.ts (2/2 palabras clave)
    └─ src/app/admin/clases-list/clases-list.component.html (2/2 palabras clave)

## Generar QR
  - AUSENTE: `Generar QR`

## Escanear QR
  - AUSENTE: `Confirmar Ingreso`
  - AUSENTE: `Denegar Acceso`
  - AUSENTE: `Identidad no coincide`

## Anotar asistencia manual
  - AUSENTE: `Confirmar Asistencia`
  - AUSENTE: `El cliente no se encuentra al dia con el pago`

## Listar historial de asistencia
  - AUSENTE: `Ver historial de asistencia`

## Reservar Clase abonado (Inscripción)
  - AUSENTE: `Reserva confirmada. Tu pago fue registrado exitosamente.`
  - AUSENTE: `Tu pago ha sido rechazado o cancelado.`

## Cancelar reserva abonados
  - VARIANTE: `Cancelar Reserva`
    └─ src/app/pages/mis-reservas/mis-reservas.component.html
    └─ texto real: `Cancelar reserva`

## Listar clases
  - VARIANTE: `Ver Clases`
    └─ src/app/pages/mis-reservas/mis-reservas.component.html
    └─ texto real: `<a class="btn btn-primary" routerLink="/clases">Ver clases disponibles</a>`

## Ver historial de reservas
  - AUSENTE: `No se han encontrado reservas`

## Filtrar Reserva por sede
  - AUSENTE: `No se encontraron reservas`

## Visualizar Reporte de Horarios más Seleccionados
  - AUSENTE: `Generar reporte.`
  - AUSENTE: `Horarios mas seleccionados.`
  - AUSENTE: `Visualizar reporte`

## Visualizar Reporte de Dinero Ingresado
  - AUSENTE: `Generar reporte.`
  - AUSENTE: `Ingresos Mensuales.`
  - AUSENTE: `Visualizar reporte`

## Visualizar Reporte de Usuarios Nuevos
  - AUSENTE: `Generar reporte.`
  - AUSENTE: `Usuarios nuevos.`
  - AUSENTE: `Visualizar reporte`

## Listar pagos
  - PARCIAL: `Ver pagos`
    └─ src/app/services/pago.service.ts (1/1 palabras clave)
    └─ src/app/services/reservas.service.ts (1/1 palabras clave)
  - AUSENTE: `Generar comprobante`
  - AUSENTE: `No se han encontrado pagos`

## Modificar clase
  - AUSENTE: `Clase modificada con éxito. Se notifico a los usuarios en la lista de espera`
  - AUSENTE: `No se pudo modificar la clase. El profesor ya tiene una clase en el dia y horario seleccionado`
  - AUSENTE: `No se pudo modificar la clase. La sala esta ocupada en el dia y horario seleccionado`
  - AUSENTE: `No se pudo modificar la clase. El cupo debe ser mayor o igual a la cantidad de inscriptos`
  - AUSENTE: `No se pudo modificar la clase. El cupo debe ser mayor o igual a 10`

## Generar Comprobante
  - AUSENTE: `Generar comprobante`

## Activar notificaciones
  - AUSENTE: `Notificaciones activadas`

## Reservar Clase No Abonados
  - AUSENTE: `Reserva confirmada. Tu pago fue registrado exitosamente.`
  - VARIANTE: `Clase Individual`
    └─ src/app/pages/mis-reservas/mis-reservas.component.ts
    └─ texto real: `return r.modalidad === 'ABONADO' ? 'Abonado' : 'Clase individual';`
  - AUSENTE: `Señar`
  - AUSENTE: `Reserva confirmada. Tu seña fue registrada exitosamente`
  - AUSENTE: `Reserva incompleta. Hubo un problema con el pago.`

## Registrar Recepcionista
  - PARCIAL: `Registrar Empleado`
    └─ src/app/admin/admin-dashboard/admin-dashboard.component.ts (2/2 palabras clave)
    └─ src/app/admin/admin-dashboard/admin-dashboard.component.html (2/2 palabras clave)
  - PARCIAL: `Recepcionista registrado con éxito`
    └─ src/app/admin/admin-dashboard/admin-dashboard.component.ts (3/3 palabras clave)
    └─ src/app/services/auth.service.ts (3/3 palabras clave)
  - AUSENTE: `El correo electrónico ya está en uso por otro usuario`

## Ver Total de Usuarios
  - AUSENTE: `Generar reporte.`
  - AUSENTE: `Total de usuarios.`
  - AUSENTE: `Visualizar reporte`

## Agregar Clase
  - AUSENTE: `La sala se encuentra ocupada para ese día y horario`
  - AUSENTE: `El profesor se encuentra ocupado para ese día y horario`
  - AUSENTE: `El cupo máximo debe ser mayor o igual al cupo mínimo (10)`

## Cancelar Clase
  - PARCIAL: `La clase fue cancelada exitosamente`
    └─ src/app/services/clases.service.ts (3/3 palabras clave)
  - AUSENTE: `La clase fue cancelada exitosamente. Se le reintegrara a cada cliente afectado la clase correspondiente`

## Desactivar notificaciones
  - AUSENTE: `Notificaciones desactivadas`

## Modificar notificación
  - AUSENTE: `Modificar recordatorio`
  - AUSENTE: `Recordatorio modificado`
  - AUSENTE: `El recordatorio debe estar dentro de los 10 días de gracia para pagar`

## Cancelar reserva no abonados
  - VARIANTE: `Cancelar Reserva`
    └─ src/app/pages/mis-reservas/mis-reservas.component.html
    └─ texto real: `Cancelar reserva`

## Registrar Profesor
  - VARIANTE: `Registrar Profesor`
    └─ src/app/admin/admin-dashboard/admin-dashboard.component.html
    └─ texto real: `<button class="btn btn-primary" (click)="onCreateProfesor()">+ Registrar profesor</button>`
  - PARCIAL: `Profesor registrado con éxito`
    └─ src/app/admin/admin-dashboard/admin-dashboard.component.ts (3/3 palabras clave)
  - AUSENTE: `El profesor con este número de documento ya se encuentra registrado`

## Modificar Empleado
  - AUSENTE: `Datos actualizados correctamente`
  - AUSENTE: `El formato del teléfono es inválido. Ingrese solo números`

## Eliminar Empleado
  - AUSENTE: `Empleado eliminado con éxito`

## Listar Profesores
  - AUSENTE: `No hay profesores registrados actualmente en el sistema`

## Registrar Pago
  - AUSENTE: `Transferencia`
  - PARCIAL: `Registrar Pago`
    └─ src/app/pages/clases-disponibles/clases-disponibles.component.ts (2/2 palabras clave)
  - AUSENTE: `Pago registrado correctamente`
  - AUSENTE: `QR Mercado Pago`
  - AUSENTE: `El monto del pago debe ser mayor a cero`

## Decidir asistencia
  - AUSENTE: `Confirmar asistencia`
  - PARCIAL: `Reserva confirmada con éxito`
    └─ src/app/pages/clases-disponibles/clases-disponibles.component.ts (3/3 palabras clave)
    └─ src/app/pages/clases-disponibles/clases-disponibles.component.html (3/3 palabras clave)
  - AUSENTE: `Rechazar lugar`
  - AUSENTE: `Has rechazado el cupo`

## Pagar con QR
  - AUSENTE: `Generar QR`

## Notificar cliente manual
  - AUSENTE: `Notificar falta de pago`

## Confirmar registro
  - PARCIAL: `Confirmar registro`
    └─ src/app/app.component.ts (2/2 palabras clave)
    └─ src/app/app.routes.ts (2/2 palabras clave)
  - AUSENTE: `Usted ha sido registrado correctamente`
  - PARCIAL: `El enlace de confirmación ha expirado`
    └─ src/app/auth/confirm/confirm.component.ts (3/3 palabras clave)
  - AUSENTE: `El enlace de confirmación es inválido`
