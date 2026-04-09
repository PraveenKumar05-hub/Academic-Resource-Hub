export function escapeCsv(value) {
  const raw = value == null ? '' : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

export function toCsv(rows, columns) {
  const lines = [columns.map((column) => escapeCsv(column.label || column.key)).join(',')]

  rows.forEach((row) => {
    const values = columns.map((column) => {
      const value = typeof column.value === 'function' ? column.value(row) : row?.[column.key]
      return escapeCsv(value)
    })
    lines.push(values.join(','))
  })

  return `${lines.join('\n')}\n`
}

export function downloadCsv(filename, rows, columns) {
  const csv = toCsv(rows, columns)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}