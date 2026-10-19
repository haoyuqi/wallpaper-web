"""Generate full-cmap WOFF2 chunks from a supplied WenKai Regular TTF.
Run with project-scoped fonttools+brotli; input TTF is a CLI argument, not shipped.
"""
import argparse
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('--out', type=Path, default=Path('public/fonts'))
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
source = TTFont(args.source)
codepoints = sorted(source.getBestCmap())
version = source['name'].getDebugName(5)
source.close()
ui_text = ''.join(path.read_text() for path in Path('src').rglob('*') if path.suffix in {'.vue', '.ts', '.css'})
priority = set(range(0x250)) | {ord(char) for char in ui_text}
first = [point for point in codepoints if point in priority]
rest = [point for point in codepoints if point not in priority]
chunks = [first] + [rest[i:i + 512] for i in range(0, len(rest), 512)]
css = []
covered = set()
for index, points in enumerate(chunks):
    font = TTFont(args.source)
    options = subset.Options()
    options.flavor = 'woff2'
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=points)
    worker.subset(font)
    font.flavor = 'woff2'
    name = f'wenkai-{index:03}.woff2'
    font.save(args.out / name)
    covered.update(font.getBestCmap())
    font.close()
    ranges = ','.join(f'U+{point:X}' for point in points)
    css.append('@font-face{font-family:"LXGW WenKai";font-style:normal;font-weight:400;font-display:swap;'
               f'src:url("./{name}") format("woff2");unicode-range:{ranges};}}')
if covered != set(codepoints):
    raise RuntimeError('Unicode coverage differs from source')
(args.out / 'wenkai.css').write_text('\n'.join(css) + '\n')
(args.out / 'coverage.txt').write_text(f'{version}\nSource characters: {len(codepoints)}\nOutput characters: {len(covered)}\nWOFF2 chunks: {len(chunks)}\n')
print((args.out / 'coverage.txt').read_text())
