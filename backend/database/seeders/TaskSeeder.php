<?php

namespace Database\Seeders;

use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class TaskSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        // Agentes activos (IDs 2-8) con distintas cargas de trabajo
        $agentTasks = [
            // Carlos Mendez (ID 2) - Alto rendimiento: muchas tareas, alta completitud, buen tiempo
            2 => [
                ['title' => 'Revisar solicitud crédito #25-00012', 'status' => 'completada', 'priority' => 'alta', 'created' => -15, 'due' => -5, 'updated' => -7],
                ['title' => 'Llamar cliente potencial López', 'status' => 'completada', 'priority' => 'media', 'created' => -20, 'due' => -10, 'updated' => -12],
                ['title' => 'Preparar informe mensual de ventas', 'status' => 'completada', 'priority' => 'alta', 'created' => -12, 'due' => -3, 'updated' => -4],
                ['title' => 'Seguimiento oportunidad Empresa ABC', 'status' => 'completada', 'priority' => 'media', 'created' => -25, 'due' => -15, 'updated' => -16],
                ['title' => 'Actualizar datos del cliente Martínez', 'status' => 'completada', 'priority' => 'baja', 'created' => -8, 'due' => -2, 'updated' => -3],
                ['title' => 'Verificar documentación crédito #25-00018', 'status' => 'completada', 'priority' => 'alta', 'created' => -10, 'due' => -4, 'updated' => -5],
                ['title' => 'Contactar referencia del lead Gómez', 'status' => 'en_progreso', 'priority' => 'media', 'created' => -3, 'due' => 5, 'updated' => -1],
                ['title' => 'Enviar propuesta a cliente Torres', 'status' => 'pendiente', 'priority' => 'alta', 'created' => -1, 'due' => 7, 'updated' => -1],
                ['title' => 'Archivar expediente cliente Ruiz', 'status' => 'archivada', 'priority' => 'baja', 'created' => -30, 'due' => null, 'updated' => -20],
                ['title' => 'Cobro deductora nómina febrero', 'status' => 'completada', 'priority' => 'alta', 'created' => -6, 'due' => -1, 'updated' => -2],
            ],

            // Wilmer Marquez (ID 3) - Rendimiento medio: cumple pero con retrasos
            3 => [
                ['title' => 'Analizar perfil crediticio lead Pérez', 'status' => 'completada', 'priority' => 'alta', 'created' => -18, 'due' => -10, 'updated' => -8], // tarde
                ['title' => 'Completar formulario de análisis #204', 'status' => 'completada', 'priority' => 'media', 'created' => -14, 'due' => -7, 'updated' => -6], // tarde
                ['title' => 'Negociar condiciones crédito Fernández', 'status' => 'completada', 'priority' => 'alta', 'created' => -22, 'due' => -14, 'updated' => -15],
                ['title' => 'Seguimiento pago cuota 3 crédito #25-00005', 'status' => 'en_progreso', 'priority' => 'alta', 'created' => -5, 'due' => -2, 'updated' => -1], // vencida
                ['title' => 'Actualizar pipeline de oportunidades', 'status' => 'pendiente', 'priority' => 'media', 'created' => -2, 'due' => 3, 'updated' => -2],
                ['title' => 'Revisar contrato deductora XYZ', 'status' => 'pendiente', 'priority' => 'baja', 'created' => -1, 'due' => 10, 'updated' => -1],
                ['title' => 'Generar reporte de cobranza semanal', 'status' => 'completada', 'priority' => 'media', 'created' => -9, 'due' => -4, 'updated' => -5],
                ['title' => 'Registro de cobros mes pasado', 'status' => 'archivada', 'priority' => 'baja', 'created' => -35, 'due' => null, 'updated' => -25],
            ],

            // Ahixel Rojas (ID 4) - Bajo rendimiento: muchas vencidas
            4 => [
                ['title' => 'Contactar lead referido García', 'status' => 'completada', 'priority' => 'media', 'created' => -20, 'due' => -12, 'updated' => -10], // tarde
                ['title' => 'Verificar ingresos lead Sánchez', 'status' => 'en_progreso', 'priority' => 'alta', 'created' => -10, 'due' => -5, 'updated' => -1], // vencida
                ['title' => 'Preparar análisis de riesgo crédito #25-00020', 'status' => 'pendiente', 'priority' => 'alta', 'created' => -7, 'due' => -3, 'updated' => -7], // vencida
                ['title' => 'Llamar a morosos del mes', 'status' => 'pendiente', 'priority' => 'alta', 'created' => -8, 'due' => -4, 'updated' => -8], // vencida
                ['title' => 'Enviar recordatorio de pago masivo', 'status' => 'en_progreso', 'priority' => 'media', 'created' => -4, 'due' => -1, 'updated' => -1], // vencida
                ['title' => 'Archivar leads inactivos Q4', 'status' => 'archivada', 'priority' => 'baja', 'created' => -40, 'due' => null, 'updated' => -30],
                ['title' => 'Actualizar tabla de amortización', 'status' => 'completada', 'priority' => 'media', 'created' => -15, 'due' => -8, 'updated' => -9],
            ],

            // Daniel Gómez (ID 5) - Buen rendimiento, pocas tareas
            5 => [
                ['title' => 'Capacitación nuevo producto financiero', 'status' => 'completada', 'priority' => 'media', 'created' => -10, 'due' => -3, 'updated' => -4],
                ['title' => 'Elaborar presentación para junta', 'status' => 'completada', 'priority' => 'alta', 'created' => -7, 'due' => -2, 'updated' => -3],
                ['title' => 'Revisar términos y condiciones nuevos', 'status' => 'completada', 'priority' => 'baja', 'created' => -5, 'due' => 2, 'updated' => -1],
                ['title' => 'Seguimiento a quejas del cliente Díaz', 'status' => 'en_progreso', 'priority' => 'alta', 'created' => -2, 'due' => 5, 'updated' => -1],
            ],

            // Leonardo Gómez (ID 6) - Rendimiento medio-alto
            6 => [
                ['title' => 'Gestionar renovación crédito #25-00003', 'status' => 'completada', 'priority' => 'alta', 'created' => -16, 'due' => -8, 'updated' => -9],
                ['title' => 'Validar documentos formalización', 'status' => 'completada', 'priority' => 'alta', 'created' => -12, 'due' => -5, 'updated' => -6],
                ['title' => 'Contactar lead web orgánico', 'status' => 'completada', 'priority' => 'media', 'created' => -9, 'due' => -3, 'updated' => -4],
                ['title' => 'Crear propuesta crédito educativo', 'status' => 'en_progreso', 'priority' => 'alta', 'created' => -4, 'due' => 3, 'updated' => -1],
                ['title' => 'Seguimiento deductora Nómina Plus', 'status' => 'pendiente', 'priority' => 'media', 'created' => -1, 'due' => 8, 'updated' => -1],
                ['title' => 'Completar auditoría interna de créditos', 'status' => 'completada', 'priority' => 'alta', 'created' => -20, 'due' => -12, 'updated' => -13],
                ['title' => 'Reportes antiguos de cobranza', 'status' => 'archivada', 'priority' => 'baja', 'created' => -45, 'due' => null, 'updated' => -35],
                ['title' => 'Revisión de cartera morosa', 'status' => 'pendiente', 'priority' => 'alta', 'created' => -3, 'due' => -1, 'updated' => -3], // vencida
            ],

            // María García (ID 7) - Top performer
            7 => [
                ['title' => 'Cerrar negociación con Corporación XYZ', 'status' => 'completada', 'priority' => 'alta', 'created' => -14, 'due' => -7, 'updated' => -8],
                ['title' => 'Formalizar crédito hipotecario Vargas', 'status' => 'completada', 'priority' => 'alta', 'created' => -11, 'due' => -4, 'updated' => -5],
                ['title' => 'Seguimiento post-venta clientes enero', 'status' => 'completada', 'priority' => 'media', 'created' => -8, 'due' => -2, 'updated' => -3],
                ['title' => 'Revisar solicitudes pendientes', 'status' => 'completada', 'priority' => 'alta', 'created' => -6, 'due' => -1, 'updated' => -2],
                ['title' => 'Capacitar nuevo agente en sistema', 'status' => 'completada', 'priority' => 'media', 'created' => -18, 'due' => -10, 'updated' => -11],
                ['title' => 'Elaborar estrategia captación Q1', 'status' => 'completada', 'priority' => 'alta', 'created' => -22, 'due' => -14, 'updated' => -15],
                ['title' => 'Visita a empresa prospect Nueva Era', 'status' => 'completada', 'priority' => 'media', 'created' => -5, 'due' => -1, 'updated' => -2],
                ['title' => 'Preparar documentación auditoría externa', 'status' => 'en_progreso', 'priority' => 'alta', 'created' => -2, 'due' => 5, 'updated' => -1],
                ['title' => 'Actualizar CRM con datos nuevos leads', 'status' => 'pendiente', 'priority' => 'media', 'created' => -1, 'due' => 4, 'updated' => -1],
                ['title' => 'Expedientes cerrados 2025', 'status' => 'archivada', 'priority' => 'baja', 'created' => -50, 'due' => null, 'updated' => -40],
                ['title' => 'Revisión de scoring crediticio batch', 'status' => 'completada', 'priority' => 'alta', 'created' => -4, 'due' => 1, 'updated' => -1],
                ['title' => 'Llamadas de cobranza preventiva', 'status' => 'completada', 'priority' => 'media', 'created' => -3, 'due' => 2, 'updated' => -1],
            ],

            // Juan Pérez (ID 8) - Rendimiento bajo-medio
            8 => [
                ['title' => 'Registrar pagos pendientes en sistema', 'status' => 'completada', 'priority' => 'media', 'created' => -12, 'due' => -5, 'updated' => -3], // tarde
                ['title' => 'Conciliar pagos deductora febrero', 'status' => 'en_progreso', 'priority' => 'alta', 'created' => -6, 'due' => -2, 'updated' => -1], // vencida
                ['title' => 'Enviar estados de cuenta a clientes', 'status' => 'pendiente', 'priority' => 'media', 'created' => -4, 'due' => -1, 'updated' => -4], // vencida
                ['title' => 'Atender reclamo cliente Rodríguez', 'status' => 'completada', 'priority' => 'alta', 'created' => -8, 'due' => -3, 'updated' => -4],
                ['title' => 'Archivo digital de contratos', 'status' => 'archivada', 'priority' => 'baja', 'created' => -30, 'due' => null, 'updated' => -22],
            ],
        ];

        $projects = [
            ['code' => 'VENT', 'name' => 'Ventas y Captación'],
            ['code' => 'COBR', 'name' => 'Cobranza'],
            ['code' => 'FORM', 'name' => 'Formalización'],
            ['code' => 'ADMIN', 'name' => 'Administración'],
            ['code' => 'CRM', 'name' => 'Gestión CRM'],
        ];

        foreach ($agentTasks as $agentId => $tasks) {
            foreach ($tasks as $taskData) {
                $project = $projects[array_rand($projects)];
                $createdAt = $now->copy()->addDays($taskData['created']);
                $updatedAt = $now->copy()->addDays($taskData['updated']);

                Task::create([
                    'project_code' => $project['code'],
                    'project_name' => $project['name'],
                    'title' => $taskData['title'],
                    'details' => null,
                    'status' => $taskData['status'],
                    'priority' => $taskData['priority'],
                    'assigned_to' => $agentId,
                    'start_date' => $createdAt->toDateString(),
                    'due_date' => $taskData['due'] !== null ? $now->copy()->addDays($taskData['due'])->toDateString() : null,
                    'created_at' => $createdAt,
                    'updated_at' => $updatedAt,
                ]);
            }
        }
    }
}
