import type { DemandInput } from './domain'

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
  source_type: 'fixture',
  received_at: '',
}
