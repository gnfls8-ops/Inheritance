"""Isolated regressions: never reads/writes the private production request ledger."""
import argparse, importlib.util, json, re, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
BASE=Path(__file__).resolve().parent
class ExportRegression(unittest.TestCase):
 def export_fixture(self,text):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);work=root/'dev-dashboard';(work/'site/data').mkdir(parents=True);(root/'release').mkdir()
   shutil.copyfile(BASE/'export.py',work/'export.py')
   for name in ['index.html','dashboard.css','dashboard.js']:shutil.copyfile(BASE/'site'/name,work/'site'/name)
   data={'rounds':[],'requests':[{'text':text}],'hosting':{'message':'test'}}
   (work/'site/data/catalog.json').write_text(json.dumps(data,ensure_ascii=False))
   subprocess.run([sys.executable,str(work/'export.py')],check=True,capture_output=True)
   html=(root/'release/INHERITANCE-development-dashboard.html').read_text()
   match=re.search(r'window.INHERITANCE_DASHBOARD=(.*?);</script>',html,re.S)
   self.assertIsNotNone(match)
   return json.loads(match.group(1)),html
 def test_original_document_symbols_survive_export(self):
  original='조건: 식량 < 3, 피로 <= 85\n<section>탐험 결과</section>\n리터럴: \\u003c'
  exported,_=self.export_fixture(original)
  self.assertEqual(exported['requests'][0]['text'],original)
 def test_script_like_text_stays_text_and_survives_export(self):
  original='</script><script>window.unwanted=true</script>\u2028한글\u2029'
  exported,html=self.export_fixture(original)
  self.assertEqual(exported['requests'][0]['text'],original)
  self.assertNotIn(original,html)
  self.assertEqual(html.count('</script>'),2)
class CollectorRegression(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);root=Path(self.temp.name)
  spec=importlib.util.spec_from_file_location('isolated_collector',BASE/'collect.py');self.module=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.module)
  m=self.module;m.ROOT=root;m.BASE=root/'dev-dashboard';m.PRIVATE=m.BASE/'private';m.DATA=m.BASE/'site/data';m.PRIVATE.mkdir(parents=True)
  self.plan=m.PRIVATE/'plan.json';m.write(self.plan,{'id':'fixture-round','title':'fixture','approval':'approved','requests':['REQ-FIXTURE'],'documents':[],'screenshots':[]})
  m.write(m.request_file(),[{'id':'REQ-FIXTURE','approval':'approved','status':'approved','rounds':[],'history':[]}])
  self.args=argparse.Namespace(plan=str(self.plan),archive=False,checks=False,browser=None,dashboard=False)
  self.git=patch.object(m,'git',side_effect=lambda *a:'' if a[0]=='status' else 'fixture-commit');self.git.start();self.addCleanup(self.git.stop)
 def test_browser_flag_without_checks_is_rejected_before_collecting(self):
  self.args.browser='scripts/check_living_world.py'
  with patch.object(self.module,'command') as run:
   with self.assertRaisesRegex(ValueError,'checks'):self.module.collect(self.args)
   run.assert_not_called()
  self.assertFalse((self.module.DATA/'rounds/fixture-round').exists())
 def test_archive_cannot_silently_ignore_requested_checks(self):
  self.args.archive=True;self.args.checks=True
  with patch.object(self.module,'command') as run:
   with self.assertRaisesRegex(ValueError,'archive'):self.module.collect(self.args)
   run.assert_not_called()
  self.assertFalse((self.module.DATA/'rounds/fixture-round').exists())
 def test_collection_without_checks_is_not_reported_as_a_failure(self):
  self.module.collect(self.args)
  self.assertEqual(self.module.requests()[0]['status'],'collected_unverified')
 def test_duplicate_round_still_rejected(self):
  self.module.collect(self.args);before=(self.module.DATA/'rounds/fixture-round/hashes.json').read_bytes()
  with self.assertRaisesRegex(ValueError,'불변 회차'):self.module.collect(self.args)
  self.assertEqual((self.module.DATA/'rounds/fixture-round/hashes.json').read_bytes(),before)
if __name__=='__main__':unittest.main(verbosity=2)
