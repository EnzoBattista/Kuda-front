# Interfaz de Usuario y Mensajes del Sistema por Historia de Usuario

## Iniciar sesión
* **Escenario 1 (Exitoso):** * Botón a presionar: `Ingresar`
    * El sistema muestra: La pantalla de inicio.
* **Escenario 2 (Email no existente):**
    * Botón a presionar: `Ingresar`
    * El sistema informa: `Datos de inicio de sesión incorrectos`
* **Escenario 3 (Contraseña errónea):**
    * Botón a presionar: `Ingresar`
    * El sistema informa: `Datos de inicio de sesión incorrectos`
* **Escenario 4 (Cuenta sin confirmar):**
    * Botón a presionar: `Ingresar`
    * El sistema informa: `La cuenta aún no fue confirmada. Revisá tu casilla de email para activar el registro.`

## Cerrar sesión
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Cerrar sesión`
    * El sistema muestra: La página de inicio de sesión.

## Registrar cliente
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Registrarse`
    * El sistema informa: `Se ha enviado un enlace de confirmación a su casilla de email. Tiene 48hs para confirmar su registro.`
* **Escenario 2 (Email ya registrado):**
    * Botón a presionar: `Registrarse`
    * El sistema informa: `Registro fallido - El email ya se encuentra registrado.`
* **Escenario 3 (Menor de edad):**
    * Botón a presionar: `Registrarse`
    * El sistema informa: `Registro fallido - Se debe ser mayor de 14 años.`
* **Escenario 4 (Contraseña corta):**
    * Botón a presionar: `Registrarse`
    * El sistema informa: `Registro fallido - La contraseña debe tener al menos 8 caracteres.`
* **Escenario 5 (Contraseñas no coinciden):**
    * Botón a presionar: `Registrarse`
    * El sistema informa: `Registro fallido - Las contraseñas no coinciden.`

## Ver detalle de usuario
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Mi información`
    * El sistema muestra botones: `Modificar datos personales` y `Cambiar contraseña`

## Listar reservas actuales
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Ver mis reservas actuales`
    * El sistema muestra botón: `Ver detalle` (junto a cada reserva).
* **Escenario 2 (Vacío):**
    * Botón a presionar: `Ver mis reservas actuales`
    * El sistema informa: `No posee reservas`

## Modificar cliente
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `Se ha modificado su información personal`
* **Escenario 2 (Menor de edad):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `Modificación fallida - Debe ser mayor de 14 años`

## Cambiar contraseña
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Cambiar contraseña`
    * El sistema informa: `Contraseña modificada con éxito`
* **Escenario 2 (Actual incorrecta):**
    * Botón a presionar: `Cambiar contraseña`
    * El sistema informa: `La contraseña actual es incorrecta`
* **Escenario 3 (Nueva igual a anterior):**
    * Botón a presionar: `Cambiar contraseña`
    * El sistema informa: `La nueva contraseña debe ser distinta a la actual`
* **Escenario 4 (No coinciden):**
    * Botón a presionar: `Cambiar contraseña`
    * El sistema informa: `Las contraseñas no coinciden`
* **Escenario 5 (Menor a 8 caracteres):**
    * Botón a presionar: `Cambiar contraseña`
    * El sistema informa: `La contraseña debe tener al menos 8 caracteres.`

## Envío de enlace vía email para recuperar contraseña
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Recuperar contraseña`
    * El sistema informa: `Se ha enviado un enlace de recuperación a su email. Tiene 48hs para restablecerla.`
* **Escenario 2 (Email no registrado):**
    * Botón a presionar: `Recuperar contraseña`
    * El sistema informa: `El email ingresado no pertenece a ninguna cuenta registrada`

## Editar usuario
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `Usuario editado con éxito`
* **Escenario 2 (DNI registrado):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `El DNI ingresado ya pertenece a otro usuario registrado`
* **Escenario 3 (Menor de edad):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `El usuario debe ser mayor de 14 años`

## Listar usuarios
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Usuarios`
    * El sistema muestra botón: `Editar` (junto a cada usuario).
* **Escenario 2 (Vacío):**
    * Botón a presionar: `Usuarios`
    * El sistema informa: `No se han encontrado usuarios`

## Agregar Sala
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Agregar`
    * El sistema informa: Que la sala se agregó correctamente.
