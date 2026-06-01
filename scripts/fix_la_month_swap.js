/**
 * Fix: Long An Scope 1 — chuyển dữ liệu từ tháng 5/2026 → tháng 4/2026
 *
 * Bước 1: Xem dữ liệu tháng 5 hiện tại
 * Bước 2: Upsert toàn bộ rows đó vào tháng 4 (giữ nguyên values)
 * Bước 3: Xóa rows tháng 5
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://irbvgsyzidqnzhpetmdk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

const FAC_ID = '7040a994-d776-410b-a429-19c0269e2697'; // Long An
const YEAR = 2026;
const FROM_MONTH = 5; // tháng bị nhập lộn
const TO_MONTH = 4; // tháng đúng

async function main() {
    console.log(`\n══ Fix Long An Scope 1: Tháng ${FROM_MONTH}/${YEAR} → Tháng ${TO_MONTH}/${YEAR} ══\n`);

    // ── Bước 1: Đọc dữ liệu tháng 5 ──────────────────────────────
    const { data: rows, error: fetchErr } = await supabase
        .from('emissions_data')
        .select('*')
        .eq('factory_id', FAC_ID)
        .eq('year', YEAR)
        .eq('month', FROM_MONTH)
        .eq('scope', 'scope_1');

    if (fetchErr) {
        console.error('❌ Fetch error:', fetchErr.message);
        return;
    }

    if (!rows || rows.length === 0) {
        console.log(`⚠️  Không tìm thấy dữ liệu Scope 1 của Long An tháng ${FROM_MONTH}/${YEAR}.`);
        return;
    }

    console.log(`📋 Tìm thấy ${rows.length} rows tháng ${FROM_MONTH}/${YEAR}:\n`);
    rows.forEach(r => {
        console.log(`   ${r.category.padEnd(16)} activity=${r.activity_data} ${r.activity_unit.padEnd(6)} | ${r.emissions_tco2e} tCO2e`);
    });

    // ── Bước 2: Kiểm tra tháng 4 đã có dữ liệu chưa ─────────────
    const { data: existing } = await supabase
        .from('emissions_data')
        .select('category, activity_data, emissions_tco2e')
        .eq('factory_id', FAC_ID)
        .eq('year', YEAR)
        .eq('month', TO_MONTH)
        .eq('scope', 'scope_1');

    if (existing && existing.length > 0) {
        console.log(`\n⚠️  Tháng ${TO_MONTH}/${YEAR} ĐÃ CÓ ${existing.length} rows — sẽ bị OVERWRITE bởi upsert:`);
        existing.forEach(r => {
            console.log(`   ${r.category.padEnd(16)} activity=${r.activity_data} | ${r.emissions_tco2e} tCO2e`);
        });
        console.log('\n   Tiếp tục upsert...');
    }

    // ── Bước 3: Upsert vào tháng 4 ───────────────────────────────
    const newRows = rows.map(({ id, created_at, updated_at, ...rest }) => ({
        ...rest,
        month: TO_MONTH,
    }));

    const { error: upsertErr } = await supabase
        .from('emissions_data')
        .upsert(newRows, { onConflict: 'factory_id,year,month,scope,category' });

    if (upsertErr) {
        console.error('\n❌ Upsert error:', upsertErr.message);
        return;
    }
    console.log(`\n✅ Đã upsert ${newRows.length} rows vào tháng ${TO_MONTH}/${YEAR}`);

    // ── Bước 4: Xóa tháng 5 ──────────────────────────────────────
    const { error: delErr, count } = await supabase
        .from('emissions_data')
        .delete({ count: 'exact' })
        .eq('factory_id', FAC_ID)
        .eq('year', YEAR)
        .eq('month', FROM_MONTH)
        .eq('scope', 'scope_1');

    if (delErr) {
        console.error('\n❌ Delete error:', delErr.message);
        return;
    }
    console.log(`🗑️  Đã xóa ${count ?? rows.length} rows khỏi tháng ${FROM_MONTH}/${YEAR}`);

    // ── Bước 5: Verify ───────────────────────────────────────────
    console.log('\n── Verify sau fix ──────────────────────────────────────');
    const { data: check4 } = await supabase
        .from('emissions_data')
        .select('category, activity_data, activity_unit, emissions_tco2e')
        .eq('factory_id', FAC_ID)
        .eq('year', YEAR)
        .eq('month', TO_MONTH)
        .eq('scope', 'scope_1')
        .order('category');

    console.log(`\nTháng ${TO_MONTH}/${YEAR} (${check4?.length ?? 0} rows):`);
    let total4 = 0;
    check4?.forEach(r => {
        console.log(`   ✅ ${r.category.padEnd(16)} ${r.activity_data} ${r.activity_unit.padEnd(6)} → ${r.emissions_tco2e} tCO2e`);
        total4 += Number(r.emissions_tco2e);
    });
    console.log(`   TOTAL Scope 1 T4: ${total4.toFixed(4)} tCO2e`);

    const { data: check5 } = await supabase
        .from('emissions_data')
        .select('category')
        .eq('factory_id', FAC_ID)
        .eq('year', YEAR)
        .eq('month', FROM_MONTH)
        .eq('scope', 'scope_1');

    console.log(`\nTháng ${FROM_MONTH}/${YEAR}: ${check5?.length ?? 0} rows còn lại (nên = 0)`);

    if ((check5?.length ?? 0) === 0) {
        console.log('\n✅ DONE — Fix thành công!');
    } else {
        console.log('\n⚠️  Vẫn còn rows tháng 5 — kiểm tra lại!');
    }
}

main().catch(console.error);
