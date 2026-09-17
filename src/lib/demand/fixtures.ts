import type { DemandInput } from './domain'

export type DemandScenario = 'valida' | 'incompleta' | 'cancelada' | 'inelegivel'

export const DEMO_DEMAND_FIXTURE: DemandInput = {
  source_event_id: 'FIXTURE-F1-T002-001',
  order_external_id: 'TEST-001',
  customer: 'Cliente de demonstração',
  promised_date: '2026-10-15',
  products: [
    {
      code: 'PROD-DEMO-001',
      description: 'Estrutura metálica de demonstração',
      quantity: 1,
    },
  ],
  delivery_location: 'Local de demonstração',
  item_count: 1,
  order_status: 'ativo',
  eligibility_status: 'elegivel',
  source_type: 'fixture',
  received_at: '',
}

export const DEMO_DEMAND_FIXTURES: Record<DemandScenario, DemandInput> = {
  valida: DEMO_DEMAND_FIXTURE,
  incompleta: {
    ...DEMO_DEMAND_FIXTURE,
    source_event_id: 'FIXTURE-F1-T003-002',
    order_external_id: 'TEST-002',
    customer: '',
    eligibility_status: 'pendente_dados',
  },
  cancelada: {
    ...DEMO_DEMAND_FIXTURE,
    source_event_id: 'FIXTURE-F1-T003-003',
    order_external_id: 'TEST-003',
    order_status: 'cancelado',
  },
  inelegivel: {
    ...DEMO_DEMAND_FIXTURE,
    source_event_id: 'FIXTURE-F1-T003-004',
    order_external_id: 'TEST-004',
    eligibility_status: 'inelegivel',
  },
}

export const DEMAND_SCENARIO_LABELS: Record<DemandScenario, string> = {
  valida: 'Fixture válida',
  incompleta: 'Dados incompletos',
  cancelada: 'Pedido cancelado',
  inelegivel: 'Inelegível',
}
