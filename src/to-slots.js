'use strict'

// Last integer `--` reduces by exactly one. Above this the count skips or never reaches 0.
const MAX_SLOTS = 2 ** 53

module.exports = value => {
  const slots = Number(value)
  if (
    slots === Infinity ||
    (Number.isInteger(slots) && slots > 0 && slots <= MAX_SLOTS)
  ) {
    return slots
  }
  throw new TypeError(
    '`slots` needs to be a positive integer up to 2 ** 53, or Infinity.'
  )
}
