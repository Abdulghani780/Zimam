with open(r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\lib\api.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "getHistoricalMetrics: (range: '24h' | '7d' = '24h') =>" in line:
        new_lines.append(line)
        new_lines.append("    request<{ ok: boolean; range: string; points_count: number; history: HistoricalPoint[] }>(`/api/metrics/history?range=${range}`),\n")
    elif "/api/metrics/history?range=" in line:
        continue
    else:
        new_lines.append(line)

with open(r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\lib\api.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('api.ts updated safely without shell interpolation')
