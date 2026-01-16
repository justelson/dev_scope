import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'

interface ReadinessChartProps {
    score: number
}

export default function ReadinessChart({ score }: ReadinessChartProps) {
    const data = [
        {
            name: 'Score',
            value: score,
            fill: score >= 80 ? '#2dac7d' : score >= 50 ? '#eab308' : '#ef4444' // Green, Yellow, Red
        }
    ]

    return (
        <div className="w-full h-[200px] relative" style={{ minWidth: 200, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                <RadialBarChart
                    innerRadius="80%"
                    outerRadius="100%"
                    barSize={10}
                    data={data}
                    startAngle={90}
                    endAngle={-270}
                >
                    <PolarAngleAxis
                        type="number"
                        domain={[0, 100]}
                        angleAxisId={0}
                        tick={false}
                    />
                    <RadialBar
                        background
                        dataKey="value"
                        cornerRadius={10}
                    />
                </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-bold text-sparkle-text">{Math.round(score)}%</span>
                <span className="text-sm text-sparkle-text-secondary mt-1">Readiness</span>
            </div>
        </div>
    )
}
