"""Create deterministic, non-commercial ZIP fixtures. No network or credentials."""
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'output' / 'commerce-fixtures'
OUTPUT.mkdir(parents=True, exist_ok=True)
manifest = []
for product_id, title in [
    ('planner-alimentar', 'Planner alimentar fictício'),
    ('planner-treino', 'Planner de treino fictício'),
]:
    archive = OUTPUT / f'{product_id}-v1.zip'
    files = {
        'LEIA-ME.txt': (
            f'RENATA JOIN — HOMOLOGAÇÃO\n{title}\n\n'
            'PACOTE FICTÍCIO: não é um produto comercial.\n'
            'Este arquivo serve exclusivamente para conferir a entrega digital de teste.\n'
            'Não contém dados pessoais, credenciais, PDFs comerciais ou links Notion reais.\n'
            'Resultado esperado: abrir este ZIP e ler os dois arquivos de texto.\n'
        ),
        'conteudo-ficticio.txt': (
            f'Produto de teste: {product_id}\nVersão: v1\n'
            'Entrega fictícia recebida com sucesso.\n'
            'Nenhuma cobrança ou acesso a serviços externos é necessário para ler este arquivo.\n'
        ),
    }
    with ZipFile(archive, 'w', compression=ZIP_DEFLATED) as bundle:
        for name, content in files.items():
            entry = ZipInfo(name, date_time=(2026, 10, 26, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            bundle.writestr(entry, content.encode('utf-8'))
    with ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        assert bundle.namelist() == list(files)
    manifest.append({
        'product_id': product_id,
        'object_key': f'products/{product_id}/v1.zip',
        'filename': archive.name,
        'bytes': archive.stat().st_size,
        'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'fixture': True,
    })
(OUTPUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': 'created_and_verified', 'fixtures': manifest}, ensure_ascii=False, indent=2))
