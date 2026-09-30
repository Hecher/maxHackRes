import type { ComponentSpec, DomainKey } from './component'

const registry = new Map<string, ComponentSpec>()

export function registerComponent(spec: ComponentSpec): ComponentSpec {
  if (registry.has(spec.key)) {
    throw new Error(`Компонент «${spec.key}» уже зарегистрирован`)
  }

  registry.set(spec.key, spec)
  return spec
}

export function registerComponents(specs: ComponentSpec[]): void {
  for (const spec of specs) registerComponent(spec)
}

export function getComponent(key: string | undefined): ComponentSpec | undefined {
  return key ? registry.get(key) : undefined
}

export function allComponents(): ComponentSpec[] {
  return [...registry.values()]
}

export function componentsOf(domain: DomainKey): ComponentSpec[] {
  return allComponents().filter((spec) => spec.domain === domain)
}

export function resetRegistry(): void {
  registry.clear()
}
