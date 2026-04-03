export type RangeMapping = 'linear' | 'square' | 'log'

const LOG_CURVE_AMOUNT = 99
const LOG_DENOMINATOR = Math.log1p(LOG_CURVE_AMOUNT)

export function mapNormToValue(normValue: number, min: number, max: number, mapping: RangeMapping = 'linear') {
  const clamped = Math.max(0, Math.min(1, normValue))
  if (mapping === 'square') {
    return min + (clamped * clamped) * (max - min)
  }
  if (mapping === 'log') {
    const curved = Math.log1p(LOG_CURVE_AMOUNT * clamped) / LOG_DENOMINATOR
    return min + curved * (max - min)
  }
  return min + clamped * (max - min)
}

export function mapValueToNorm(value: number, min: number, max: number, mapping: RangeMapping = 'linear') {
  const range = max - min
  if (range === 0) return 0
  const clamped = Math.max(0, Math.min(1, (value - min) / range))
  if (mapping === 'square') {
    return Math.sqrt(clamped)
  }
  if (mapping === 'log') {
    return Math.expm1(clamped * LOG_DENOMINATOR) / LOG_CURVE_AMOUNT
  }
  return clamped
}
