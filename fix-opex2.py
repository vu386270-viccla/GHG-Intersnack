with open('src/app/opex-report/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# We know the bug looks like: '{lang === \'vi\' ? \'...\' : \'...\'}' inside single quotes!
# Wait, no. Next line 1609:
# `<span>⚡ {lang === 'vi' ? 'Solar từ 2027:' : 'Solar from 2027:'} <strong style={{ color: '#166534' }}>−{ptSolarSaving(2027).toLocaleString()} {lang === 'vi' ? 'tCO₂e/{lang === 'vi' ? 'năm' : 'year'}' : 'tCO₂e/yr'}</strong></span>`

# Ah! Look closely:
# `{lang === 'vi' ? 'tCO₂e/{lang === 'vi' ? 'năm' : 'year'}' : 'tCO₂e/yr'}`
# It is a syntax error because inside the single quotes of `tCO₂e/{lang === 'vi' ? 'năm' : 'year'}`, the single quotes around `vi` close the first string!

# Let's replace any instance of `{lang === 'vi' ? 'năm' : 'year'}` within a string with `năm/year` or something.
# Better yet, I can just replace `tCO₂e/{lang === 'vi' ? 'năm' : 'year'}` with `"tCO₂e/năm"`, but the single quotes around it might be tricky.

text = text.replace("'tCO₂e/{lang === \\'vi\\' ? \\'năm\\' : \\'year\\'}'", "'tCO₂e/năm'")
text = text.replace("'tCO₂e/{lang === 'vi' ? 'năm' : 'year'}'", "'tCO₂e/năm'")

# Also: `{lang === 'vi' ? 'năm' : 'year'} 2025`
text = text.replace("{lang === 'vi' ? 'năm' : 'year'} 2025", "năm 2025")

with open('src/app/opex-report/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
