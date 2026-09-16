import { useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, ClipboardList, History, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DEMO_ACTOR,
  type DemandContext,
  type DemandInput,
  DemandConflictError,
  DemandValidationError,
  ingestStoredDemand,
  readDemandContexts,
} from '@/lib/demand/domain'
import { DEMO_DEMAND_FIXTURE } from '@/lib/demand/fixtures'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: 'UTC',
})
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'UTC',
})

function nowIso(): string {
  return new Date().toISOString()
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function sortContexts(contexts: DemandContext[]): DemandContext[] {
  return [...contexts].sort((left, right) => right.updated_at.localeCompare(left.updated_at))
}

function buildFixture(): DemandInput {
  return {
    ...DEMO_DEMAND_FIXTURE,
    products: DEMO_DEMAND_FIXTURE.products.map((product) => ({ ...product })),
    received_at: nowIso(),
  }
}

interface InitialDemandState {
  contexts: DemandContext[]
  error: string | null
}

function getInitialDemandState(): InitialDemandState {
  try {
    return { contexts: sortContexts(readDemandContexts()), error: null }
  } catch (error) {
    return {
      contexts: [],
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível ler os contextos salvos da demonstração.',
    }
  }
}

export default function Index() {
  const [initialDemandState] = useState(getInitialDemandState)
  const [contexts, setContexts] = useState<DemandContext[]>(initialDemandState.contexts)
  const [sourceEventId, setSourceEventId] = useState(DEMO_DEMAND_FIXTURE.source_event_id)
  const [orderExternalId, setOrderExternalId] = useState(DEMO_DEMAND_FIXTURE.order_external_id)
  const [customer, setCustomer] = useState(DEMO_DEMAND_FIXTURE.customer)
  const [promisedDate, setPromisedDate] = useState(DEMO_DEMAND_FIXTURE.promised_date)
  const [deliveryLocation, setDeliveryLocation] = useState(DEMO_DEMAND_FIXTURE.delivery_location)
  const [itemCount, setItemCount] = useState(String(DEMO_DEMAND_FIXTURE.item_count))
  const [productDescription, setProductDescription] = useState(
    DEMO_DEMAND_FIXTURE.products[0]?.description ?? '',
  )
  const [productQuantity, setProductQuantity] = useState(
    String(DEMO_DEMAND_FIXTURE.products[0]?.quantity ?? 1),
  )
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    initialDemandState.error ? { tone: 'error', text: initialDemandState.error } : null,
  )
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedContext = useMemo(
    () => contexts.find((context) => context.id === selectedContextId) ?? contexts[0],
    [contexts, selectedContextId],
  )

  function resetForm() {
    const fixture = buildFixture()
    setSourceEventId(fixture.source_event_id)
    setOrderExternalId(fixture.order_external_id)
    setCustomer(fixture.customer)
    setPromisedDate(fixture.promised_date)
    setDeliveryLocation(fixture.delivery_location)
    setItemCount(String(fixture.item_count))
    setProductDescription(fixture.products[0]?.description ?? '')
    setProductQuantity(String(fixture.products[0]?.quantity ?? 1))
  }

  function submitDemand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setIsSubmitting(true)

    const input: DemandInput = {
      source_event_id: sourceEventId,
      order_external_id: orderExternalId,
      customer,
      promised_date: promisedDate,
      products: [
        {
          code: DEMO_DEMAND_FIXTURE.products[0]?.code ?? 'PROD-DEMO-001',
          description: productDescription,
          quantity: Number(productQuantity),
        },
      ],
      delivery_location: deliveryLocation,
      item_count: Number(itemCount),
      source_type: 'fixture',
      received_at: nowIso(),
    }

    try {
      const result = ingestStoredDemand(input, DEMO_ACTOR)
      const nextContexts = sortContexts(result.contexts)
      setContexts(nextContexts)
      setSelectedContextId(result.context.id)
      setMessage({
        tone: 'success',
        text: result.created
          ? `Contexto ${result.context.id} criado e encaminhado para Engenharia.`
          : `Reenvio idempotente: o contexto ${result.context.id} foi reutilizado; nenhum duplicado foi criado.`,
      })
    } catch (error) {
      if (error instanceof DemandValidationError) {
        setMessage({ tone: 'error', text: error.issues.join(' ') })
      } else if (error instanceof DemandConflictError) {
        setMessage({ tone: 'error', text: error.message })
      } else {
        setMessage({
          tone: 'error',
          text: error instanceof Error ? error.message : 'Não foi possível registrar a demanda.',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Centro Operacional Dlean · Fase 1
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Entrada de demanda
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Registre uma demanda de demonstração, valide os campos mínimos e acompanhe o contexto
              encaminhado para Engenharia.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-1.5 border-amber-300 bg-amber-50 px-3 py-1.5 text-amber-800">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Fixture controlada · sem ERP
          </Badge>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Nova demanda</CardTitle>
              <CardDescription>
                Os dados são salvos apenas no navegador para esta demonstração. Nenhuma chamada ao
                MaxiProd é realizada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={submitDemand} noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="source-event-id">Identificador da entrada</Label>
                    <Input
                      id="source-event-id"
                      value={sourceEventId}
                      onChange={(event) => setSourceEventId(event.target.value)}
                      aria-describedby="source-event-help"
                    />
                    <p id="source-event-help" className="text-xs text-slate-500">
                      Repetições deste valor são idempotentes.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order-external-id">Número do pedido</Label>
                    <Input
                      id="order-external-id"
                      value={orderExternalId}
                      onChange={(event) => setOrderExternalId(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer">Cliente</Label>
                    <Input
                      id="customer"
                      value={customer}
                      onChange={(event) => setCustomer(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promised-date">Data prometida</Label>
                    <Input
                      id="promised-date"
                      type="date"
                      value={promisedDate}
                      onChange={(event) => setPromisedDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="delivery-location">Local de entrega</Label>
                    <Input
                      id="delivery-location"
                      value={deliveryLocation}
                      onChange={(event) => setDeliveryLocation(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item-count">Quantidade de itens</Label>
                    <Input
                      id="item-count"
                      type="number"
                      min={1}
                      step={1}
                      value={itemCount}
                      onChange={(event) => setItemCount(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-quantity">Quantidade do produto</Label>
                    <Input
                      id="product-quantity"
                      type="number"
                      min={1}
                      step={1}
                      value={productQuantity}
                      onChange={(event) => setProductQuantity(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="product-description">Produto</Label>
                    <Input
                      id="product-description"
                      value={productDescription}
                      onChange={(event) => setProductDescription(event.target.value)}
                    />
                  </div>
                </div>

                {message ? (
                  <div
                    className={`flex items-start gap-2 rounded-md border px-3 py-3 text-sm ${
                      message.tone === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-red-200 bg-red-50 text-red-900'
                    }`}
                    role="alert"
                  >
                    {message.tone === 'success' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{message.text}</span>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Recarregar fixture
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Registrando…' : 'Registrar demanda'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Contexto selecionado</CardTitle>
              <CardDescription>
                A demanda elegível segue automaticamente para a fila de Engenharia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedContext ? (
                <div className="space-y-5">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs text-emerald-800">{selectedContext.id}</span>
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                        aguardando_engenharia
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-medium text-emerald-950">
                      {selectedContext.order_external_id} · {selectedContext.customer}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                      {selectedContext.state_reason}
                    </p>
                  </div>

                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Data prometida</dt>
                      <dd className="font-medium text-slate-900">{formatDate(selectedContext.promised_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Itens</dt>
                      <dd className="font-medium text-slate-900">{selectedContext.item_count}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">Local de entrega</dt>
                      <dd className="font-medium text-slate-900">{selectedContext.delivery_location}</dd>
                    </div>
                  </dl>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <History className="h-4 w-4" aria-hidden="true" />
                      Histórico append-only
                    </div>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Evento</TableHead>
                            <TableHead>Quando</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedContext.events.map((event) => (
                            <TableRow key={event.id}>
                              <TableCell>
                                <div className="font-medium text-slate-900">{event.type}</div>
                                <div className="mt-1 text-xs text-slate-500">{event.reason}</div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-slate-600">
                                {formatDateTime(event.occurred_at)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                  Registre a primeira fixture válida para visualizar o contexto e o histórico.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Demandas registradas</CardTitle>
            <CardDescription>
              {contexts.length === 0
                ? 'Nenhuma demanda foi registrada neste navegador.'
                : `${contexts.length} contexto${contexts.length === 1 ? '' : 's'} registrado${contexts.length === 1 ? '' : 's'} na fixture.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contexts.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Data prometida</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Atualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contexts.map((context) => (
                      <TableRow
                        key={context.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedContextId(context.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelectedContextId(context.id)
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Selecionar contexto ${context.id}`}
                      >
                        <TableCell className="font-medium text-slate-900">
                          {context.order_external_id}
                        </TableCell>
                        <TableCell>{context.customer}</TableCell>
                        <TableCell>{formatDate(context.promised_date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                            {context.state}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {formatDateTime(context.updated_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