* **Escenario 2 (ID existente):**
    * Botón a presionar: `Agregar`
    * El sistema informa: Que la sala ya se encuentra registrada en el sistema.
* **Escenario 3 (Cupo inválido):**
    * Botón a presionar: `Agregar`
    * El sistema informa: Que el cupo debe ser mayor a 0.

## Deshabilitar Sala
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Deshabilitar`
    * El sistema informa: Que la sala fue deshabilitada exitosamente.
* **Escenario 2 (Fallido):**
    * Botón a presionar: `Deshabilitar`
    * El sistema informa: Que la sala aun tiene clases proximas.

## Modificar Sala
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Aplicar cambios.`
    * El sistema informa: Que la sala se modifico con exito.
* **Escenario 2 (ID repetido):**
    * Botón a presionar: `Aplicar cambios.`
    * El sistema informa: Que ya existe una sala con ese nombre.
* **Escenario 3 (Cupo menor):**
    * Botón a presionar: `Aplicar cambios.`
    * El sistema informa: Que aun existen clases asignadas a la sala con cupo mayor a X.
* **Escenario 4 (Cupo inválido):**
    * Botón a presionar: `Aplicar cambios.`
    * El sistema informa: Que el cupo debe ser mayor a 0.

## Listar Salas
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Listar salas`
    * El sistema muestra: El listado junto al estado (`Habilitada` / `Deshabilitada`).
* **Escenario 3 (Vacío):**
    * Botón a presionar: `Listar salas`
    * El sistema informa: Que no aun no hay salas para mostrar.

## Ver Sala
* **Escenario 1 (Con clases):**
    * El sistema muestra botones: `Modificar Sala`, `Deshabilitar Sala` y `Eliminar Sala`
* **Escenario 2 (Sin clases):**
    * El sistema muestra botones: `Modificar Sala`, `Deshabilitar Sala` y `Eliminar Sala`

## Generar QR
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Generar QR`
    * El sistema muestra: Un código QR en pantalla.
* **Escenario 2 (Falta de pago):**
    * Botón a presionar: `Generar QR`
    * El sistema informa: Un mensaje indicando que su mensualidad se encuentra suspendida por falta de pago.
* **Escenario 3 (Falta de reserva):**
    * Botón a presionar: `Generar QR`
    * El sistema informa: Que no posee reserva activa para el turno actual y no muestra el código.

## Escanear QR
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Confirmar Ingreso`
    * El sistema muestra: Un mensaje de éxito.
* **Escenario 2 (Fallido visual):**
    * Botón a presionar: `Denegar Acceso` (Con ingreso de motivo: `Identidad no coincide`)
    * El sistema informa: Guarda el registro del intento denegado.
* **Escenario 3 (Inválido):**
    * El sistema informa: Que el QR no es valido y cancela la operación.

## Anotar asistencia manual
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Confirmar Asistencia`
* **Escenario 2 (Mora):**
    * El sistema informa: `El cliente no se encuentra al dia con el pago` y muestra botón a la sección de pago.
* **Escenario 3 (Falta ficha médica):**
    * El sistema informa: Que falta el documento obligatorio.
* **Escenario 4 (Falta de reserva):**
    * El sistema informa: Que el cliente no cuenta con reserva activa.

## Listar historial de asistencia
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Ver historial de asistencia`
    * El sistema muestra: El listado de asistencia.
* **Escenario 2 (Vacío):**
    * Botón a presionar: `Ver historial de asistencia`
    * El sistema informa: Que aún no asistió a ninguna clase.

## Reservar Clase abonado (Inscripción)
* **Escenario 1 (Exitoso):**
    * El sistema informa: `Reserva confirmada. Tu pago fue registrado exitosamente.`
* **Escenario 2 (Pago rechazado):**
    * El sistema informa: `Tu pago ha sido rechazado o cancelado.`

## Cancelar reserva abonados
* **Escenario 1 (Con antelación):**
    * Botón a presionar: `Cancelar Reserva`
    * El sistema informa: Que la cancelación se realizó con éxito (y notifica sobre el bono y disponibilidad en cola).
* **Escenario 2 (Sin antelación):**
    * Botón a presionar: `Cancelar Reserva`
    * El sistema informa: Que la cancelación se realizó con éxito.

## Listar clases
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Clases`
    * El sistema muestra: Lista con todas las clases activas.
