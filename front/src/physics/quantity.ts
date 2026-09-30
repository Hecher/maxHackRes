

export interface Dimension {
  mass: number
  length: number
  time: number
  current: number
  temperature: number
  amount: number
  luminosity: number
}

const BASE_KEYS: (keyof Dimension)[] = [
  'mass',
  'length',
  'time',
  'current',
  'temperature',
  'amount',
  'luminosity',
]

export function dimension(partial: Partial<Dimension> = {}): Dimension {
  return {
    mass: partial.mass ?? 0,
    length: partial.length ?? 0,
    time: partial.time ?? 0,
    current: partial.current ?? 0,
    temperature: partial.temperature ?? 0,
    amount: partial.amount ?? 0,
    luminosity: partial.luminosity ?? 0,
  }
}

export const DIMENSIONLESS = dimension()

function scale(value: Dimension, factor: number): Dimension {
  const result = dimension()
  for (const key of BASE_KEYS) result[key] = value[key] * factor
  return result
}

export function multiplyDimensions(a: Dimension, b: Dimension): Dimension {
  const result = dimension()
  for (const key of BASE_KEYS) result[key] = a[key] + b[key]
  return result
}

export function divideDimensions(a: Dimension, b: Dimension): Dimension {
  const result = dimension()
  for (const key of BASE_KEYS) result[key] = a[key] - b[key]
  return result
}

export function powerDimension(value: Dimension, power: number): Dimension {
  return scale(value, power)
}

export function sameDimension(a: Dimension, b: Dimension): boolean {
  const epsilon = 1e-9
  return BASE_KEYS.every((key) => Math.abs(a[key] - b[key]) < epsilon)
}

export function dimensionText(value: Dimension): string {
  const positive: string[] = []
  const negative: string[] = []

  const names: Record<keyof Dimension, string> = {
    mass: 'кг',
    length: 'м',
    time: 'с',
    current: 'А',
    temperature: 'К',
    amount: 'моль',
    luminosity: 'кд',
  }

  for (const key of BASE_KEYS) {
    const power = value[key]
    if (Math.abs(power) < 1e-9) continue

    const label = power === 1 ? names[key] : `${names[key]}${superscript(power)}`
    if (power > 0) positive.push(label)
    else negative.push(power === -1 ? names[key] : `${names[key]}${superscript(-power)}`)
  }

  if (positive.length === 0 && negative.length === 0) return 'безразмерная'

  const top = positive.join('·') || '1'
  if (negative.length === 0) return top

  const bottom = negative.join('·')
  return negative.length > 1 ? `${top}/(${bottom})` : `${top}/${bottom}`
}

function superscript(power: number): string {
  const digits: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
    '-': '⁻',
  }

  return String(power)
    .split('')
    .map((symbol) => digits[symbol] ?? symbol)
    .join('')
}

export interface Unit {
  
  symbol: string
  dimension: Dimension
  factor: number
  offset?: number
  
  quantity: string
}

function unit(symbol: string, quantity: string, dimensionValue: Dimension, factor = 1, offset?: number): Unit {
  return { symbol, quantity, dimension: dimensionValue, factor, offset }
}

const M = { mass: 1 }
const L = { length: 1 }
const T = { time: 1 }
const I = { current: 1 }
const K = { temperature: 1 }

export const UNITS = {
  kilogram: unit('кг', 'Масса', dimension(M)),
  gram: unit('г', 'Масса', dimension(M), 0.001),
  metre: unit('м', 'Длина', dimension(L)),
  millimetre: unit('мм', 'Длина', dimension(L), 0.001),
  centimetre: unit('см', 'Длина', dimension(L), 0.01),
  second: unit('с', 'Время', dimension(T)),
  minute: unit('мин', 'Время', dimension(T), 60),
  ampere: unit('А', 'Сила тока', dimension(I)),
  coulomb: unit('Кл', 'Электрический заряд', dimension({ current: 1, time: 1 })),
  milliampere: unit('мА', 'Сила тока', dimension(I), 0.001),
  kelvin: unit('К', 'Температура', dimension(K)),
  celsius: unit('°C', 'Температура', dimension(K), 1, 273.15),

  volt: unit('В', 'Напряжение', dimension({ mass: 1, length: 2, time: -3, current: -1 })),
  ohm: unit('Ом', 'Сопротивление', dimension({ mass: 1, length: 2, time: -3, current: -2 })),
  watt: unit('Вт', 'Мощность', dimension({ mass: 1, length: 2, time: -3 })),
  newton: unit('Н', 'Сила', dimension({ mass: 1, length: 1, time: -2 })),
  joule: unit('Дж', 'Энергия', dimension({ mass: 1, length: 2, time: -2 })),
  henry: unit('Гн', 'Индуктивность', dimension({ mass: 1, length: 2, time: -2, current: -2 })),
  millihenry: unit('мГн', 'Индуктивность', dimension({ mass: 1, length: 2, time: -2, current: -2 }), 1e-3),
  farad: unit('Ф', 'Электроёмкость', dimension({ mass: -1, length: -2, time: 4, current: 2 })),
  hertz: unit('Гц', 'Частота', dimension({ time: -1 })),
  metrePerSecond: unit('м/с', 'Скорость', dimension({ length: 1, time: -1 })),
  metrePerSecondSquared: unit('м/с²', 'Ускорение', dimension({ length: 1, time: -2 })),
  squareMetre: unit('м²', 'Площадь', dimension({ length: 2 })),
  cubicMetre: unit('м³', 'Объём', dimension({ length: 3 })),
  pascal: unit('Па', 'Давление', dimension({ mass: 1, length: -1, time: -2 })),
  newtonPerMetre: unit('Н/м', 'Жёсткость', dimension({ mass: 1, time: -2 })),
  joulePerKilogramKelvin: unit('Дж/(кг·К)', 'Удельная теплоёмкость', dimension({ length: 2, time: -2, temperature: -1 })),
  degree: unit('°', 'Угол', DIMENSIONLESS),
  nanometre: unit('нм', 'Длина волны', dimension(L), 1e-9),
  microfarad: unit('мкФ', 'Электроёмкость', dimension({ mass: -1, length: -2, time: 4, current: 2 }), 1e-6),
} satisfies Record<string, Unit>

