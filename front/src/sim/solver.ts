import { compatible, groupForDimension, type Unit } from '@/physics/quantity'
import {
  defaultParams,
  inputsOf,
  portOf,
  portOfTerminal,
  type ComponentSpec,
} from './component'
import { getComponent } from './registry'

export interface SchemeComponent {
  id: string
  key: string
  
  params?: Record<string, number>
}

export interface SchemeEndpoint {
  component: string
  terminal: string
}

export interface SchemeLink {
  id: string
  from: SchemeEndpoint
  to: SchemeEndpoint
}

export interface Scheme {
  components: SchemeComponent[]
  links: SchemeLink[]
}

export type SolveIssue =
  | { kind: 'unknown-component'; componentId: string; key: string }
  | { kind: 'incompatible'; linkId: string; from: Unit; to: Unit }
  | { kind: 'wrong-direction'; linkId: string; reason: 'in-to-in' | 'out-to-out' }
  | { kind: 'unknown-terminal'; linkId: string; endpoint: SchemeEndpoint }
  | { kind: 'unstable'; componentIds: string[] }
  | { kind: 'no-output'; componentId: string }

export interface SolveResult {
  
  values: Record<string, number | null>
  issues: SolveIssue[]
}

export interface SolveOptions {
  
  time?: number
  
  iterations?: number
}

const DEFAULT_ITERATIONS = 24
const CONVERGENCE = 1e-9

export function portKey(componentId: string, portId: string): string {
  return `${componentId}:${portId}`
}

export function groupOfPort(port: { unit: Unit; group?: string }): string {
  return port.group ?? groupForDimension(port.unit.dimension)
}

export const CONNECTABLE_GROUPS: Record<string, string[]> = {
  electrical: ['electrical'],
  thermal: ['thermal'],
  mechanical: ['mechanical', 'geometric'],
  geometric: ['geometric', 'mechanical'],
  optical: ['optical', 'geometric'],
  time: ['time'],
  other: ['other'],
}

function isModifier(port: { modifier?: boolean }): boolean {
  return Boolean(port.modifier)
}

interface Prepared {
  component: SchemeComponent
  spec: ComponentSpec
  params: Record<string, number>
}

export function validateScheme(scheme: Scheme): SolveIssue[] {
  const issues: SolveIssue[] = []
  const prepared = new Map<string, Prepared>()

  for (const component of scheme.components) {
    const spec = getComponent(component.key)
    if (!spec) {
      issues.push({ kind: 'unknown-component', componentId: component.id, key: component.key })
      continue
    }

    prepared.set(component.id, {
      component,
      spec,
      params: { ...defaultParams(spec), ...component.params },
    })
  }

  for (const link of scheme.links) {
    const from = prepared.get(link.from.component)
    const to = prepared.get(link.to.component)

    if (!from || !to) {
      issues.push({ kind: 'unknown-terminal', linkId: link.id, endpoint: link.from })
      continue
    }

    const fromPort = portOfTerminal(from.spec, link.from.terminal)
    const toPort = portOfTerminal(to.spec, link.to.terminal)

    if (!fromPort || !toPort) {
      issues.push({
        kind: 'unknown-terminal',
        linkId: link.id,
        endpoint: fromPort ? link.to : link.from,
      })
      continue
    }

    if (fromPort.dir === 'in' && toPort.dir === 'in') {
      issues.push({ kind: 'wrong-direction', linkId: link.id, reason: 'in-to-in' })
      continue
    }

    if (fromPort.dir === 'out' && toPort.dir === 'out') {
      issues.push({ kind: 'wrong-direction', linkId: link.id, reason: 'out-to-out' })
      continue
    }

    const output = fromPort.dir === 'out' ? fromPort : toPort
    const input = fromPort.dir === 'out' ? toPort : fromPort

    if (!portsCompatible(output, input)) {
      issues.push({ kind: 'incompatible', linkId: link.id, from: output.unit, to: input.unit })
    }
  }

  return issues
}

export function portsCompatible(
  output: { unit: Unit; group?: string; modifier?: boolean },
  input: { unit: Unit; group?: string; modifier?: boolean },
): boolean {
  if (isModifier(input)) return true

  if (compatible(output.unit, input.unit)) return true

  const outputGroup = groupOfPort(output)
  const inputGroup = groupOfPort(input)

  if (outputGroup === inputGroup) return true

  return (CONNECTABLE_GROUPS[outputGroup] ?? []).includes(inputGroup)
}