* **Escenario 2 (Vacío):**
    * Botón a presionar: `Ver Clases`
    * El sistema informa: Que no existen clases para mostrar.

## Ver historial de reservas
* **Escenario 1 (Exitoso):**
    * Opción a seleccionar: `Mis reservas`
    * El sistema muestra: Lista de clases en orden cronológico ascendente.
* **Escenario 2 (Vacío):**
    * Opción a seleccionar: `Mis reservas`
    * El sistema informa: `No se han encontrado reservas`

## Filtrar Reserva por sede
* **Escenario 1 (Exitoso):**
    * Opción de filtro: Sede seleccionada
    * El sistema muestra: Lista actualizada.
* **Escenario 2 (Sin resultados):**
    * Opción de filtro: Sede seleccionada
    * El sistema informa: `No se encontraron reservas`

## Eliminar Sala
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Eliminar`
    * El sistema informa: Que la sala fue eliminada exitosamente.
* **Escenario 2 (Fallido):**
    * Botón a presionar: `Eliminar`
    * El sistema informa: Que la sala aun tiene clases proximas.

## Visualizar Reporte de Horarios más Seleccionados
* **Escenario 1 (Exitoso):**
    * Botones/Opciones: `Generar reporte.`, `Horarios mas seleccionados.`, `Visualizar reporte`
    * El sistema muestra: Listado de horarios y asistencias.
* **Escenario 2 (Vacío):**
    * Botones/Opciones: `Generar reporte.`, `Horarios mas seleccionados.`, `Visualizar reporte`
    * El sistema informa: Que no hubo inscripciones a la categoria "Todas las clases" durante el año.

## Visualizar Reporte de Dinero Ingresado
* **Escenario 1 (Exitoso):**
    * Botones/Opciones: `Generar reporte.`, `Ingresos Mensuales.`, `Visualizar reporte`
    * El sistema muestra: Ingresos agrupados por mes.
* **Escenario 2 (Vacío):**
    * Botones/Opciones: `Generar reporte.`, `Ingresos Mensuales.`, `Visualizar reporte`
    * El sistema informa: Que no hay ingresos registrados en el año seleccionado.

## Visualizar Reporte de Usuarios Nuevos
* **Escenario 1 (Exitoso):**
    * Botones/Opciones: `Generar reporte.`, `Usuarios nuevos.`, `Visualizar reporte`
    * El sistema muestra: Cantidad de usuarios nuevos por mes.
* **Escenario 2 (Vacío):**
    * Botones/Opciones: `Generar reporte.`, `Usuarios nuevos.`, `Visualizar reporte`
    * El sistema informa: Que no existen usuarios nuevos en el año seleccionado.

## Recuperar contraseña vía enlace
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Confirmar`
    * El sistema informa: `Su contraseña ha sido restablecida con éxito`
* **Escenario 2 (Enlace expirado):**
    * El sistema informa: `El enlace de recuperación ha expirado`
* **Escenario 3 (No coinciden):**
    * Botón a presionar: `Confirmar`
    * El sistema informa: `Las contraseñas no coinciden`
* **Escenario 4 (Enlace inexistente):**
    * El sistema informa: `El enlace de recuperación es inválido`

