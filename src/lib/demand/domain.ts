export const DEMAND_STORAGE_KEY = 'dlean.materials.demo.demands.v1'

export const DEMO_ACTOR = {
  id: 'demo-pcp',
  label: 'PCP — fixture controlada',
} as const

export const ORDER_STATUS_VALUES = ['ativo', 'cancelado'] as const
export const ELIGIBILITY_STATUS_VALUES = ['elegivel', 'pendente_dados', 'inelegivel'] as const

export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number]
export type EligibilityStatus = (typeof ELIGIBILITY_STATUS_VALUES)[number]
export type DemandState =
  | 'aguardando_engenharia'
  | 'pendente_dados'
  | 'cancelada'
  | 'inelegivel'
export type DemandSourceType = 'fixture'
export type DemandEventType =
  | 'demand_received'
  | 'eligibility_confirmed'
  | 'context_created'
  | 'ingestion_replayed'
  | 'demand_pended'
  | 'demand_cancelled'
  | 'eligibility_rejected'

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
  order_status: OrderStatus
  eligibility_status: EligibilityStatus
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
  state_responsible: string
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
    super('A demanda não atende aos campos mínimos ou ao contrato da fixture.')
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

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUS_VALUES.includes(value as OrderStatus)
}

function isEligibilityStatus(value: unknown): value is EligibilityStatus {
  return ELIGIBILITY_STATUS_VALUES.includes(value as EligibilityStatus)
}

function isDemandState(value: unknown): value is DemandState {
  return (
    value === 'aguardando_engenharia' ||
    value === 'pendente_dados' ||
    value === 'cancelada' ||
    value === 'inelegivel'
  )
}

export function validateDemandInput(input: DemandInput): string[] {
  const issues: string[] = []

  if (!text(input.source_event_id) && !text(input.order_external_id)) {
    issues.push('Informe o identificador da entrada ou o número do pedido para permitir reprocessamento seguro.')
  }

  if (input.source_type !== 'fixture') {
    issues.push('A entrada desta demonstração deve usar source_type=fixture.')
  }

  if (!text(input.received_at)) {
    issues.push('A data de recebimento é obrigatória para o histórico.')
  }

  if (!isOrderStatus(input.order_status)) {
    issues.push('Informe um status do pedido válido.')
  }

  if (!isEligibilityStatus(input.eligibility_status)) {
    issues.push('Informe um status de elegibilidade válido.')
  }

  return issues
}

