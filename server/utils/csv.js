function escapeCsv(value) {
  const raw = value == null ? '' : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

function toCsv(rows, headers) {
  const lines = [headers.map((header) => escapeCsv(header.label || header.key)).join(',')]

  rows.forEach((row) => {
    const values = headers.map((header) => escapeCsv(typeof header.value === 'function' ? header.value(row) : row?.[header.key]))
    lines.push(values.join(','))
  })

  return `${lines.join('\n')}\n`
}

module.exports = {
  escapeCsv,
  toCsv
}