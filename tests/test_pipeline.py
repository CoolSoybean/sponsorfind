import unittest
from scripts.update_data import parse_csv, shard_for

class PipelineTests(unittest.TestCase):
    def test_shards(self):
        for name,expected in [('  "Apple Ltd','a'),('The Company','t'),('123 Limited','0-9'),('英国公司','other'),('ＡＢＣ','a')]:
            self.assertEqual(shard_for(name),expected)
    def test_preserves_permissions_and_duplicates(self):
        raw=('Organisation Name,Town/City,County,Type & Rating,Route\n'
             'Example,London,,Worker (A rating),Skilled Worker\n'
             'Example,London,,Worker (A rating),Skilled Worker\n'
             'Example,London,,Temporary Worker (A rating),Creative Worker\n').encode()
        records,duplicates=parse_csv(raw)
        self.assertEqual(len(records),2);self.assertEqual(duplicates,1)
        self.assertEqual(len({r['id'] for r in records}),2)
    def test_rejects_html(self):
        with self.assertRaises(ValueError): parse_csv(b'<html>Error</html>')
if __name__=='__main__': unittest.main()
