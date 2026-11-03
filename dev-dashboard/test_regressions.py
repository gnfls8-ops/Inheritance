"""Isolated regressions: never reads/writes the private production request ledger."""
import argparse, importlib.util, json, os, re, shutil, subprocess, sys, tempfile, unittest, zipfile
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
 def run_failed_cli(self, dashboard=False):
  root=self.module.ROOT
  shutil.copyfile(BASE/'collect.py',self.module.BASE/'collect.py')
  fakebin=root/'bin';fakebin.mkdir()
  for name,body in [('git',"#!/bin/sh\ncase \"$1\" in status) exit 0;; *) echo fixture-commit;; esac\n"),('npm','#!/bin/sh\necho deliberate-build-failure\nexit 7\n'),('python','#!/bin/sh\necho deliberate-dashboard-failure\nexit 8\n')]:
   file=fakebin/name;file.write_text(body);file.chmod(0o755)
  result=subprocess.run([sys.executable,str(self.module.BASE/'collect.py'),'collect','--plan',str(self.plan),'--dashboard' if dashboard else '--checks'],cwd=root,env={**os.environ,'PATH':str(fakebin)+os.pathsep+os.environ['PATH']},capture_output=True,text=True)
  snapshot=self.module.read(self.module.DATA/'rounds/fixture-round/round.json')
  self.assertEqual(snapshot['status'],'failed')
  self.assertEqual(self.module.requests()[0]['status'],'needs_fix')
  self.module.verify(None)
  self.assertNotEqual(result.returncode,0,'Failed checks must stop a caller using shell success/&&; snapshot must remain preserved')
 def test_failed_build_cli_returns_failure_with_snapshot_preserved(self):
  self.run_failed_cli()
 def test_failed_dashboard_cli_returns_failure_with_snapshot_preserved(self):
  self.run_failed_cli(dashboard=True)
 def test_duplicate_round_still_rejected(self):
  self.module.collect(self.args);before=(self.module.DATA/'rounds/fixture-round/hashes.json').read_bytes()
  with self.assertRaisesRegex(ValueError,'불변 회차'):self.module.collect(self.args)
  self.assertEqual((self.module.DATA/'rounds/fixture-round/hashes.json').read_bytes(),before)
class HandoffRegression(unittest.TestCase):
 def package_fixture(self, detached=False):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);base=root/'dev-dashboard';(base/'private').mkdir(parents=True);(root/'release').mkdir()
   shutil.copytree(BASE/'site',base/'site',ignore=shutil.ignore_patterns('data'))
   (base/'site/data').mkdir()
   for name in ['collect.py','export.py','prepare_handoff.py']:shutil.copyfile(BASE/name,base/name)
   (base/'site/data/catalog.json').write_text(json.dumps({'rounds':[],'requests':[],'hosting':{'message':'fixture'}}))
   for name,value in [('requests.json',[]),('next-plan.json',{})]:(base/'private'/name).write_text(json.dumps(value))
   def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True,stderr=subprocess.PIPE).strip()
   git('init','-b','work');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture')
   commit=git('rev-parse','HEAD')
   if detached:git('checkout','--detach',commit)
   result=subprocess.run([sys.executable,str(base/'prepare_handoff.py')],cwd=root,capture_output=True,text=True)
   self.assertEqual(result.returncode,0,result.stderr)
   output=json.loads(result.stdout.splitlines()[-1]);archive=Path(output['package']);before=archive.read_bytes()
   with zipfile.ZipFile(archive) as z:
    meta=json.loads(z.read('HANDOFF.json'));doc=z.read('HANDOFF.md').decode()
    self.assertEqual(meta['branch'],None if detached else 'work')
    self.assertEqual(meta['source_commit'],commit)
    self.assertIn(('detached HEAD' if detached else 'work')+' @ '+commit,doc)
    self.assertNotIn('총괄 채팅에 파일로 첨부해야',doc)
   again=subprocess.run([sys.executable,str(base/'prepare_handoff.py')],cwd=root,capture_output=True,text=True)
   self.assertNotEqual(again.returncode,0);self.assertEqual(archive.read_bytes(),before)
 def test_handoff_records_actual_work_branch(self):self.package_fixture()
 def test_handoff_records_detached_head_without_inventing_branch(self):self.package_fixture(detached=True)
if __name__=='__main__':unittest.main(verbosity=2)
