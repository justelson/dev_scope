export const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-lg">
        {payload.map((pld, index) => (
          <div key={index} className="flex items-center gap-2">
            {/* <span style={{ color: pld.fill }}>●</span> */}
            <span className="text-white">{`CPU Usage: ${pld.value.toFixed(1)}%`}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}
