import json, pathlib
p=pathlib.Path(r'c:\Users\abiga\IntextW2026\ml-pipelines\social_media_posts_pipeline.ipynb')
nb=json.loads(p.read_text(encoding='utf-8'))
for i,c in enumerate(nb['cells']):
    if c.get('cell_type')!='code':
        continue
    src=''.join(c.get('source',[]))
    if "print('\n" in src or "print(\"\n" in src or "print('" + '\n' in src:
        print('cell',i,'contains newline-prefixed print')
    if "print('"+"\n" in src:
        print('cell',i,'contains broken literal')
    if "print('" in src and "\n" in src:
        pass
print('done')