## Listar pagos
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Ver pagos`
    * El sistema muestra botón: `Generar comprobante`
* **Escenario 2 (Vacío):**
    * Botón a presionar: `Ver pagos`
    * El sistema informa: `No se han encontrado pagos`

## Modificar clase
* **Escenario 1 (Exitoso sin espera):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `Clase modificada con éxito`
* **Escenario 2 (Exitoso con espera):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `Clase modificada con éxito. Se notifico a los usuarios en la lista de espera`
* **Escenario 3 (Profesor ocupado):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `No se pudo modificar la clase. El profesor ya tiene una clase en el dia y horario seleccionado`
* **Escenario 4 (Sala ocupada):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `No se pudo modificar la clase. La sala esta ocupada en el dia y horario seleccionado`
* **Escenario 5 (Cupo menor a inscriptos):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `No se pudo modificar la clase. El cupo debe ser mayor o igual a la cantidad de inscriptos`
* **Escenario 6 (Cupo menor al mínimo):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `No se pudo modificar la clase. El cupo debe ser mayor o igual a 10`

## Eliminar Clase
* **Escenario 1 (Sin inscriptos):**
    * Botones a presionar: `Eliminar`, `Confirmar`
    * El sistema informa: Que la clase fue eliminada exitosamente.
* **Escenario 2 (Con inscriptos):**
    * Botones a presionar: `Eliminar`, `Confirmar`
    * El sistema informa: Que la clase fue cancelada exitosamente y que se le reintegrara a cada cliente afectado la clase correspondiente.
* **Escenario 3 (Operación cancelada):**
    * Botones a presionar: `Eliminar`, `Cancelar`
    * El sistema muestra: Vuelve a mostrar el listado de la actividad.

## Generar Comprobante
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Generar comprobante`
    * El sistema muestra: El comprobante generado.
* **Escenario 2 (Falla de conexión):**
    * Botón a presionar: `Generar comprobante`
    * El sistema informa: Que hubo un error al recuperar la informacion del pago.

## Activar notificaciones
* **Escenario 1 (Exitoso):**
    * Botón a presionar: Icono de campana desactivada, luego `Aceptar`
    * El sistema informa: `Notificaciones activadas` y muestra la campana activada.
* **Escenario 2 (Cancelado):**
    * Botón a presionar: Icono de campana desactivada, luego `Cancelar`
    * El sistema muestra: El panel de notificaciones.

## Reservar Clase No Abonados
* **Escenario 1 (Pago completo):**
    * Opciones/Botones: `Clase individual`, `Pago completo`
    * El sistema informa: `Reserva confirmada. Tu pago fue registrado exitosamente.`
* **Escenario 2 (Seña):**
    * Opciones/Botones: `Clase Individual`, `Señar`
    * El sistema informa: `Reserva confirmada. Tu seña fue registrada exitosamente`.
* **Escenario 3 (Pago incompleto):**
    * Opciones/Botones: `Clase individual`, `Pago completo`
    * El sistema informa: `Reserva incompleta. Hubo un problema con el pago.`

## Registrar Recepcionista
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Registrar Empleado`
    * El sistema informa: `Recepcionista registrado con éxito`
* **Escenario 2 (Email existente):**
    * Botón a presionar: `Registrar Empleado`
    * El sistema informa: `El correo electrónico ya está en uso por otro usuario`

## Ver Total de Usuarios
* **Escenario 1 (Exitoso):**
    * Botones/Opciones: `Generar reporte.`, `Total de usuarios.`, `Visualizar reporte`
    * El sistema muestra: La cantidad de clientes totales del sistema.
* **Escenario 2 (Vacío):**
    * Botones/Opciones: `Generar reporte.`, `Total de usuarios.`, `Visualizar reporte`
    * El sistema informa: Que no existen clientes registrados.

## Listar historial de asistencia total
* **Escenario 1 (Exitoso):**
    * Input: Ingresar DNI
    * El sistema muestra: El listado de asistencia del cliente.
* **Escenario 2 (Fallido):**
    * Input: Ingresar DNI no registrado
    * El sistema informa: Que el usuario con ese DNI no pertenece a un usuario registrado.

## Remover cliente de lista de espera
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Eliminar`
    * El sistema informa/hace: Lo suprime de la lista y envía un WhatsApp notificándole.

## Agregar actividad
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Agregar actividad`
    * El sistema informa: `Actividad agregada con éxito`
* **Escenario 2 (Actividad existente):**
    * Botón a presionar: `Agregar actividad`
    * El sistema informa: `Ya existe una actividad con ese nombre`

## Modificar actividad
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Modificar actividad`
    * El sistema informa: `Actividad modificada con éxito`
* **Escenario 2 (Actividad existente):**
    * Botón a presionar: `Modificar actividad`
    * El sistema informa: `Ya existe una actividad con ese nombre`

## Eliminar actividad
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Eliminar actividad`
    * El sistema informa: `Actividad eliminada con éxito`
* **Escenario 2 (Con inscriptos):**
    * Botón a presionar: `Eliminar actividad`
    * El sistema informa: `No se puede eliminar una actividad con clientes inscriptos`

## Listar profesores en actividad
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Ver profesores`
    * El sistema muestra: Listado de profesores.
