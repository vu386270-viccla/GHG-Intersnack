// Script tạo user Supabase qua Admin API
// Chạy: node scripts/create_user.js

const SUPABASE_URL = "https://irbvgsyzidqnzhpetmdk.supabase.co";

// ⚠️  Thay SERVICE_ROLE_KEY bên dưới bằng key từ:
//     Supabase Dashboard → Project Settings → API → service_role
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "PASTE_SERVICE_ROLE_KEY_HERE";

const EMAIL = "lam.dinh@vicc.com";
const PASSWORD = "Lam123@";

async function createUser() {
    if (SERVICE_ROLE_KEY === "PASTE_SERVICE_ROLE_KEY_HERE") {
        console.error("❌  Chưa set SERVICE_ROLE_KEY!");
        console.error("   Chạy lại với: $env:SUPABASE_SERVICE_ROLE_KEY='your_key' ; node scripts/create_user.js");
        process.exit(1);
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
            email: EMAIL,
            password: PASSWORD,
            email_confirm: true,   // bỏ qua bước xác nhận email
            user_metadata: { full_name: "Lam Dinh" },
        }),
    });

    const data = await res.json();

    if (!res.ok) {
        console.error("❌  Tạo user thất bại:");
        console.error(JSON.stringify(data, null, 2));
        process.exit(1);
    }

    console.log("✅  Tạo user thành công!");
    console.log(`   Email : ${data.email}`);
    console.log(`   ID    : ${data.id}`);
    console.log(`   Role  : ${data.role}`);
}

createUser().catch(console.error);
