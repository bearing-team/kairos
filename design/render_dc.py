"""Render a simple .dc.html (holes + sc-for, no events) to a static HTML file.
Usage: python3 render_dc.py in.dc.html out.html "Title"
"""
import json, re, subprocess, sys, tempfile, os

src_path, out_path, title = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(src_path, encoding='utf-8').read()

# 1) data from renderVals() via node
js = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', src, re.S).group(1)
runner = "class DCLogic{constructor(){this.props={};this.state={};}}\n" + js + \
    "\nprocess.stdout.write(JSON.stringify(new Component().renderVals()));"
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
    f.write(runner); tmp = f.name
data = json.loads(subprocess.check_output(['node', tmp]))
os.unlink(tmp)

# 2) template parts
helmet = re.search(r'<helmet>(.*?)</helmet>', src, re.S).group(1)
body = re.search(r'</helmet>(.*?)</x-dc>', src, re.S).group(1)

def lookup(path, scope):
    cur = scope
    for part in path.strip().split('.'):
        cur = cur[part] if isinstance(cur, dict) else None
        if cur is None:
            raise KeyError(path)
    return cur

def esc(v):
    return str(v).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def fill(text, scope):
    return re.sub(r'\{\{\s*([\w.$]+)\s*\}\}', lambda m: esc(lookup(m.group(1), scope)), text)

def render(tpl, scope):
    out, i = [], 0
    open_re = re.compile(r'<sc-for list="\{\{\s*([\w.]+)\s*\}\}" as="(\w+)"[^>]*>')
    while True:
        m = open_re.search(tpl, i)
        if not m:
            out.append(fill(tpl[i:], scope)); break
        out.append(fill(tpl[i:m.start()], scope))
        # find matching close (supports nesting)
        depth, j = 1, m.end()
        while depth:
            o = open_re.search(tpl, j); c = tpl.find('</sc-for>', j)
            if o and o.start() < c:
                depth += 1; j = o.end()
            else:
                depth -= 1; j = c + len('</sc-for>')
        inner = tpl[m.end():j - len('</sc-for>')]
        for item in lookup(m.group(1), scope):
            out.append(render(inner, {**scope, m.group(2): item}))
        i = j
    return ''.join(out)

html = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<!-- 디자인 레퍼런스: Claude Design 캔버스 원본({os.path.basename(src_path)})에서 생성한 정적 HTML.
     데이터는 예시값. 앱 구현 시 docs/DESIGN.md + design/tokens.css를 기준으로 컴포넌트화한다. -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
{helmet.strip()}
</head>
<body>
{render(body, data).strip()}
</body>
</html>
"""
open(out_path, 'w', encoding='utf-8').write(html)
print('ok', out_path, len(html))
