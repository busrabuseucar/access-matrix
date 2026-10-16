import importlib.util
from pathlib import Path
import tempfile,unittest,zipfile
class PackageTests(unittest.TestCase):
 def test_private_files_and_symlinks_are_excluded(self):
  spec=importlib.util.spec_from_file_location('packager','scripts/package-source.py')
  module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory)
   for name in ['README.md','src/app.ts','.env','private.json','data.db','.openai/hosting.json','tests/test-results/a.ts']:
    p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('PRIVATE_FIXTURE')
   (root/'src/link.ts').symlink_to(root/'.env')
   with zipfile.ZipFile(module.build_archive(root)) as archive:
    self.assertEqual(set(archive.namelist()),{'README.md','src/app.ts','.openai/hosting.json'})
    self.assertEqual(archive.read('.openai/hosting.json'),b'{}\n')
