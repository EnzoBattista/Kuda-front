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
        if file.endswith(('.ts', '.html', '.css')):
            try:
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    files_content[os.path.join(root, file)] = f.read()
            except:
                pass

report = []
report.append('# Reporte de Verificación de Textos\n')
report.append('Este reporte detalla las discrepancias entre los textos especificados en `HUs - TEXTOS.md` y los textos encontrados en el código fuente de la aplicación.\n')

for sec in sections:
    lines = sec.split('\n')
    title = lines[0].strip()
    
    phrases = []
    for line in lines:
        match = re.findall(r'`([^`]+)`', line)
        if match:
            phrases.extend(match)
            
    # filter duplicates
    phrases = list(dict.fromkeys(phrases))
    
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
        report.append(f'## {title}')
        for m in missing:
            report.append(f'- Falta: `{m}`')
        report.append('')

with open('reporte_textos_utf8.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(report))
