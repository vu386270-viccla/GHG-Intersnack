with open('src/app/opex-report/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace any \{lang === 'vi' \? '([^']+)' : '([^']+)'\} that happens *inside* a string!
# Just do simple replacements:
text = text.replace("{lang === 'vi' ? 'năm' : 'year'}", "năm")
text = text.replace('{lang === \\\'vi\\\' ? \\\'năm\\\' : \\\'year\\\'}', "năm")
text = text.replace("{lang === \\\"vi\\\" ? \\\"năm\\\" : \\\"year\\\"}", "năm")
text = text.replace("{lang === 'vi' ? 'tCO₂e/năm' : 'tCO₂e/yr'}", "tCO₂e/năm")

with open('src/app/opex-report/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
