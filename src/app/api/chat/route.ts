import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function getSupabaseServer() {
    return supabase;
}

const STATIC_CONTEXT = `You are an expert GHG (Greenhouse Gas) emissions analyst assistant for Intersnack Group's factory dashboard. You have access to the full live dataset below.

Factories:
- Long An (code NM, Vietnam)
- Phan Thiet (code DC, Vietnam)
- Tay Ninh (code DA, Vietnam)
- Tuticorin (code TN, India)

Definitions:
- All emission values in tCO2e (tonnes CO2 equivalent)
- Scope 1: Direct combustion â€” wood logs (firewood boiler), diesel, LPG
- Scope 2: Grid electricity using MIS activity data and current 4-decimal country/year grid EF (Vietnam 2023-2026 = 0.6592; India 2025-2026 = 0.7100 kgCO2e/kWh)
- Scope 3: Cat.1 purchased cashew goods (FLAG), Cat.3 fuel upstream (WTT), Cat.4 upstream transport
- SBTi commitment ID: 40003759 â€” target: -50% Scope 1+2 by 2032 vs 2021 baseline, -30% Scope 3 by 2032
- CO2 Intensity = tCO2e / tonne RCN (raw cashew nut processed)
- RCN = Raw Cashew Nut (input), CK = Cashew Kernel (output)
- FLAG emissions = Supply chain (Scope 3 Cat.1 cashew farming)
- Non-FLAG emissions = Operations (Scope 1 + Scope 2 + Scope 3 Cat.3 + Cat.4)

LANGUAGE RULE: Respond in ONLY the same language as the user. Vietnamese question = Vietnamese answer only. English question = English answer only. Never mix languages.`;

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function pct(a: number, b: number) {
    if (b === 0) return 'N/A';
    return `${((a / b) * 100).toFixed(1)}%`;
}

function yoyStr(curr: number, prev: number) {
    if (prev === 0) return 'N/A';
    const d = (((curr - prev) / prev) * 100).toFixed(1);
    return `${Number(d) > 0 ? '+' : ''}${d}%`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginatedFetch(
    supabase: any,
    table: string,
    selectFields: string,
    filters: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
    let all: Record<string, unknown>[] = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
        let q = supabase.from(table).select(selectFields).range(offset, offset + PAGE - 1);
        for (const [k, v] of Object.entries(filters)) {
            if (Array.isArray(v)) q = q.in(k, v);
            else q = q.eq(k, v as string | number);
        }
        const { data, error } = await q;
        if (error || !data || data.length === 0) break;
        all = all.concat(data as Record<string, unknown>[]);
        if (data.length < PAGE) break;
        offset += PAGE;
    }
    return all;
}

