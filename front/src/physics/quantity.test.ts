import { describe, expect, it } from 'vitest'
import {
  UNITS,
  compatible,
  dimension,
  dimensionText,
  divideDimensions,
  fromBase,
  multiplyDimensions,
  powerDimension,
  sameDimension,
  toBase,
} from './quantity'

describe('размерности', () => {
  it('произведение и деление складывают и вычитают показатели', () => {
    const speed = divideDimensions(UNITS.metre.dimension, UNITS.second.dimension)
    expect(sameDimension(speed, UNITS.metrePerSecond.dimension)).toBe(true)

    const back = multiplyDimensions(speed, UNITS.second.dimension)
    expect(sameDimension(back, UNITS.metre.dimension)).toBe(true)
  })

  it('возведение в степень умножает показатели', () => {
    const area = powerDimension(UNITS.metre.dimension, 2)
    expect(sameDimension(area, UNITS.squareMetre.dimension)).toBe(true)
  })

  it('закон Ома сходится по размерностям: В / А = Ом', () => {
    const ohm = divideDimensions(UNITS.volt.dimension, UNITS.ampere.dimension)
    expect(sameDimension(ohm, UNITS.ohm.dimension)).toBe(true)
  })

  it('мощность сходится: В · А = Вт', () => {
    const watt = multiplyDimensions(UNITS.volt.dimension, UNITS.ampere.dimension)
    expect(sameDimension(watt, UNITS.watt.dimension)).toBe(true)
  })

  it('сила сходится: кг · м/с² = Н', () => {
    const force = multiplyDimensions(
      UNITS.kilogram.dimension,
      divideDimensions(UNITS.metre.dimension, powerDimension(UNITS.second.dimension, 2)),
    )
    expect(sameDimension(force, UNITS.newton.dimension)).toBe(true)
  })

  it('пишет размерность по-русски', () => {
    expect(dimensionText(UNITS.volt.dimension)).toBe('кг·м²/(с³·А)')
    expect(dimensionText(dimension())).toBe('безразмерная')
  })
})

describe('единицы', () => {
  it('переводит кратные единицы в СИ', () => {
    expect(toBase({ value: 1500, unit: UNITS.milliampere })).toBeCloseTo(1.5, 9)
    expect(toBase({ value: 5, unit: UNITS.centimetre })).toBeCloseTo(0.05, 9)
  })

  it('учитывает сдвиг начала отсчёта у градусов Цельсия', () => {
    expect(toBase({ value: 0, unit: UNITS.celsius })).toBeCloseTo(273.15, 9)

    const back = fromBase(293.15, UNITS.celsius)
    expect(back.value).toBeCloseTo(20, 9)
  })

  it('считает совместимыми величины одной размерности', () => {
    expect(compatible(UNITS.volt, UNITS.volt)).toBe(true)
    expect(compatible(UNITS.milliampere, UNITS.ampere)).toBe(true)
    expect(compatible(UNITS.millimetre, UNITS.metre)).toBe(true)
  })

  it('считает несовместимыми разные величины', () => {
    expect(compatible(UNITS.ohm, UNITS.volt)).toBe(false)
    expect(compatible(UNITS.newton, UNITS.watt)).toBe(false)
    expect(compatible(UNITS.celsius, UNITS.metre)).toBe(false)
  })

  it('не путает мощность и энергию', () => {
    expect(compatible(UNITS.watt, UNITS.joule)).toBe(false)
  })
})