export function connectProblem(
  fromSpec: ComponentSpec,
  fromTerminalId: string,
  toSpec: ComponentSpec,
  toTerminalId: string,
): string | null {
  const fromPort = portOfTerminal(fromSpec, fromTerminalId)
  const toPort = portOfTerminal(toSpec, toTerminalId)

  if (!fromPort || !toPort) return 'У клеммы не указана величина'

  if (fromPort.dir === 'in' && toPort.dir === 'in') {
    return 'Обе клеммы — входы. Провод идёт от выхода к входу: начните с зелёной клеммы'
  }

  if (fromPort.dir === 'out' && toPort.dir === 'out') {
    return 'Обе клеммы — выходы. Провод идёт от выхода к входу: закончите на синей клемме'
  }

  const output = fromPort.dir === 'out' ? fromPort : toPort
  const input = fromPort.dir === 'out' ? toPort : fromPort

  if (!portsCompatible(output, input)) {
    return `Разные величины: ${output.label} (${output.unit.symbol}) и ${input.label} (${input.unit.symbol}). Соединяйте величины одной группы: например напряжение, ток и сопротивление`
  }

  return null
}

export function canConnect(
  fromSpec: ComponentSpec,
  fromTerminalId: string,
  toSpec: ComponentSpec,
  toTerminalId: string,
): { ok: true } | { ok: false; reason: string } {
  const problem = connectProblem(fromSpec, fromTerminalId, toSpec, toTerminalId)
  return problem ? { ok: false, reason: problem } : { ok: true }
}

function orderOf(scheme: Scheme, prepared: Map<string, Prepared>): { order: string[]; cycle: string[] } {
  const incoming = new Map<string, Set<string>>()
  for (const component of scheme.components) incoming.set(component.id, new Set())

  for (const link of scheme.links) {
    const from = prepared.get(link.from.component)
    const to = prepared.get(link.to.component)
    if (!from || !to) continue

    const fromPort = portOfTerminal(from.spec, link.from.terminal)
    const toPort = portOfTerminal(to.spec, link.to.terminal)
    if (!fromPort || !toPort) continue
    if (fromPort.dir !== 'out' || toPort.dir !== 'in') continue

    incoming.get(to.component.id)?.add(from.component.id)
  }

  const order: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const cycle = new Set<string>()

  const visit = (id: string) => {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      cycle.add(id)
      return
    }

    visiting.add(id)
    for (const dependency of incoming.get(id) ?? []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
    order.push(id)
  }

  for (const component of scheme.components) visit(component.id)

  return { order, cycle: [...cycle] }
}

export function solveScheme(scheme: Scheme, options: SolveOptions = {}): SolveResult {
  const time = options.time ?? 0
  const iterations = options.iterations ?? DEFAULT_ITERATIONS

  const issues = validateScheme(scheme)
  const fatal = issues.some(
    (issue) => issue.kind === 'incompatible' || issue.kind === 'wrong-direction' || issue.kind === 'unknown-component',
  )

  const prepared = new Map<string, Prepared>()
  for (const component of scheme.components) {
    const spec = getComponent(component.key)
    if (spec) prepared.set(component.id, { component, spec, params: { ...defaultParams(spec), ...component.params } })
  }

  const values: Record<string, number | null> = {}
  for (const [id, item] of prepared) {
    for (const port of item.spec.ports) values[portKey(id, port.id)] = null
  }

  if (fatal) return { values, issues }

  const { order, cycle } = orderOf(scheme, prepared)

  const incomingLink = new Map<string, SchemeLink>()
  for (const link of scheme.links) {
    const from = prepared.get(link.from.component)
    const to = prepared.get(link.to.component)
    if (!from || !to) continue

    const fromPort = portOfTerminal(from.spec, link.from.terminal)
    const toPort = portOfTerminal(to.spec, link.to.terminal)
    if (!fromPort || !toPort) continue
    if (fromPort.dir !== 'out' || toPort.dir !== 'in') continue

    const key = `${link.to.component}:${toPort.id}`
    if (!incomingLink.has(key)) incomingLink.set(key, link)
  }

  const computeOnce = (id: string) => {
    const item = prepared.get(id)
    if (!item) return

    const inputs: Record<string, number | null> = {}
    for (const port of inputsOf(item.spec)) {
      const link = incomingLink.get(`${id}:${port.id}`)

      const passthroughSelf = item.spec.ports.find((entry) => entry.passthrough && entry.dir === 'in')
      if (!link) {
        inputs[port.id] = passthroughSelf ? (values[portKey(id, passthroughSelf.id)] ?? null) : null
        continue
      }

      const source = prepared.get(link.from.component)
      const sourcePort = source ? portOfTerminal(source.spec, link.from.terminal) : undefined
      inputs[port.id] = sourcePort ? (values[portKey(link.from.component, sourcePort.id)] ?? null) : null
    }

    const result = item.spec.compute({ inputs, params: item.params, time })

    for (const port of item.spec.ports) {
      if (port.dir !== 'out') continue
      const value = result[port.id]
      values[portKey(id, port.id)] = typeof value === 'number' && Number.isFinite(value) ? value : null
    }
  }

  const passes = cycle.length > 0 ? iterations : 1
  let unstable = false

  for (let pass = 0; pass < passes; pass += 1) {
    const before = JSON.stringify(values)

    for (const id of order) computeOnce(id)

    if (pass > 0 && before === JSON.stringify(values)) break

    if (pass === passes - 1 && cycle.length > 0) {
      const settled = converged(scheme, prepared, values)
      unstable = !settled
    }
  }

  measureCircuit(prepared, values)

  for (const [id, item] of prepared) {
    if (item.spec.ports.every((port) => port.dir !== 'out')) {
      issues.push({ kind: 'no-output', componentId: id })
    }
  }

  if (unstable) issues.push({ kind: 'unstable', componentIds: cycle })

  return { values, issues }
}


