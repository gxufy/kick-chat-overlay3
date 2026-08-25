from pathlib import Path
import re

ROOT = Path('.')

# These files are repository/process documentation rather than application code.
for rel in [
    'src/pages/open-source.tsx',
    'tests/unit/openSourceDisclosure.test.tsx',
]:
    path = ROOT / rel
    if path.exists():
        path.unlink()

# Internal names from previous implementation research do not belong in source comments.
REFERENCE_TERMS = (
    'streamnook',
    'chatis',
    'uchat',
    'bchat',
    'unified-chat-lite',
    'ref-uchat',
)

BLOCK_COMMENT = re.compile(r'/\*(?:(?!\*/).)*\*/', re.S)


def contains_reference(value: str) -> bool:
    low = value.lower()
    return any(term in low for term in REFERENCE_TERMS)


def strip_reference_comments(text: str) -> str:
    text = BLOCK_COMMENT.sub(
        lambda match: '' if contains_reference(match.group(0)) else match.group(0),
        text,
    )

    cleaned = []
    for line in text.splitlines(keepends=True):
        comment_at = None
        for match in re.finditer(r'//', line):
            # Ignore URL schemes such as https://...
            if match.start() > 0 and line[match.start() - 1] == ':':
                continue
            comment_at = match.start()
            break
        if comment_at is not None and contains_reference(line[comment_at:]):
            prefix = line[:comment_at].rstrip()
            ending = '\n' if line.endswith('\n') else ''
            line = (prefix + ending) if prefix else ending
        cleaned.append(line)
    return ''.join(cleaned)


SOURCE_SUFFIXES = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}
for base in [ROOT / 'src', ROOT / 'tests']:
    if not base.exists():
        continue
    for path in base.rglob('*'):
        if path.is_file() and path.suffix in SOURCE_SUFFIXES:
            text = path.read_text(encoding='utf-8')
            text = strip_reference_comments(text)
            text = text.replace('gx-bchat-slide-in', 'gx-message-slide-in')
            text = text.replace('gxBChatSlideIn', 'gxMessageSlideIn')
            text = text.replace('SN_PALETTE', 'NAME_PALETTE')
            text = text.replace('bchatParity', 'applyProviderMultiplicity')
            path.write_text(text, encoding='utf-8')

# Remove research-origin wording from user-visible/test strings while preserving behavior.
replacements = {
    'src/features/multichat/settings.ts': {
        'bChat-style 250ms horizontal entrance for each newly inserted chat row.':
            '250ms horizontal entrance for each newly inserted chat row.',
    },
    'tests/unit/msgSlideIn.test.tsx': {
        "describe('bChat-style message slide-in'": "describe('message slide-in'",
        "it('is off by default and accepts bChat boolean query syntax'":
            "it('is off by default and accepts boolean query syntax'",
    },
    'tests/unit/smoothScroll.test.tsx': {
        "describe('bChat-style smooth message handling'": "describe('smooth message handling'",
        "it('keeps the authentic ChatIS height ghost when Slide is selected'":
            "it('keeps the height ghost when Slide is selected'",
    },
    'tests/unit/chatOverlayEntranceQueue.test.tsx': {
        "describe('shared ChatIS batch entrance'": "describe('shared batch entrance'",
    },
}
for rel, mapping in replacements.items():
    path = ROOT / rel
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    for old, new in mapping.items():
        text = text.replace(old, new)
    path.write_text(text, encoding='utf-8')

# Replace the dedicated disclosure route with one direct source link in the footer.
generator = ROOT / 'src/components/classic/ClassicGenerator.tsx'
text = generator.read_text(encoding='utf-8')
text = text.replace(
    '''        <p>\n          <Link href="/open-source">Source &amp; Open Source Licenses</Link>\n        </p>''',
    '''        <p>\n          <a\n            href="https://github.com/gxufy/multichat-gxufy"\n            target="_blank"\n            rel="noreferrer"\n          >\n            Source\n          </a>\n        </p>''',
)
generator.write_text(text, encoding='utf-8')

# The old negative-attribution test itself contained the names it was trying to ban.
test = ROOT / 'tests/unit/classicGenerator.test.tsx'
text = test.read_text(encoding='utf-8')
text = re.sub(
    r"\n  it\('carries no third-party attribution line', \(\) => \{.*?\n  \}\);\n",
    '\n',
    text,
    flags=re.S,
)
test.write_text(text, encoding='utf-8')

# Keep the legally relevant notice compact and out of the repository root.
notice = ROOT / '.github/THIRD_PARTY_NOTICES.md'
notice.write_text(
    '# Third-party notices\n\n'
    'Portions of this project include modified code distributed under the GNU Affero General Public License, version 3 or later.\n\n'
    'Copyright (C) 2026 Fish (Fiszh)\n\n'
    'Those portions were modified for this project on 2026-08-01. The applicable license is preserved in the repository root `LICENSE` file.\n\n'
    'The Geist font is distributed under the SIL Open Font License 1.1. Its license text is retained at `public/fonts/Geist-OFL.txt`.\n',
    encoding='utf-8',
)