* **Escenario 2 (Vacío):**
    * Botón a presionar: `Ver profesores`
    * El sistema informa: `No existen profesores asociados a esta actividad`

## Listar actividades
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Actividades`
    * El sistema muestra botones: `Modificar actividad`, `Ver profesores`, `Modificar precio` y `Eliminar actividad`
* **Escenario 2 (Vacío):**
    * Botón a presionar: `Actividades`
    * El sistema informa: `No hay actividades`

## Agregar Clase
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Agregar clase`
    * El sistema informa: `Clase agregada con éxito`
* **Escenario 2 (Sala ocupada):**
    * Botón a presionar: `Agregar clase`
    * El sistema informa: `La sala se encuentra ocupada para ese día y horario`
* **Escenario 3 (Profesor ocupado):**
    * Botón a presionar: `Agregar clase`
    * El sistema informa: `El profesor se encuentra ocupado para ese día y horario`
* **Escenario 4 (Cupo inválido):**
    * Botón a presionar: `Agregar clase`
    * El sistema informa: `El cupo máximo debe ser mayor o igual al cupo mínimo (10)`

## Cancelar Clase
* **Escenario 1 (Sin inscriptos):**
    * Botón a presionar: `Cancelar`
    * El sistema informa: `La clase fue cancelada exitosamente`
* **Escenario 2 (Con inscriptos):**
    * Botón a presionar: `Cancelar`
    * El sistema informa: `La clase fue cancelada exitosamente. Se le reintegrara a cada cliente afectado la clase correspondiente`

## Desactivar notificaciones
* **Escenario 1 (Exitoso):**
    * Botón a presionar: Icono de campana activada, luego `Aceptar`
    * El sistema informa: `Notificaciones desactivadas` y pone la campana desactivada.
* **Escenario 2 (Cancelado):**
    * Botón a presionar: Icono de campana activada, luego `Cancelar`
    * El sistema muestra: Panel de notificaciones.

## Modificar notificación
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Modificar recordatorio`
    * El sistema informa: `Recordatorio modificado`
* **Escenario 2 (Fuera de días de gracia):**
    * Botón a presionar: `Modificar recordatorio`
    * El sistema informa: `El recordatorio debe estar dentro de los 10 días de gracia para pagar`

## Cancelar reserva no abonados
* **Escenario 1 (Con antelación):**
    * Botón a presionar: `Cancelar Reserva`
    * El sistema informa: Que la cancelación se realizó con éxito (notifica reembolso a cliente).
* **Escenario 2 (Sin antelación):**
    * Botón a presionar: `Cancelar Reserva`
    * El sistema informa: Que la cancelación se realizó con éxito.

## Registrar Profesor
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Registrar Profesor`
    * El sistema informa: `Profesor registrado con éxito`
* **Escenario 2 (Ya existente):**
    * El sistema informa: `El profesor con este número de documento ya se encuentra registrado`

## Modificar Empleado
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `Datos actualizados correctamente`
* **Escenario 2 (Formato inválido):**
    * Botón a presionar: `Guardar cambios`
    * El sistema informa: `El formato del teléfono es inválido. Ingrese solo números`

## Eliminar Empleado
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Eliminar`
    * El sistema informa: `Empleado eliminado con éxito`

## Listar Profesores
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Profesores`
    * El sistema muestra: Lista de profesores.
* **Escenario 2 (Vacío):**
    * Botón a presionar: `Profesores`
    * El sistema muestra: `No hay profesores registrados actualmente en el sistema`