export interface Quantity {
  value: number
  unit: Unit
}

export function quantity(value: number, unitValue: Unit): Quantity {
  return { value, unit: unitValue }
}

export function toBase(input: Quantity): number {
  return input.value * input.unit.factor + (input.unit.offset ?? 0)
}

export function fromBase(base: number, unitValue: Unit): Quantity {
  return { value: (base - (unitValue.offset ?? 0)) / unitValue.factor, unit: unitValue }
}

export function compatible(a: Unit, b: Unit): boolean {
  return sameDimension(a.dimension, b.dimension)
}

export function multiply(a: Quantity, b: Quantity): { base: number; dimension: Dimension } {
  return { base: toBase(a) * toBase(b), dimension: multiplyDimensions(a.unit.dimension, b.unit.dimension) }
}

export function divide(a: Quantity, b: Quantity): { base: number; dimension: Dimension } {
  return { base: toBase(a) / toBase(b), dimension: divideDimensions(a.unit.dimension, b.unit.dimension) }
}

export function unitForDimension(target: Dimension): Unit | undefined {
  const candidates = Object.values(UNITS) as Unit[]
  return candidates.find((item) => sameDimension(item.dimension, target) && item.factor === 1 && !item.offset)
}

export type QuantityGroup =
  | 'electrical'
  | 'geometric'
  | 'mechanical'
  | 'time'
  | 'thermal'
  | 'optical'
  | 'other'

export function formatQuantity(input: Quantity, precision = 2): string {
  const rounded = Number(input.value.toFixed(precision))
  return `${rounded.toLocaleString('ru-RU')} ${input.unit.symbol}`
}

const FORCE = dimension({ mass: 1, length: 1, time: -2 })
const PRESSURE = dimension({ mass: 1, length: -1, time: -2 })
const STIFFNESS = dimension({ mass: 1, time: -2 })
const ENERGY = dimension({ mass: 1, length: 2, time: -2 })
const POWER = dimension({ mass: 1, length: 2, time: -3 })
const SPEED = dimension({ length: 1, time: -1 })
const ACCELERATION = dimension({ length: 1, time: -2 })
const AREA = dimension({ length: 2 })
const VOLUME = dimension({ length: 3 })
const TEMPERATURE_CAPACITY = dimension({ length: 2, time: -2, temperature: -1 })

export const GROUP_COLORS: Record<QuantityGroup, string> = {
  electrical: '#2c6bff',
  geometric: '#c98a00',
  mechanical: '#e06a1b',
  time: '#8a5cf6',
  thermal: '#d5372c',
  optical: '#0f9fa8',
  other: '#7a8290',
}

export function groupForDimension(value: Dimension): QuantityGroup {
  if (sameDimension(value, UNITS.volt.dimension)) return 'electrical'
  if (sameDimension(value, UNITS.ohm.dimension)) return 'electrical'
  if (sameDimension(value, UNITS.watt.dimension)) return 'electrical'
  if (sameDimension(value, UNITS.ampere.dimension)) return 'electrical'
  if (sameDimension(value, UNITS.coulomb.dimension)) return 'electrical'
  if (sameDimension(value, UNITS.henry.dimension)) return 'electrical'
  if (sameDimension(value, UNITS.millihenry.dimension)) return 'electrical'
  if (sameDimension(value, UNITS.farad.dimension)) return 'electrical'
  if (sameDimension(value, ENERGY)) return 'electrical'
  if (sameDimension(value, POWER)) return 'electrical'
  if (sameDimension(value, TEMPERATURE_CAPACITY)) return 'thermal'
  if (sameDimension(value, UNITS.kelvin.dimension)) return 'thermal'
  if (sameDimension(value, FORCE)) return 'mechanical'
  if (sameDimension(value, PRESSURE)) return 'mechanical'
  if (sameDimension(value, STIFFNESS)) return 'mechanical'
  if (sameDimension(value, ACCELERATION)) return 'mechanical'
  if (sameDimension(value, SPEED)) return 'optical'
  if (sameDimension(value, UNITS.metre.dimension)) return 'geometric'
  if (sameDimension(value, UNITS.nanometre.dimension)) return 'geometric'
  if (sameDimension(value, AREA)) return 'geometric'
  if (sameDimension(value, VOLUME)) return 'geometric'
  if (sameDimension(value, UNITS.second.dimension)) return 'time'
  if (sameDimension(value, UNITS.hertz.dimension)) return 'time'
  return 'other'
}

export function sameGroup(a: Unit, b: Unit): boolean {
  return groupForDimension(a.dimension) === groupForDimension(b.dimension)
}

export function isModifierUnit(value: Unit): boolean {
  return groupForDimension(value.dimension) === 'time'
    || groupForDimension(value.dimension) === 'thermal'
    || sameDimension(value.dimension, FORCE)
}
