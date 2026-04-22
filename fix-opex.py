import re

def fix_file(path):
    with open(path, 'r', encoding='utf8') as f:
        content = f.read()

    # Pattern: '{lang === \'vi\' ? \'...\' : \'...\'}' inside a string?
    # Wait, the error is: '{lang === \'vi\' ? \'...\' : \'{lang === \\'vi\\' ? \\'...\\' : \\'...\\'}\'}'
    # This is effectively nested. Let's just fix the bad ones.

    replacements = [
        ("'{lang === \\'vi\\' ? \\'Mức thay đổi YoY 2024→2025:\\' : \\'YoY 2024→2025 Shift:\\'}'",
         "'YoY 2024→2025 Shift:'"),
        ("'{lang === \\'vi\\' ? \\'Chu kỳ giảm cao nhất:\\' : \\'Highest reduction cycle:\\'}'",
         "'Highest reduction cycle:'"),
        ("'{lang === \\'vi\\' ? \\'Mức tăng cao đỉnh điểm:\\' : \\'Peak volume increase:\\'}'",
         "'Peak volume increase:'"),
        ("'{lang === \\'vi\\' ? \\'Sự thay đổi cường độ:\\' : \\'Intensity shift:\\'}'",
         "'Intensity shift:'"),
        ("'{lang === \\'vi\\' ? \\'so với thay đổi sản lượng:\\' : \\'vs Production shift:\\'}'",
         "'vs Production shift:'"),
         # There's likely more from Scope 2 as well:
        ("'{lang === \\'vi\\' ? \\'Mức tăng YoY 2024→2025:\\' : \\'YoY 2024→2025 Shift:\\'}'",
         "'YoY 2024→2025 Shift:'"),
         ("'{lang === \\'vi\\' ? \\'Nhịp độ giảm điện lưới lớn nhất:\\' : \\'Largest grid drop:\\'}'",
         "'Largest grid drop:'"),
         ("'{lang === \\'vi\\' ? \\'Mức tăng điện lưới đỉnh điểm:\\' : \\'Peak grid spike:\\'}'",
         "'Peak grid spike:'"),
         ("'{lang === \\'vi\\' ? \\'Đồ thị thác nước (Waterfall)\\' : \\'Waterfall Chart\\'}'",
         "'Waterfall Chart'")
    ]
    
    # We can also use regex to find `{lang === 'vi' ? '...' : '{lang === ...'}`.
    # A generic regex for: '{lang === \'vi\' ? \'...\' : \'...\'}'
    pattern = re.compile(r"'{lang === \\'vi\\' \? \\'([^']+)\\' : \\'([^']+)\\'}'")
    content = pattern.sub(r"'\2'", content)

    # Note that earlier it matched `{lang === 'vi' ? 'Mức thay đổi YoY 2024→2025:' : '{lang === 'vi' ? 'Mức thay đổi YoY 2024→2025:' : 'YoY 2024→2025 Shift:'}'}`
    # Wait! '{lang === \'vi\' ? \'Mức thay đổi YoY 2024→2025:\' : \'YoY 2024→2025 Shift:\'}' is a STRING. It was caused by the AI doing a string replace inside a string without escaping or evaluating.
    
    # Just fix all of them by using regex: r"'{lang === \x27vi\x27 \? [^:]+: \x27([^\x27]+)\x27}'" -> r"'\1'"
    # The actual string in the file is: '{lang === \'vi\' ? \'Mức thay đổi YoY 2024→2025:\' : \'YoY 2024→2025 Shift:\'}'
    bad_pattern = re.compile(r"'{lang === 'vi' \? '[^']+' : '([^']+)'}'")
    content = bad_pattern.sub(r"'\1'", content)
    
    # Check other errors like line 1609: `'{lang === 'vi' ? 'Nhịp độ giảm điện lưới lớn nhất:' : 'Largest grid drop:'}'`
    
    with open(path, 'w', encoding='utf8') as f:
        f.write(content)
    print("Fixed ", path)

fix_file('src/app/opex-report/page.tsx')