## Ver Detalle de Empleado
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Ver detalle`
    * El sistema muestra: Nombre, apellido, DNI y datos de contacto del empleado.

## Registrar Pago
* **Escenario 1 (Transferencia):**
    * Botones/Opciones: Medio de pago `Transferencia`, `Registrar Pago`
    * El sistema informa: `Pago registrado correctamente`
* **Escenario 2 (QR):**
    * Botones/Opciones: Medio de pago `QR Mercado Pago`, `Registrar Pago`
    * El sistema informa: `Pago registrado correctamente`
* **Escenario 3 (Monto inválido):**
    * Botón a presionar: `Registrar Pago`
    * El sistema informa: `El monto del pago debe ser mayor a cero`

## Decidir asistencia
* **Escenario 1 (Confirmar):**
    * Botón a presionar: `Confirmar asistencia`
    * El sistema informa: `Reserva confirmada con éxito`
* **Escenario 2 (Rechazar):**
    * Botón a presionar: `Rechazar lugar`
    * El sistema informa: `Has rechazado el cupo` (notifica al siguiente en la lista).

## Reservar Clase abonado (Detalle de la clase)
* **Escenario 1 (Con disponibilidad):**
    * Selección: Clic en la clase.
    * El sistema muestra botón: `Reservar`
* **Escenario 2 (Sin disponibilidad):**
    * Selección: Clic en la clase.
    * El sistema muestra botón: `Anotarse en lista de espera`

## Agregar Cliente a lista de espera
* **Escenario 1 (Abonados):**
    * Opciones/Botones: `Anotarse en lista de espera`, lista de abonados
    * El sistema informa: Que se lo ha agregado a la lista de espera de abonados.
* **Escenario 2 (No abonados):**
    * Opciones/Botones: `Anotarse en lista de espera`, lista de no abonados
    * El sistema informa: Que se lo ha agregado a la lista de espera de no abonados.

## Pagar con Mercado Pago
* **Escenario 1 (Exitoso):**
    * Selección: Opción de pagar con Mercado Pago.
    * El sistema informa: Notificación de pago exitoso.
* **Escenario 2 (Pago incompleto):**
    * Selección: Opción de pagar con Mercado Pago.
    * El sistema informa: Ocurrió un error al pagar.
* **Escenario 3 (Falla de conexión):**
    * Selección: Opción de pagar con Mercado Pago.
    * El sistema informa: Hubo un error en la conexión.

## Pagar con QR
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Generar QR`
    * El sistema muestra: Código QR en pantalla.

## Notificar cliente manual
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Notificar falta de pago`
    * El sistema envía: Notificación vía mail al cliente.

## Confirmar registro
* **Escenario 1 (Exitoso):**
    * Botón a presionar: `Confirmar registro`
    * El sistema informa: `Usted ha sido registrado correctamente`
* **Escenario 2 (Expirado):**
    * El sistema informa: `El enlace de confirmación ha expirado`
* **Escenario 3 (Inexistente):**
    * El sistema informa: `El enlace de confirmación es inválido`

## Filtrar usuarios
* **Escenario 1 y 2 (Por Búsqueda):**
    * Botón a presionar: `Buscar`
    * El sistema muestra: Lista de usuarios coincidentes.
* **Escenario 3 (Por Estado):**
    * Botones: `Estado`, `Activo`
    * El sistema muestra: Usuarios activos.
* **Escenario 4 (Por Rol):**
    * Botones: `Rol`, `Cliente`
    * El sistema muestra: Todos los clientes.

## Filtrar clases
* **Escenario 1 (Actividad):**
    * Botones/Opciones: `Actividad`, Actividad específica.
    * El sistema muestra: Clases que coinciden.
* **Escenario 2 (Día):**
    * Botones/Opciones: `Día`, Día específico.
    * El sistema muestra: Clases que coinciden.
* **Escenario 3 y 4 (Horarios):**
    * Opciones: Seleccionar hora de inicio / fin.
    * El sistema muestra: Clases que coinciden.

## Filtrar profesores
* **Escenario 1 (Por Actividad):**
    * Botones/Opciones: `Actividad`, Actividad específica.
    * El sistema muestra: Profesores que coinciden.
* **Escenario 2 y 3 (Por Búsqueda de Nombre/DNI):**
    * Botón a presionar: `Buscar`
    * El sistema muestra: Profesores que coinciden.

## Modificar precio de actividad
* **Escenario 1 (Exitoso):**
    * Botones a presionar: `Modificar precio`, `Guardar cambios`
    * El sistema informa: `El precio fue actualizado correctamente`
* **Escenario 2 (Inválido):**
    * Botones a presionar: `Modificar precio`, `Guardar cambios`
    * El sistema informa: `El precio debe ser mayor a cero`