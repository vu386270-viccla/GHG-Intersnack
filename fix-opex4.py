import re

with open('src/app/opex-report/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace all occurrences of things like:
# '{lang === 'vi' ? 'Sự gia tăng' : 'Increase'}' inside a string
import re

# Match '{lang === 'vi' ? 'VIETNAMESE' : 'ENGLISH'}' 
# Specifically, we want to match `{lang === 'vi' ? '...` if it's INSIDE single quotes.
# This happens in code like: 
# `lang === 'vi' ? 'Ghi nhận mức tăng mạnh vào ' : '{lang === 'vi' ? 'Phát hiện' : 'Critical'} '`

# So we are looking for the exact literal string `'{lang === 'vi' ? '` up to `}'`
# We can replace `{lang === 'vi' ? '...' : '...'}` with just the Vietnamese phrase `...`

pattern = r"\{lang === 'vi' \? '([^']*)' : '([^']*)'\}"
# If it's already surrounded by quotes: `'{lang === 'vi' ? 'a' : 'b'}'`, replacing the inner block yields `'a'` which is a valid string literal!

# Let's replace the whole {lang === 'vi' ? 'A' : 'B'} with 'A' if it's enclosed in quotes.
# Actually, the string in TSX is currently:
# `'{lang === 'vi' ? 'Phát hiện sự gia tăng nghiêm trọng vào' : 'Critical escalation identified in'} '`
# This gives parsing error because the first quote `'{lang ` opens a string, then `vi'` closes it!
# Wait! `{lang === 'vi' ` means the single quote after `vi` closes the string started at `'{` !!
# So the inner single quote is what breaks it!

# Pattern: `'{lang === 'vi' \? '([^']+)' : '([^']+)'}`
pattern = re.compile(r"'{lang === 'vi' \? '([^']*)' : '([^']*)'}")

text = pattern.sub(r"'\1'", text)

# Also fix the ones that don't have trailing quote correctly grabbed:
pattern2 = re.compile(r"\{lang === 'vi' \? '([^']*)' : '([^']*)'\}")
# If there are still `{lang...}` blocks *inside* string literals like `tCO2e/{lang...}/năm`
# Wait! Instead of guessing, I will just manually fix lines 1640, 1643, 1649, 1651, 1662, 1663, etc by replacing all `\{lang === 'vi' \? '[^']*' : '[^']*'\}` with nothing, or just fixing them with Python regex.

# Let's just blindly remove them if they look like that.
text = text.replace("{lang === 'vi' ? 'Phát hiện sự gia tăng nghiêm trọng vào' : 'Critical escalation identified in'}", "Phát hiện sự gia tăng nghiêm trọng vào")
text = text.replace("{lang === 'vi' ? 'Xu hướng giảm mạnh nhất vào' : 'Strongest reduction trend seen in'}", "Xu hướng giảm mạnh nhất vào")
text = text.replace("{lang === 'vi' ? 'Đã đạt được' : 'Target reached'}", "Đã đạt được")
text = text.replace("{lang === 'vi' ? 'Vượt chỉ tiêu' : 'Exceeding target by'}", "Vượt chỉ tiêu")
text = text.replace("{lang === 'vi' ? 'Cần vượt' : 'Must reduce by'}", "Cần vượt")
text = text.replace("{lang === 'vi' ? 'Để giữ nhịp mục tiêu SBTi (Yêu cầu' : 'To maintain SBTi pace (Required'}", "Để giữ nhịp mục tiêu SBTi (Yêu cầu")
text = text.replace("{lang === 'vi' ? 'Đồ thị thác nước (Waterfall)' : 'Waterfall Chart'}", "Đồ thị thác nước (Waterfall)")

text = re.sub(r"\{lang === 'vi' \? '([^']*)' : '([^']*)'\}", r"\1", text)

with open('src/app/opex-report/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