// â”€â”€ Main snapshot builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchEmissionSnapshot(): Promise<string> {
    try {
        const supabase = getSupabaseServer();
        const currentYear = new Date().getFullYear();
        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const HIST_YEARS = [2021, 2022, 2023, 2024, 2025, currentYear];

        // â”€â”€ 1. Factories â”€â”€
        const { data: factories } = await supabase.from('factories').select('id,name,country');
        const factoryMap: Record<string, string> = {};
        for (const f of factories || []) factoryMap[f.id] = f.name;

        // â”€â”€ 2. All emissions (current year) with pagination â”€â”€
        const currEmissions = await paginatedFetch(supabase, 'emissions_data',
            'factory_id,scope,category,month,emissions_tco2e,cost_usd,activity_data',
            { year: currentYear });

        // â”€â”€ 3. Historical emissions (2021 - prev year) â”€â”€
        const histEmissions = await paginatedFetch(supabase, 'emissions_data',
            'factory_id,year,scope,emissions_tco2e,cost_usd',
            { year: HIST_YEARS.filter(y => y !== currentYear) });

        // â”€â”€ 4. Production data (current year) â”€â”€
        const prodData = await paginatedFetch(supabase, 'production_data',
            'factory_id,month,category,quantity',
            { year: currentYear });

        // â”€â”€ 5. Historical production â”€â”€
        const histProd = await paginatedFetch(supabase, 'production_data',
            'factory_id,year,category,quantity',
            { year: HIST_YEARS.filter(y => y !== currentYear) });

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // BUILD CONTEXT STRING
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        const maxMonths = new Date().getMonth(); // 0-11 (months elapsed)
        const monthLabel = maxMonths > 0
            ? `Jan-${MONTH_NAMES[maxMonths - 1]} ${currentYear} (YTD ${maxMonths}M)`
            : `${currentYear} (YTD)`;

        let ctx = `\n\n${'='.repeat(60)}\nLIVE DASHBOARD DATA â€” ${monthLabel}\n${'='.repeat(60)}\n`;

        // â”€â”€ Section A: Current year per-factory summary â”€â”€
        const byFac: Record<string, { s1: number; s2: number; s3: number; cost: number }> = {};
        for (const e of currEmissions) {
            const id = e.factory_id as string;
            if (!byFac[id]) byFac[id] = { s1: 0, s2: 0, s3: 0, cost: 0 };
            const v = Number(e.emissions_tco2e) || 0;
            const c = Number(e.cost_usd) || 0;
            if (e.scope === 'scope_1') { byFac[id].s1 += v; byFac[id].cost += c; }
            else if (e.scope === 'scope_2') { byFac[id].s2 += v; byFac[id].cost += c; }
            else if (e.scope === 'scope_3') { byFac[id].s3 += v; byFac[id].cost += c; }
        }

        const facRows = Object.entries(byFac)
            .map(([id, d]) => ({
                name: factoryMap[id] || id, id,
                s1: Math.round(d.s1), s2: Math.round(d.s2), s3: Math.round(d.s3),
                total: Math.round(d.s1 + d.s2 + d.s3), cost: Math.round(d.cost),
            }))
            .sort((a, b) => b.total - a.total);

        const grandTotal = facRows.reduce((s, r) => s + r.total, 0);
        const grandCost = facRows.reduce((s, r) => s + r.cost, 0);

        ctx += `\n[A] FACTORY EMISSIONS RANKING (${monthLabel})\n`;
        ctx += `Grand Total: ${grandTotal.toLocaleString()} tCO2e | Cost: $${grandCost.toLocaleString()} USD\n\n`;
        facRows.forEach((r, i) => {
            ctx += `${i + 1}. ${r.name}: ${r.total.toLocaleString()} tCO2e`;
            ctx += ` | S1: ${r.s1.toLocaleString()} (${pct(r.s1, r.total)})`;
            ctx += ` | S2: ${r.s2.toLocaleString()} (${pct(r.s2, r.total)})`;
            ctx += ` | S3: ${r.s3.toLocaleString()} (${pct(r.s3, r.total)})`;
            ctx += ` | Cost: $${r.cost.toLocaleString()} USD\n`;
        });

        // â”€â”€ Section B: Scope 1 breakdown by fuel type (current year, all factories) â”€â”€
        const s1ByCat: Record<string, number> = {};
        const s1ByCatByFac: Record<string, Record<string, number>> = {};
        for (const e of currEmissions) {
            if (e.scope !== 'scope_1') continue;
            const cat = e.category as string;
            const id = e.factory_id as string;
            const v = Number(e.emissions_tco2e) || 0;
            s1ByCat[cat] = (s1ByCat[cat] || 0) + v;
            if (!s1ByCatByFac[id]) s1ByCatByFac[id] = {};
            s1ByCatByFac[id][cat] = (s1ByCatByFac[id][cat] || 0) + v;
        }
        const totalS1 = Object.values(s1ByCat).reduce((a, b) => a + b, 0);
        ctx += `\n[B] SCOPE 1 BREAKDOWN BY FUEL (all factories)\n`;
        Object.entries(s1ByCat).sort((a, b) => b[1] - a[1]).forEach(([cat, val]) => {
            ctx += `  ${cat}: ${Math.round(val).toLocaleString()} tCO2e (${pct(val, totalS1)})\n`;
        });

        // Per factory Scope 1 fuel breakdown
        ctx += `  By factory:\n`;
        facRows.forEach(r => {
            const cats = s1ByCatByFac[r.id] || {};
            const parts = Object.entries(cats).map(([k, v]) => `${k}: ${Math.round(v)}`).join(', ');
            if (parts) ctx += `    ${r.name}: ${parts}\n`;
        });

        // â”€â”€ Section C: Monthly trend (current year) â”€â”€
        const monthlyTotal: number[] = Array(12).fill(0);
        const monthlyS1: number[] = Array(12).fill(0);
        const monthlyS2: number[] = Array(12).fill(0);
        for (const e of currEmissions) {
            const m = (Number(e.month) || 1) - 1;
            if (m < 0 || m > 11) continue;
            const v = Number(e.emissions_tco2e) || 0;
            monthlyTotal[m] += v;
            if (e.scope === 'scope_1') monthlyS1[m] += v;
            else if (e.scope === 'scope_2') monthlyS2[m] += v;
        }

        ctx += `\n[C] MONTHLY TREND ${currentYear} (S1+S2+S3, tCO2e)\n`;
        for (let m = 0; m < maxMonths; m++) {
            ctx += `  ${MONTH_NAMES[m]}: ${Math.round(monthlyTotal[m]).toLocaleString()}`;
            ctx += ` (S1: ${Math.round(monthlyS1[m]).toLocaleString()}, S2: ${Math.round(monthlyS2[m]).toLocaleString()})\n`;
        }

        // â”€â”€ Section D: Production & Intensity (current year) â”€â”€
        const rcnByFac: Record<string, number> = {};
        const ckByFac: Record<string, number> = {};
        for (const p of prodData) {
            const id = p.factory_id as string;
            const q = Number(p.quantity) || 0;
            if (p.category === 'rcn_input') rcnByFac[id] = (rcnByFac[id] || 0) + q;
            else if (p.category === 'ck_output') ckByFac[id] = (ckByFac[id] || 0) + q;
        }
        const totalRCN = Object.values(rcnByFac).reduce((a, b) => a + b, 0);
        const totalCK = Object.values(ckByFac).reduce((a, b) => a + b, 0);
        const overallIntensity = totalRCN > 0 ? (grandTotal / totalRCN) : 0;

        ctx += `\n[D] PRODUCTION & CO2 INTENSITY (${monthLabel})\n`;
        ctx += `Total RCN: ${Math.round(totalRCN).toLocaleString()} tonnes | CK: ${Math.round(totalCK).toLocaleString()} tonnes\n`;
        ctx += `Overall Intensity: ${overallIntensity.toFixed(4)} tCO2e/t-RCN\n`;
        ctx += `Per factory intensity:\n`;
        facRows.forEach(r => {
            const rcn = rcnByFac[r.id] || 0;
            const ck = ckByFac[r.id] || 0;
            const int = rcn > 0 ? (r.total / rcn).toFixed(4) : 'N/A';
            ctx += `  ${r.name}: ${int} tCO2e/t-RCN | RCN: ${Math.round(rcn).toLocaleString()}t | CK: ${Math.round(ck).toLocaleString()}t\n`;
        });

        // â”€â”€ Section E: Historical annual summary (2021-prev year) â”€â”€
        const histByYear: Record<number, { s1: number; s2: number; s3: number; cost: number }> = {};
        for (const e of histEmissions) {
            const y = Number(e.year);
            if (!histByYear[y]) histByYear[y] = { s1: 0, s2: 0, s3: 0, cost: 0 };
            const v = Number(e.emissions_tco2e) || 0;
            const c = Number(e.cost_usd) || 0;
            if (e.scope === 'scope_1') { histByYear[y].s1 += v; histByYear[y].cost += c; }
            else if (e.scope === 'scope_2') { histByYear[y].s2 += v; histByYear[y].cost += c; }
            else if (e.scope === 'scope_3') histByYear[y].s3 += v;
        }

        // Historical production for intensity
        const histRCN: Record<number, number> = {};
        for (const p of histProd) {
            const y = Number(p.year);
            if (p.category === 'rcn_input') histRCN[y] = (histRCN[y] || 0) + (Number(p.quantity) || 0);
        }

        ctx += `\n[E] HISTORICAL ANNUAL SUMMARY\n`;
        ctx += `Year  | S1+S2+S3 tCO2e | Cost USD    | Intensity tCO2e/t-RCN | YoY\n`;
        const sortedYears = Object.keys(histByYear).map(Number).sort();
        let prevTotal = 0;
        for (const y of sortedYears) {
            const d = histByYear[y];
            const tot = Math.round(d.s1 + d.s2 + d.s3);
            const rcn = histRCN[y] || 0;
            const int = rcn > 0 ? (tot / rcn).toFixed(4) : 'N/A';
            const yoy = prevTotal > 0 ? yoyStr(tot, prevTotal) : 'baseline';
            ctx += `${y}  | ${tot.toLocaleString().padEnd(14)} | $${Math.round(d.cost).toLocaleString().padEnd(10)} | ${String(int).padEnd(21)} | ${yoy}\n`;
            prevTotal = tot;
        }
        // Add current YTD row
        ctx += `${currentYear} (YTD) | ${grandTotal.toLocaleString().padEnd(14)} | $${grandCost.toLocaleString().padEnd(10)} | ${overallIntensity.toFixed(4).padEnd(21)} | ${yoyStr(grandTotal, prevTotal)} (vs prev full year)\n`;

        // â”€â”€ Section F: SBTi Progress â”€â”€
        const base2021 = histByYear[2021];
        if (base2021) {
            const base12 = base2021.s1 + base2021.s2;
            const curr12 = facRows.reduce((s, r) => s + r.s1 + r.s2, 0);
            const target12 = base12 * 0.50;
            const reduced12 = base12 > 0 ? (((base12 - curr12) / base12) * 100).toFixed(1) : 'N/A';
            ctx += `\n[F] SBTi PROGRESS (vs 2021 baseline)\n`;
            ctx += `Scope 1+2 baseline 2021: ${Math.round(base12).toLocaleString()} tCO2e\n`;
            ctx += `Scope 1+2 current (YTD): ${Math.round(curr12).toLocaleString()} tCO2e\n`;
            ctx += `Scope 1+2 target 2032 (-50%): ${Math.round(target12).toLocaleString()} tCO2e\n`;
            ctx += `Reduction achieved so far: ${reduced12}% (target: 50%)\n`;
        }

        ctx += `\n${'='.repeat(60)}\n`;
        return ctx;

    } catch (err) {
        console.error('[chat] snapshot fetch error:', err);
        return '\n[Live data: temporarily unavailable]';
    }
}

// â”€â”€ API Route â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
        }

        const liveSnapshot = await fetchEmissionSnapshot();
        const fullContext = STATIC_CONTEXT + liveSnapshot;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // Gemini 2.5 Flash supports native system_instruction
        const contents = messages.map((m: { role: string; content: string }) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: fullContext }] },
                contents,
                generationConfig: {
                    maxOutputTokens: 1500,
                    temperature: 0.5,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Gemini API error:', error);
            return NextResponse.json({ error: 'AI service error', detail: error }, { status: response.status });
        }

        const data = await response.json();

        // Gemma 4 thinking model â€” filter out thought parts
        const parts: { text?: string; thought?: boolean }[] =
            data.candidates?.[0]?.content?.parts ?? [];

        const answerText = parts
            .filter(p => !p.thought)
            .map(p => p.text ?? '')
            .join('')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .trim();

        return NextResponse.json({ text: answerText });
    } catch (err) {
        console.error('Chat route error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

