-- ====================================================================
-- Script de Reset de Datos de Prueba
-- Sistema de Tasas Variable con int_corriente_vencido
-- Fecha de Formalización: Noviembre 15, 2025
-- ====================================================================

-- 1. BORRAR PAGOS REGISTRADOS
-- Elimina todos los pagos de créditos de los leads de prueba
DELETE FROM credit_payments
WHERE credit_id IN (
  SELECT id FROM credits WHERE lead_id IN (
    SELECT id FROM persons WHERE cedula IN ('118280563', '207140827', '111110002', '111110003')
    AND person_type_id = 1
  )
);

-- 2. BORRAR PLAN DE PAGOS
-- Elimina todo el plan de pagos existente
DELETE FROM plan_de_pagos
WHERE credit_id IN (
  SELECT id FROM credits WHERE lead_id IN (
    SELECT id FROM persons WHERE cedula IN ('118280563', '207140827', '111110002', '111110003')
    AND person_type_id = 1
  )
);

-- 3. RESETEAR CRÉDITOS A ESTADO INICIAL
-- Resetea los créditos a estado "Aprobado" con fecha de formalización en Noviembre 2025
UPDATE credits
SET
  status = 'Aprobado',
  formalized_at = '2025-11-15',
  saldo = monto_credito,
  fecha_ultimo_pago = NULL,
  cuotas_atrasadas = 0,
  updated_at = NOW()
WHERE lead_id IN (
  SELECT id FROM persons WHERE cedula IN ('118280563', '207140827', '111110002', '111110003')
  AND person_type_id = 1
);

-- 4. VERIFICACIÓN DE RESULTADOS
-- Query para verificar los créditos resetados con sus tasas
SELECT
  c.id as credit_id,
  c.numero_operacion,
  p.name as lead_name,
  p.cedula,
  c.status,
  c.formalized_at,
  c.monto_credito,
  c.plazo,
  c.saldo,
  t.tasa as tasa_anual,
  t.tasa_maxima,
  (t.tasa_maxima - t.tasa) as tasa_mora,
  COUNT(pp.id) as cuotas_en_plan,
  COUNT(cp.id) as pagos_registrados
FROM credits c
JOIN persons p ON c.lead_id = p.id
JOIN tasas t ON c.tasa_id = t.id
LEFT JOIN plan_de_pagos pp ON c.id = pp.credit_id
LEFT JOIN credit_payments cp ON c.id = cp.credit_id
WHERE p.cedula IN ('118280563', '207140827', '111110002', '111110003')
  AND p.person_type_id = 1
GROUP BY c.id, c.numero_operacion, p.name, p.cedula, c.status, c.formalized_at,
         c.monto_credito, c.plazo, c.saldo, t.tasa, t.tasa_maxima;

-- ====================================================================
-- NOTAS IMPORTANTES:
-- ====================================================================
-- 1. Después de ejecutar este script, el plan de pagos debe ser
--    regenerado para cada crédito via Frontend o Artisan Command
--
-- 2. La regeneración del plan usará la nueva lógica implementada:
--    - CASO 1: tasa = tasa_maxima → int_corr → vencido, mora = 0
--    - CASO 2: tasa < tasa_maxima → int_corr → vencido, mora calculada
--
-- 3. Los créditos quedarán en estado "Aprobado" listos para generar
--    el plan de pagos con las nuevas columnas y cálculos
--
-- 4. Fecha de formalización: 2025-11-15
--    Esto permite probar el flujo completo desde Noviembre 2025
-- ====================================================================
