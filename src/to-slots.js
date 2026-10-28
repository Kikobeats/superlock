'use strict'

// Last integer `--` reduces by exactly one. Above this the count skips or never reaches 0.
const MAX_SLOTS = 2 ** 53
const MAX_SLOTS_BIGINT = BigInt(MAX_SLOTS)
const MESSAGE =
  '`slots` needs to be a positive integer up to 2 ** 53, or Infinity.'

// Number('1e309') and Number(2n ** 1024n) are Infinity too. Only an actual
// Infinity, or the text Number accepts as that token, means no limit.
const INFINITY_TEXT = /^\s*[+-]?Infinity\s*$/

// ToPrimitive with a number hint: @@toPrimitive, else valueOf, then toString.
// A bigint has to survive that step or Number would round it or overflow to Infinity.
const primitiveOf = value => {
  if (typeof value !== 'object' || value === null) return value
  const exotic = value[Symbol.toPrimitive]
  if (exotic != null) {
    if (typeof exotic !== 'function') throw new TypeError(MESSAGE)
    const inner = exotic.call(value, 'number')
    if (typeof inner === 'object') throw new TypeError(MESSAGE)
    return inner
  }
  if (typeof value.valueOf === 'function') {
    const inner = value.valueOf()
    // null is a primitive. typeof null is 'object', and it must beat toString.
    if (typeof inner !== 'object' || inner === null) return inner
  }
  if (typeof value.toString === 'function') {
    const inner = value.toString()
    if (typeof inner !== 'object') return inner
  }
  throw new TypeError(MESSAGE)
}

module.exports = value => {
  const primitive = primitiveOf(value)

  if (typeof primitive === 'bigint') {
    if (primitive < 1n || primitive > MAX_SLOTS_BIGINT) {
      throw new TypeError(MESSAGE)
    }
    return Number(primitive)
  }

  if (typeof primitive === 'symbol') throw new TypeError(MESSAGE)

  const slots = Number(primitive)
  // Infinity's text is "Infinity", so the same token check covers the number.
  if (slots === Infinity && INFINITY_TEXT.test(primitive)) return Infinity
  if (Number.isInteger(slots) && slots > 0 && slots <= MAX_SLOTS) return slots
  throw new TypeError(MESSAGE)
}
