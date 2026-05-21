import os
import re

md_path = r'c:\Users\Federico Dobal\Desktop\Kuda-front\HUs - TEXTOS.md'
with open(md_path, 'r', encoding='utf-8') as f:
    content = f.read()

sections = re.split(r'\n## ', '\n' + content)[1:]
src_dir = r'c:\Users\Federico Dobal\Desktop\Kuda-front\src'

files_content = {}
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.ts', '.html')):
            try:
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    files_content[os.path.join(root, file)] = f.read()
            except:
                pass

print('--- Discrepancies ---')
for sec in sections:
    lines = sec.split('\n')
    title = lines[0].strip()
    
    phrases = set(re.findall(r'`([^`]+)`', sec))
    missing = []
    for p in phrases:
        found = False
        for fcontent in files_content.values():
            if p in fcontent:
                found = True
                break
        if not found:
            missing.append(p)
            
    if missing:
        print(f'\n## {title}')
        for m in missing:
            print(f'Missing: {m}')
