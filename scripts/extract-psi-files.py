"""Read-only extraction of bounded NASA PSI files; values stay strings with original locators."""
import csv
import hashlib
import io
import json
import pathlib
import subprocess
import sys
import zipfile
import openpyxl
try:
    import xlrd
except ImportError:
    xlrd = None
ROOT = pathlib.Path(__file__).resolve().parents[1]
AUDIT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/igris-file-audit').resolve()
rows = json.loads((AUDIT / 'access.json').read_text())
passages = []
MAX_CHARS = 60000

def plain(value):
    return str(value).strip() if value is not None else ''

def emit_groups(record, lines, label, header=''):
    """Never split a row or drop its sheet/header when making an excerpt."""
    block, length, first, last = [], 0, 0, 0
    for number, line in lines:
        if not line.strip():
            continue
        if len(line) > 6000:
            record['partial'] = True
            continue
        if block and length + len(line) > 1600:
            emit(record, '\n'.join(block), f'{label} {first}–{last}', header)
            block, length = [], 0
        if not block:
            first = number
        last = number
        block.append(f'{number}: {line}')
        length += len(line)
    if block:
        emit(record, '\n'.join(block), f'{label} {first}–{last}', header)

def emit(record, text, location, header=''):
    if record.get('_chars', 0) + len(text) > MAX_CHARS:
        record['partial'] = True
        return
    if len(text.strip()) < 20:
        return
    record['_chars'] = record.get('_chars', 0) + len(text)
    index = record.get('indexedPassages', 0)
    record['indexedPassages'] = index + 1
    passages.append(dict(investigation_id=record['investigation_id'], section=f"file:{record['key']}:{index}",
        source_url=record['source_url'], content=json.dumps(dict(file_name=record['file_name'],
        location=location, header=header, text=text, checkedOn=record['checkedOn'],
        coverage='Extracted source excerpt; no inferred units, safety thresholds, or cross-test comparability.'), ensure_ascii=False)))

for record in rows:
    record['indexedPassages'] = 0
    path = pathlib.Path(record.get('localFile', '')).resolve()
    if not record.get('localFile'):
        record['extractionStatus'] = 'not_selected' if record['status'] == 'accessible' else 'unavailable'
        continue
    try:
        if not path.is_relative_to(AUDIT / 'downloads') or path.stat().st_size > 2 * 1024 * 1024:
            raise ValueError('unsafe path or size')
        payload = path.read_bytes()
        if hashlib.sha256(payload).hexdigest() != record['sha256']:
            raise ValueError('checksum mismatch')
        ext = path.suffix.lower()
        if ext in ['.csv', '.tsv']:
            text = payload.decode('utf-8-sig', errors='replace')
            delimiter = '\t' if ext == '.tsv' else ','
            parsed = list(csv.reader(io.StringIO(text), delimiter=delimiter))
            record['dataRows'] = max(0, len(parsed) - 1)
            record['columns'] = parsed[0] if parsed else []
            header = json.dumps(record['columns'], ensure_ascii=False)
            emit_groups(record, ((i + 1, json.dumps(row, ensure_ascii=False)) for i, row in enumerate(parsed[1:], 1)), 'CSV record', header)
        elif ext in ['.txt', '.dat']:
            if payload.count(b'\x00') > len(payload) / 100:
                raise ValueError('binary data, not plain text')
            text = payload.decode('utf-8-sig', errors='replace')
            emit_groups(record, enumerate(text.splitlines(), 1), 'line')
        elif ext == '.pdf':
            if not payload.startswith(b'%PDF'):
                raise ValueError('not PDF')
            output = subprocess.run(['pdftotext', '-layout', str(path), '-'], capture_output=True, timeout=20, check=True)
            pages = output.stdout.decode('utf-8', errors='replace').split('\f')
            for page, text in enumerate(pages, 1):
                emit_groups(record, enumerate(text.splitlines(), 1), f'PDF page {page}, line')
        elif ext in ['.xlsx', '.xls']:
            if ext == '.xlsx':
                with zipfile.ZipFile(path) as archive:
                    if sum(item.file_size for item in archive.infolist()) > 64 * 1024 * 1024 or len(archive.infolist()) > 10000:
                        raise ValueError('workbook expansion limit')
                book = openpyxl.load_workbook(path, read_only=True, data_only=True, keep_links=False)
                for sheet in book.worksheets:
                    if (sheet.max_row or 0) > 5000 or (sheet.max_column or 0) > 60:
                        record['partial'] = True
                    values = list(sheet.iter_rows(max_row=min(sheet.max_row or 5000, 5000), max_col=min(sheet.max_column or 60, 60), values_only=True))
                    context = '\n'.join(f'{i+1}: '+json.dumps([plain(c) for c in value], ensure_ascii=False) for i,value in enumerate(values[:5]))
                    emit_groups(record, ((i+1, json.dumps([plain(c) for c in value], ensure_ascii=False)) for i,value in enumerate(values)), f'Sheet {sheet.title}, row', context)
                book.close()
            else:
                if xlrd is None:
                    raise ValueError('legacy XLS reader unavailable')
                book = xlrd.open_workbook(path, on_demand=True)
                for sheet in book.sheets():
                    values = [sheet.row_values(i, 0, min(sheet.ncols,60)) for i in range(min(sheet.nrows,5000))]
                    if sheet.nrows > 5000 or sheet.ncols > 60:
                        record['partial'] = True
                    context = '\n'.join(f'{i+1}: '+json.dumps(value,ensure_ascii=False) for i,value in enumerate(values[:5]))
                    emit_groups(record, ((i+1,json.dumps(value,ensure_ascii=False)) for i,value in enumerate(values)), f'Sheet {sheet.name}, row', context)
                book.release_resources()
        else:
            record['extractionStatus'] = 'unsupported_format'
        if record['indexedPassages']:
            record['extractionStatus'] = 'partial' if record.get('partial') else 'indexed'
        elif record.get('extractionStatus') != 'unsupported_format':
            record['extractionStatus'] = 'no_text'
    except Exception as error:
        record['extractionStatus'] = 'extraction_failed'
        record['extractionError'] = type(error).__name__ + ': ' + str(error)[:100]
    record.pop('_chars', None)
public = [{k:v for k,v in record.items() if k not in ['localFile','attempts','partial']} for record in rows]
inventory = json.loads((AUDIT/'inventory.json').read_text()) if (AUDIT/'inventory.json').exists() else rows
manifest = dict(checkedOn=max(record['checkedOn'] for record in rows),inventoryRows=len(inventory),uniqueFiles=len(rows),records=public)
(ROOT/'data/psi-file-passages.json').write_text(json.dumps(passages, ensure_ascii=False, indent=2)+'\n')
(ROOT/'src/lib/psi-file-status.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
(ROOT/'docs/psi-file-audit-2026-11-14.json').write_text(json.dumps(dict(**manifest,checks=[{k:v for k,v in record.items() if k!='localFile'} for record in rows]),ensure_ascii=False,indent=2)+'\n')
from collections import Counter
print(json.dumps(dict(unique=len(rows),statuses=dict(Counter(record['status'] for record in rows)),extraction=dict(Counter(record['extractionStatus'] for record in rows)),passages=len(passages),textBytes=sum(len(p['content'].encode()) for p in passages)),indent=2))
