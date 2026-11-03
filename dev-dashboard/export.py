"""Create a self-contained, local/offline review artifact. Does not publish anything."""
import base64,json,re
from pathlib import Path
base=Path(__file__).resolve().parent;site=base/'site';root=base.parent
data=json.loads((site/'data/catalog.json').read_text())
def uri(path,mime):return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
for record in data['rounds']:
 directory=site/'data/rounds'/record['id']
 record['base']=''
 record['manifest_url']=uri(directory/'round.json','application/json')
 for image in record['screenshots']:image['file']=uri(directory/image['file'],'image/png')
 for document in record['documents']:document['file']=uri(directory/document['file'],'text/plain;charset=utf-8')
 for check in record['checks']:check['log']=uri(directory/check['log'],'text/plain;charset=utf-8')
serialized=json.dumps(data,ensure_ascii=False).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
html=(site/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="dashboard.css">','<style>'+(site/'dashboard.css').read_text()+'</style>')
html=html.replace('<script src="data/catalog.js"></script>','<script>window.INHERITANCE_DASHBOARD='+serialized+';</script>')
html=html.replace('<script src="dashboard.js"></script>','<script>'+(site/'dashboard.js').read_text()+'</script>')
out=root/'release/INHERITANCE-development-dashboard.html';out.write_text(html)
print(out, out.stat().st_size,'bytes')
