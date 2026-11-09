with open(r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\pages\OverviewPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read().replace('\r\n', '\n')

# 1. Add import for HistoricalMetricsChart
target_imp = "import { CpuHistoryChart } from '../components/CpuHistoryChart';"
replacement_imp = "import { CpuHistoryChart } from '../components/CpuHistoryChart';\nimport { HistoricalMetricsChart } from '../components/HistoricalMetricsChart';"
content = content.replace(target_imp, replacement_imp, 1)

# 2. Insert HistoricalMetricsChart after CpuHistoryChart
target_chart = """      {/* 3. Hardware Cores Matrix & Realtime Wave Oscilloscope */}
      <CpuHistoryChart
        cpuPerCore={host?.cpuPerCore}
        cpuTotal={host?.cpu}
        cpuModel={host?.os}
      />"""

replacement_chart = """      {/* 3. Hardware Cores Matrix & Realtime Wave Oscilloscope */}
      <CpuHistoryChart
        cpuPerCore={host?.cpuPerCore}
        cpuTotal={host?.cpu}
        cpuModel={host?.os}
      />

      {/* 3.1 Historical Telemetry Persistence (24h & 7d - Story 5) */}
      <HistoricalMetricsChart />"""

content = content.replace(target_chart, replacement_chart, 1)

# 3. Enhance session row rendering for state & idle time
target_row = """                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-pill)', background: 'var(--glass-inset)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                          {s.user.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.user}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.role}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'Active' ? 'badge--success' : 'badge--warning'}`}>
                        {s.status === 'Active' ? 'نشطة' : 'خاملة'}
                      </span>
                    </td>
                    <td>
                      {s.idle !== null && s.idle !== undefined ? `${s.idle} د` : 'متصل'}
                    </td>"""

replacement_row = """                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-pill)', background: 'var(--glass-inset)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                          {s.user.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 600 }}>{s.user}</span>
                            {(s as any).is_current && (
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--accent)', color: '#000', fontWeight: 700 }}>
                                أنت هنا
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.station || s.role || 'RDP'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'Active' ? 'badge--success' : (s as any).state === 'Disconnected' ? 'badge--danger' : 'badge--warning'}`}>
                        {s.status === 'Active' ? 'نشطة' : (s as any).state === 'Disconnected' ? 'منفصلة (Disc)' : 'خاملة'}
                      </span>
                    </td>
                    <td>
                      {(s as any).idle_formatted || (s as any).idle_time || (s.idle !== null && s.idle !== undefined ? `${s.idle} د` : 'نشط الآن')}
                    </td>"""

content = content.replace(target_row, replacement_row, 1)

with open(r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\pages\OverviewPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('OverviewPage.tsx updated successfully')
