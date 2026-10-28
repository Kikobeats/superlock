'use strict'

module.exports = value => {
  const slots = Number(value)
  if (slots === Infinity || (Number.isInteger(slots) && slots > 0)) return slots
  throw new TypeError('`slots` needs to be a positive integer or Infinity.')
}
