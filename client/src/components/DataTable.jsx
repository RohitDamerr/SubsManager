// DataTable — generic table with columns config and optional empty state.
export function DataTable({ columns, data, empty = 'No data' }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>{empty}</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} style={c.align ? { textAlign: c.align } : {}}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={row._id || i}>
            {columns.map((c) => (
              <td key={c.key} style={c.align ? { textAlign: c.align } : {}}>
                {c.render ? c.render(row) : row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
