export const DEMAND_STORAGE_KEY = 'dlean.materials.demo.demands.v1'

export const DEMO_ACTOR = {
  id: 'demo-pcp',
  label: 'PCP — fixture controlada',
} as const

export type DemandState = 'aguardando_engenharia'
export type DemandSourceType = 'fixture'
export type DemandEventType =
  | 'demand_received'
  | 'eligibility_confirmed'
  | 'context_created'
  | 'ingestion_replayed'

export interface DemandProduct {
  code: string
  description: string
  quantity: number
}

export interface DemandInput {
  source_event_id: string
  order_external_id: string
  customer: string
  promised_date: string
  products: DemandProduct[]
  delivery_location: string
  item_count: number
  source_type: DemandSourceType
  received_at: string
}

export interface DemandEvent {
  id: string
  type: DemandEventType
  occurred_at: string
  actor_id: string
  actor_label: string
  reason: string
}

export interface DemandContext extends DemandInput {
  id: string
  state: DemandState
  state_reason: string
  created_at: string
  updated_at: string
  events: DemandEvent[]
}

export interface DemandActor {
  id: string
  label: string
}

export interface IngestDemandResult {
  contexts: DemandContext[]
  context: DemandContext
  created: boolean
  replayed: boolean
}

export class DemandValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super('A demanda não atende aos campos mínimos.')
    this.name = 'DemandValidationError'
    this.issues = issues
  }
}

export class DemandConflictError extends Error {
  constructor() {
    super(
      'Já existe um contexto com este identificador, mas os dados recebidos são diferentes. O caso precisa ser tratado pelo PCP.',
    )
    this.name = 'DemandConflictError'
  }
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateDemandInput(input: DemandInput): string[] {
  const issues: string[] = []

  if (!input.source_event_id.trim()) {
    issues.push('Informe o identificador da tentativa de entrada.')
  }

  if (!input.order_external_id.trim()) {
    issues.push('Informe o número do pedido.')
  }

  if (!input.customer.trim()) {
    issues.push('Informe o cliente.')
  }

  if (!isValidDate(input.promised_date)) {
    issues.push('Informe uma data prometida válida.')
  }

  if (!input.delivery_location.trim()) {
    issues.push('Informe o local de entrega.')
  }

  if (!Number.isInteger(input.item_count) || input.item_count < 1) {
    issues.push('A quantidade de itens deve ser um número inteiro maior que zero.')
  }

  if (input.source_type !== 'fixture') {
    issues.push('A entrada desta demonstração deve usar source_type=fixture.')
  }

  if (!input.received_at.trim()) {
    issues.push('A data de recebimento é obrigatória para o histórico.')
  }

  if (!Array.isArray(input.products) || input.products.length === 0) {
    issues.push('Inclua pelo menos um produto.')
  } else {
    input.products.forEach((product, index) => {
      if (!product.description.trim()) {
        issues.push(`Informe a descrição do produto ${index + 1}.`)
      }

      if (!Number.isInteger(product.quantity) || product.quantity < 1) {
        issues.push(`A quantidade do produto ${index + 1} deve ser um inteiro maior que zero.`)
      }
    })
  }

  return issues
}

function comparableDemand(input: DemandInput | DemandContext) {
  return {
    source_event_id: input.source_event_id,
    order_external_id: input.order_external_id,
    customer: input.customer,
    promised_date: input.promised_date,
    products: input.products,
    delivery_location: input.delivery_location,
    item_count: input.item_count,
    source_type: input.source_type,
  }
}

function isSameDemand(existing: DemandContext, input: DemandInput): boolean {
  return JSON.stringify(comparableDemand(existing)) === JSON.stringify(comparableDemand(input))
}

function createEvent(
  type: DemandEventType,
  actor: DemandActor,
  occurredAt: string,
  reason: string,
): DemandEvent {
  return {
    id: makeId('evt'),
    type,
    occurred_at: occurredAt,
    actor_id: actor.id,
    actor_label: actor.label,
    reason,
  }
}

export function createOrReuseDemandContext(
  contexts: DemandContext[],
  input: DemandInput,
  actor: DemandActor,
  now = new Date(),
): IngestDemandResult {
  const issues = validateDemandInput(input)
  if (issues.length > 0) {
    throw new DemandValidationError(issues)
  }

  const occurredAt = now.toISOString()
  const existing = contexts.find(
    (context) =>
      context.source_event_id === input.source_event_id ||
      context.order_external_id === input.order_external_id,
  )

  if (existing) {
    if (!isSameDemand(existing, input)) {
      throw new DemandConflictError()
    }

    const replayEvent = createEvent(
      'ingestion_replayed',
      actor,
      occurredAt,
      'Reenvio idempotente: o contexto existente foi reutilizado; nenhum segundo contexto foi criado.',
    )
    const context = {
      ...existing,
      updated_at: occurredAt,
      events: [...existing.events, replayEvent],
    }

    return {
      contexts: contexts.map((item) => (item.id === existing.id ? context : item)),
      context,
      created: false,
      replayed: true,
    }
  }

  const contextId = makeId('ctx')
  const receivedEvent = createEvent(
    'demand_received',
    actor,
    occurredAt,
    'Entrada recebida pela fixture controlada.',
  )
  const eligibilityEvent = createEvent(
    'eligibility_confirmed',
    actor,
    occurredAt,
    'Campos mínimos válidos; elegibilidade automática confirmada.',
  )
  const contextCreatedEvent = createEvent(
    'context_created',
    actor,
    occurredAt,
    'Contexto criado e encaminhado para a fila de Engenharia.',
  )
  const context: DemandContext = {
    ...input,
    id: contextId,
    state: 'aguardando_engenharia',
    state_reason: 'Dados mínimos válidos; contexto encaminhado automaticamente para Engenharia.',
    created_at: occurredAt,
    updated_at: occurredAt,
    events: [receivedEvent, eligibilityEvent, contextCreatedEvent],
  }

  return {
    contexts: [...contexts, context],
    context,
    created: true,
    replayed: false,
  }
}

function getDemandStorage(): Storage {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('O armazenamento local da demonstração não está disponível neste ambiente.')
  }