function measureCircuit(
  prepared: Map<string, Prepared>,
  values: Record<string, number | null>,
): void {
  const measuring = [...prepared.values()].filter((item) => item.spec.measure)
  if (measuring.length === 0) return

  let voltage: number | null = null
  for (const item of prepared.values()) {
    const port = item.spec.ports.find((entry) => entry.id === 'source')
    if (!port) continue

    const value = values[portKey(item.component.id, port.id)]
    if (typeof value === 'number') {
      voltage = value
      break
    }
  }

  let totalOhms = 0
  let hasResistance = false

  for (const item of prepared.values()) {
    const resistance = item.spec.ohms?.(item.params)
    if (typeof resistance === 'number' && Number.isFinite(resistance)) {
      totalOhms += resistance
      hasResistance = true

      // Сопротивление показываем только когда цепь собрана с источником.
      if (voltage !== null) {
        values[portKey(item.component.id, 'ohms')] = resistance
      }
    }
  }

  const ohms = hasResistance && totalOhms > 0 ? totalOhms : null
  const current = voltage !== null && ohms !== null ? voltage / ohms : null

  for (const item of measuring) {
    const result = item.spec.measure!({
      circuitVoltage: voltage,
      circuitCurrent: current,
      totalOhms: ohms,
      read: (componentId, portId) => values[portKey(componentId, portId)] ?? null,
      components: [...prepared.values()].map((entry) => ({
        id: entry.component.id,
        key: entry.spec.key,
        params: entry.params,
      })),
      paramsOf: (componentId) => prepared.get(componentId)?.params ?? {},
    })

    for (const port of item.spec.ports) {
      if (port.dir !== 'out') continue
      const value = result[port.id]
      if (value === undefined) continue
      values[portKey(item.component.id, port.id)] = typeof value === 'number' && Number.isFinite(value) ? value : null
    }
  }
}

function converged(
  scheme: Scheme,
  prepared: Map<string, Prepared>,
  values: Record<string, number | null>,
): boolean {
  const snapshot = { ...values }
  const copy: Record<string, number | null> = { ...values }

  for (const component of scheme.components) {
    const item = prepared.get(component.id)
    if (!item) continue

    const inputs: Record<string, number | null> = {}
    for (const port of inputsOf(item.spec)) inputs[port.id] = null

    const result = item.spec.compute({ inputs, params: item.params, time: 0 })
    for (const port of item.spec.ports) {
      if (port.dir !== 'out') continue
      copy[portKey(component.id, port.id)] = result[port.id] ?? null
    }
  }

  return Object.keys(snapshot).every((key) => {
    const a = snapshot[key] ?? null
    const b = copy[key] ?? null
    if (a === null || b === null) return a === b
    return Math.abs(a - b) < CONVERGENCE
  })
}

export function portValue(
  scheme: Scheme,
  values: Record<string, number | null>,
  componentId: string,
  portId: string,
): number | null {
  const component = scheme.components.find((item) => item.id === componentId)
  const spec = component ? getComponent(component.key) : undefined
  const port = spec ? portOf(spec, portId) : undefined
  if (!port) return null

  const base = values[portKey(componentId, portId)]
  if (base === null || base === undefined) return null

  return (base - (port.unit.offset ?? 0)) / port.unit.factor
}
