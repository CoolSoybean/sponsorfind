"""Fetch, validate and publish immutable sponsor JSON snapshots (standard library only)."""
import argparse
import csv
import hashlib
import io
import json
import re
import shutil
import time
import unicodedata
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

SOURCE = 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers'
ROOT = Path(__file__).resolve().parents[1]
FIELDS = {'Organisation Name': 'name', 'Town/City': 'town', 'County': 'county', 'Type & Rating': 'rating', 'Route': 'route'}

def normalized(value):
    return ' '.join(unicodedata.normalize('NFKC', value).split())

def shard_for(name):
    name = normalized(name).lower()
    first = next((c for c in name if c.isalnum()), '')
    if 'a' <= first <= 'z': return first
    if first.isascii() and first.isdigit(): return '0-9'
    return 'other'

def download(url):
    if urlparse(url).scheme != 'https' or urlparse(url).hostname not in {'www.gov.uk', 'assets.publishing.service.gov.uk'}:
        raise ValueError('Untrusted source URL')
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Sponsorfind/1.0 public-register-reader'}), timeout=60) as response:
                if urlparse(response.url).hostname not in {'www.gov.uk','assets.publishing.service.gov.uk'}: raise ValueError('Unexpected redirect')
                return response.read()
        except Exception:
            if attempt == 2: raise
            time.sleep(2 ** attempt)

class Publication(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.updated=None
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag == 'a' and '.csv' in attrs.get('href','').lower(): self.links.append(urljoin(SOURCE,attrs['href']))
        if tag == 'meta' and attrs.get('property') == 'article:modified_time': self.updated=attrs.get('content')
        if tag == 'time' and attrs.get('datetime'): self.updated=attrs['datetime']

def parse_csv(raw):
    reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    if not reader.fieldnames or not set(FIELDS).issubset(reader.fieldnames): raise ValueError(f'Unexpected CSV columns: {reader.fieldnames}')
    records={}; duplicates=0
    for line in reader:
        if None in line: raise ValueError('Malformed CSV row')
        record={target:(line.get(source) or '').strip() for source,target in FIELDS.items()}
        if not record['name'] or not record['route'] or not record['rating']: raise ValueError('Missing name, route or rating')
        key=json.dumps(record,ensure_ascii=False,sort_keys=True)
        identity=hashlib.sha256(key.encode()).hexdigest()[:24]
        if identity in records:
            duplicates+=1; continue
        records[identity]={'id':identity,**record,'shard':shard_for(record['name'])}
    return sorted(records.values(),key=lambda r:(normalized(r['name']).casefold(),r['id'])),duplicates

def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--csv',type=Path,help='Use a local official CSV for offline rebuild')
    parser.add_argument('--source-updated',help='Official publication date for local CSV')
    parser.add_argument('--min-records',type=int,default=10000)
    parser.add_argument('--allow-large-change',action='store_true',help='Only after reviewing an unexpected source change')
    args=parser.parse_args()
    data=ROOT/'public/data'; previous={}
    if (data/'manifest.json').exists(): previous=json.loads((data/'manifest.json').read_text(encoding='utf-8'))
    if args.csv:
        raw=args.csv.read_bytes(); updated=args.source_updated; csv_url=None
    else:
        html=download(SOURCE).decode('utf-8'); publication=Publication(); publication.feed(html)
        links=list(dict.fromkeys(link for link in publication.links if urlparse(link).hostname == 'assets.publishing.service.gov.uk'))
        if len(links)!=1: raise ValueError(f'Expected one CSV attachment, got {len(links)}')
        csv_url=links[0]; raw=download(csv_url)
        # Publication pages put the latest date near the top; do not use dates in change history.
        dates=re.findall(r'<time[^>]*datetime="([^"]+)"',html)
        updated=max(dates) if dates else publication.updated
        if not updated: raise ValueError('Official update date not found')
    records,duplicates=parse_csv(raw)
    if len(records)<args.min_records: raise ValueError(f'Only {len(records)} records; publication stopped')
    old=previous.get('count',0)
    if old and abs(len(records)-old)/old > .2 and not args.allow_large_change: raise ValueError('Record count changed by more than 20%; review before publishing')
    version=hashlib.sha256(json.dumps(records,ensure_ascii=False).encode()).hexdigest()[:16]
    staging=ROOT/'work'/f'build-{version}'
    staging.mkdir(parents=True,exist_ok=True)
    groups={letter:[] for letter in list('abcdefghijklmnopqrstuvwxyz')+['0-9','other']}
    for record in records: groups[record['shard']].append(record)
    dictionaries={key:sorted({r[key] for r in records}) for key in ['town','county','route','rating','shard']}
    lookup={key:{value:i for i,value in enumerate(values)} for key,values in dictionaries.items()}
    packed={'format':1,'dictionaries':dictionaries,'rows':[[r['id'],r['name']]+[lookup[k][r[k]] for k in ['town','county','route','rating','shard']] for r in records]}
    write_json(staging/'index.json',packed)
    shards={}
    base=f'/data/versions/{version}'
    for letter,rows in groups.items():
        write_json(staging/f'{letter}.json',rows)
        shards[letter]={'url':f'{base}/{letter}.json','count':len(rows)}
    if sum(x['count'] for x in shards.values())!=len(records): raise ValueError('Shard count mismatch')
    for file in staging.glob('*.json'):
        if file.stat().st_size >= 25*1024*1024: raise ValueError(f'{file.name} exceeds static asset size limit')
    target=data/'versions'/version
    if target.exists():
        for file in staging.glob('*.json'):
            if not (target/file.name).exists() or file.read_bytes()!=(target/file.name).read_bytes(): raise ValueError('Immutable version content differs')
    else: shutil.copytree(staging,target)
    manifest={'version':version,'source':SOURCE,'csv_source':csv_url,'source_updated':updated,'checked_at':datetime.now(timezone.utc).isoformat(),'count':len(records),'count_unit':'licence_records','index':f'{base}/index.json','shards':shards}
    # Replace manifest last. Hosting deployment is only invoked after this command succeeds.
    write_json(data/'manifest.next.json',manifest)
    (data/'manifest.next.json').replace(data/'manifest.json')
    report={'count':len(records),'duplicates_removed':duplicates,'version':version,'index_bytes':(target/'index.json').stat().st_size}
    write_json(ROOT/'work/quality-report.json',report)
    print(json.dumps(report))

if __name__=='__main__': main()