export function validateDemandBusinessData(input: DemandInput): string[] {
  const issues: string[] = []

  if (!text(input.order_external_id)) {
    issues.push('Informe o número do pedido.')
  }

  if (!text(input.customer)) {
    issues.push('Informe o cliente.')
  }

  if (!isValidDate(input.promised_date)) {
    issues.push('Informe uma data prometida válida.')
  }

  if (!text(input.delivery_location)) {
    issues.push('Informe o local de entrega.')
  }

  if (!Number.isInteger(input.item_count) || input.item_count < 1) {
    issues.push('A quantidade de itens deve ser um número inteiro maior que zero.')
  }

  if (!Array.isArray(input.products) || input.products.length === 0) {
    issues.push('Inclua pelo menos um produto.')
  } else {
    input.products.forEach((product, index) => {
      if (!text(product.description)) {
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
    order_status: input.order_status,
    eligibility_status: input.eligibility_status,
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

interface StateDecision {
  state: DemandState
  reason: string
  eventType: Exclude<DemandEventType, 'demand_received' | 'ingestion_replayed'>
}

function decideState(input: DemandInput, dataIssues: string[]): StateDecision {
  if (input.order_status === 'cancelado') {
    return {
      state: 'cancelada',
      reason: 'Pedido cancelado na origem; a demanda não foi encaminhada para Engenharia.',
      eventType: 'demand_cancelled',
    }
  }

  if (input.eligibility_status === 'inelegivel') {
    return {
      state: 'inelegivel',
      reason: 'Elegibilidade recusada; a demanda não foi encaminhada para Engenharia.',
      eventType: 'eligibility_rejected',
    }
  }

  if (input.eligibility_status === 'pendente_dados' || dataIssues.length > 0) {
    const reason =
      dataIssues.length > 0
        ? `Dados mínimos ausentes ou inválidos: ${dataIssues.join(' ')}`
        : 'Elegibilidade pendente de dados mínimos para continuar.'

    return {
      state: 'pendente_dados',
      reason,
      eventType: 'demand_pended',
    }
  }

  return {
    state: 'aguardando_engenharia',
    reason: 'Dados mínimos válidos; contexto encaminhado automaticamente para Engenharia.',
    eventType: 'context_created',
  }
}

export function createOrReuseDemandContext(
  contexts: DemandContext[],
  input: DemandInput,
  actor: DemandActor,
  now = new Date(),
): IngestDemandResult {
  const contractIssues = validateDemandInput(input)
  if (contractIssues.length > 0) {
    throw new DemandValidationError(contractIssues)
  }

  const occurredAt = now.toISOString()
  const existing = contexts.find(
    (context) =>
      (text(input.source_event_id) && context.source_event_id === input.source_event_id) ||
      (text(input.order_external_id) && context.order_external_id === input.order_external_id),
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

  const dataIssues = validateDemandBusinessData(input)
  const decision = decideState(input, dataIssues)
  const contextId = makeId('ctx')
  const receivedEvent = createEvent(
    'demand_received',
    actor,
    occurredAt,
    'Entrada recebida pela fixture controlada.',
  )
  const contextEvent = createEvent(
    decision.eventType,
    actor,
    occurredAt,
    decision.reason,
  )
  const events =
    decision.state === 'aguardando_engenharia'
      ? [
          receivedEvent,
          createEvent(
            'eligibility_confirmed',
            actor,
            occurredAt,
            'Campos mínimos válidos; elegibilidade automática confirmada.',
          ),
          contextEvent,
        ]
      : [receivedEvent, contextEvent]
  const context: DemandContext = {
    ...input,
    id: contextId,
    state: decision.state,
    state_reason: decision.reason,
    state_responsible: actor.label,
    created_at: occurredAt,
    updated_at: occurredAt,
    events,
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

function normalizeStoredContext(value: unknown): DemandContext | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<DemandContext>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.source_event_id !== 'string' ||
    typeof candidate.order_external_id !== 'string' ||
    !isDemandState(candidate.state) ||
    !Array.isArray(candidate.products) ||
    !Array.isArray(candidate.events)
  ) {
    return null
  }

  const legacyState = candidate.state
  const orderStatus = isOrderStatus(candidate.order_status)
    ? candidate.order_status
    : legacyState === 'cancelada'
      ? 'cancelado'
      : 'ativo'
  const eligibilityStatus = isEligibilityStatus(candidate.eligibility_status)
    ? candidate.eligibility_status
    : legacyState === 'inelegivel'
      ? 'inelegivel'
      : legacyState === 'pendente_dados'
        ? 'pendente_dados'
        : 'elegivel'

  return {
    ...candidate,
    order_status: orderStatus,
    eligibility_status: eligibilityStatus,
    state_reason:
      typeof candidate.state_reason === 'string'
        ? candidate.state_reason
        : 'Contexto migrado da versão anterior da demonstração.',
    state_responsible:
      typeof candidate.state_responsible === 'string'
        ? candidate.state_responsible
        : 'Sistema — migração da demonstração',
  } as DemandContext
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

  if (!Array.isArray(parsed)) {
    throw new Error('Os dados salvos da demonstração estão em formato inválido; nada foi sobrescrito.')
  }

  const contexts = parsed.map(normalizeStoredContext)
  if (contexts.some((context) => context === null)) {
    throw new Error('Os dados salvos da demonstração estão em formato inválido; nada foi sobrescrito.')
  }

  return contexts as DemandContext[]
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
