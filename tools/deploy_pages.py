"""Publish the current game to GitHub Pages (branch `gh-pages`).

Usage: python3 tools/deploy_pages.py            (build + commit + push)
       python3 tools/deploy_pages.py --dry-run  (build into _site/ only)

Same set-up as The Overland Trail: index.html + manifest.json + sw.js +
icons at the root of the Pages site, so the game installs to the phone's
home screen and runs offline. The single-file game itself is unchanged;
this script adds the manifest link and service-worker registration to
the published copy only. Live at https://wizardofwalnut.github.io/goetz-mark/
once Pages is switched on (Settings -> Pages -> Branch: gh-pages, / root).
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, 'aldermarch-single-file', 'aldermarch-game.html')
PAGES = os.path.join(ROOT, 'pages')
SITE = os.path.join(ROOT, '_site')
BRANCH = 'gh-pages'


def run(*args, cwd=ROOT):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def build():
    commit = run('git', 'rev-parse', '--short', 'HEAD')
    if os.path.exists(SITE):
        shutil.rmtree(SITE)
    os.makedirs(SITE)
    html = open(GAME, encoding='utf-8').read()
    head = '<link rel="manifest" href="manifest.json">\n<link rel="apple-touch-icon" href="icon-192.png">\n'
    assert html.count('</head>') == 1 and html.count('</body>') == 1
    html = html.replace('</head>', head + '</head>', 1)
    reg = ('<script>if ("serviceWorker" in navigator) window.addEventListener("load", () => '
           'navigator.serviceWorker.register("sw.js").catch(() => {}));</script>\n')
    html = html.replace('</body>', reg + '</body>', 1)
    html = html.replace('<title>The Aldermarch — playtest build</title>', f'<title>Aldermarch</title>', 1)
    open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8').write(html)
    for name in os.listdir(PAGES):
        src = os.path.join(PAGES, name)
        if name == 'sw.js':
            open(os.path.join(SITE, name), 'w').write(open(src).read().replace('__BUILD__', commit))
        else:
            shutil.copy(src, SITE)
    open(os.path.join(SITE, '.nojekyll'), 'w').close()
    open(os.path.join(SITE, 'BUILD.txt'), 'w').write(f'{commit}\n')
    return commit


def publish(commit):
    wt = os.path.join(ROOT, '.git', 'pages-worktree')
    if os.path.exists(wt):
        run('git', 'worktree', 'remove', '--force', wt)
    exists = subprocess.run(['git', 'ls-remote', '--exit-code', '--heads', 'origin', BRANCH], cwd=ROOT,
                            capture_output=True).returncode == 0
    if exists:
        run('git', 'fetch', 'origin', f'{BRANCH}:{BRANCH}')
        run('git', 'worktree', 'add', wt, BRANCH)
    else:
        run('git', 'worktree', 'add', '--detach', wt)
        run('git', 'checkout', '--orphan', BRANCH, cwd=wt)
        run('git', 'rm', '-rfq', '.', cwd=wt)
    for name in os.listdir(wt):
        if name != '.git':
            p = os.path.join(wt, name)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    for name in os.listdir(SITE):
        shutil.copy(os.path.join(SITE, name), wt)
    run('git', 'add', '-A', cwd=wt)
    if run('git', 'status', '--porcelain', cwd=wt):
        msg = (f'Publish build {commit}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'
               'Claude-Session: https://claude.ai/code/session_01Si7yCYtaRkU66udtrNvA8s')
        run('git', 'commit', '-qm', msg, cwd=wt)
        run('git', 'push', '-q', 'origin', BRANCH, cwd=wt)
        print(f'published {commit} to {BRANCH}')
    else:
        print('nothing changed')
    run('git', 'worktree', 'remove', '--force', wt)


if __name__ == '__main__':
    c = build()
    print(f'built _site/ for {c}')
    if '--dry-run' not in sys.argv:
        publish(c)
