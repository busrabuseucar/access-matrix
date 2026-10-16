"""Package only portable source files; never collect arbitrary local data."""
from pathlib import Path
import zipfile
ROOT_FILES={'README.md','LICENSE','package.json','package-lock.json','.gitignore','tsconfig.json','playwright.config.mjs'}
DIRECTORIES={'src','public','scripts','tests','.github','docs'}
EXTENSIONS={'.ts','.mjs','.js','.py','.html','.css','.svg','.md','.yaml','.yml'}
EXCLUDED={'.git','node_modules','__pycache__','test-results','playwright-report','download'}
def build_archive(root):
 target=root/'dist/download/access-matrix-source.zip'
 target.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
  for path in sorted(root.rglob('*')):
   rel=path.relative_to(root)
   if not path.is_file() or any(part in EXCLUDED for part in rel.parts):continue
   if any(p.is_symlink() for p in [path,*path.parents]):continue
   if path.name.startswith('.env') or path.name=='secrets.toml':continue
   if rel.as_posix() in ROOT_FILES or (len(rel.parts)>1 and rel.parts[0] in DIRECTORIES and path.suffix in EXTENSIONS):archive.write(path,rel.as_posix())
  archive.writestr('.openai/hosting.json','{}\n')
 return target
if __name__=='__main__':print(build_archive(Path(__file__).resolve().parent.parent))