  return window.localStorage
}

function isStoredContext(value: unknown): value is DemandContext {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<DemandContext>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.source_event_id === 'string' &&
    typeof candidate.order_external_id === 'string' &&
    typeof candidate.state === 'string' &&
    Array.isArray(candidate.products) &&
    Array.isArray(candidate.events)
  )
}

export function readDemandContexts(storage: Storage = getDemandStorage()): DemandContext[] {
  const raw = storage.getItem(DEMAND_STORAGE_KEY)
  if (!raw) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `Não foi possível ler os contextos salvos da demonstração: ${error instanceof Error ? error.message : 'formato inválido'}`,
    )
  }

  if (!Array.isArray(parsed) || parsed.some((item) => !isStoredContext(item))) {
    throw new Error('Os dados salvos da demonstração estão em formato inválido; nada foi sobrescrito.')
  }

  return parsed
}

export function writeDemandContexts(
  contexts: DemandContext[],
  storage: Storage = getDemandStorage(),
): void {
  try {
    storage.setItem(DEMAND_STORAGE_KEY, JSON.stringify(contexts))
  } catch (error) {
    throw new Error(
      `Não foi possível salvar o contexto da demonstração: ${error instanceof Error ? error.message : 'erro de armazenamento'}`,
    )
  }
}

export function ingestStoredDemand(
  input: DemandInput,
  actor: DemandActor,
  now = new Date(),
  storage: Storage = getDemandStorage(),
): IngestDemandResult {
  const contexts = readDemandContexts(storage)
  const result = createOrReuseDemandContext(contexts, input, actor, now)
  writeDemandContexts(result.contexts, storage)
  return result
}
