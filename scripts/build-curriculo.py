#!/usr/bin/env python3
"""Gera curriculo.html e o PDF ATS a partir de data/curriculo.json."""

from __future__ import annotations

import json
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "curriculo.json"
HTML_PATH = ROOT / "curriculo.html"
PDF_DIR = ROOT / "documents"
PDF_PATH = PDF_DIR / "renata-gomes-araujo-curriculo.pdf"


def load_data():
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def html_list(items):
    return "<ul>" + "".join(f"<li>{escape(item)}</li>" for item in items) + "</ul>"


def contact_links(data):
    links = []
    for item in data["contacts"]:
        links.append(
            f'<a href="{escape(item["url"], quote=True)}" target="_blank" '
            f'rel="noopener noreferrer"><strong>{escape(item["label"])}:</strong> '
            f'{escape(item["value"])}</a>'
        )
    return "".join(links)


def build_html(data):
    identity = data["identity"]
    competencies = "".join(
        f'<article class="card"><h3>{escape(group["title"])}</h3>{html_list(group["items"])}</article>'
        for group in data["competencies"]
    )
    experiences = []
    for item in data["experience"]:
        org = f'<div class="org">{escape(item["organization"])}</div>' if item.get("organization") else ""
        experiences.append(
            '<article class="entry">'
            f'<div class="entry-head"><div><h3>{escape(item["role"])}</h3>{org}</div>'
            f'<span class="period">{escape(item["period"])}</span></div>'
            f'<p class="entry-summary">{escape(item["summary"])}</p>{html_list(item["highlights"])}</article>'
        )
    projects = "".join(
        '<article class="project">'
        f'<h3>{escape(item["name"])}</h3><dl>'
        f'<dt>Contexto</dt><dd>{escape(item["context"])}</dd>'
        f'<dt>Solução</dt><dd>{escape(item["solution"])}</dd>'
        f'<dt>Evidência</dt><dd>{escape(item["evidence"])}</dd>'
        '</dl></article>'
        for item in data["projects"]
    )
    education = "".join(
        '<article>'
        f'<h3>{escape(item["course"])}</h3>'
        f'<p class="status">{escape(item["status"])}'
        f'{(" · " + escape(item["year"])) if item.get("year") else ""}</p>'
        f'{f"<p>{escape(item["note"])}</p>" if item.get("note") else ""}</article>'
        for item in data["education"]
    )
    development = "".join(
        '<article class="entry">'
        f'<div class="entry-head"><div><h3>{escape(item["course"])}</h3>'
        f'{f"<div class=org>{escape(item["institution"])}</div>" if item.get("institution") else ""}</div>'
        f'<span class="period">{escape(item["status"])}</span></div>{html_list(item["topics"])}</article>'
        for item in data["development"]
    )
    updated = data["updated"].split("-")
    updated_br = f"{updated[2]}/{updated[1]}/{updated[0]}"
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Currículo reservado | {escape(identity["name"])}</title>
<meta name="description" content="Currículo profissional reservado de {escape(identity["name"])}.">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="https://renatajoin.com/curriculo">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/curriculo.css">
</head>
<body>
<a class="skip" href="#conteudo">Ir para o conteúdo</a>
<header class="topbar"><div class="wrap"><a class="brand" href="/">Renata <em>Join</em></a><span class="reserved">Documento profissional reservado</span></div></header>
<main id="conteudo">
<section class="hero"><div class="wrap">
<div class="eyebrow">Currículo profissional</div>
<h1>{escape(identity["name"])}</h1>
<p class="title">{escape(identity["title"])}</p>
<p class="subtitle">{escape(identity["subtitle"])}</p>
<div class="meta"><span>{escape(identity["location"])}</span><span>{escape(identity["availability"])}</span></div>
<div class="actions">
<a class="btn" href="/documents/renata-gomes-araujo-curriculo.pdf" download>Baixar currículo em PDF</a>
<button class="btn alt" id="printCurriculum" type="button">Imprimir currículo</button>
</div>
<p class="privacy-note">Esta página é reservada e não está listada na navegação nem nos mecanismos de busca. O acesso pela URL não equivale a autenticação.</p>
</div></section>
<section class="section paper"><div class="wrap"><div class="eyebrow">Resumo profissional</div><h2>Compreender, organizar e transformar.</h2><p class="lead">{escape(data["summary"])}</p><p class="focus">{escape(data["focus"])}</p></div></section>
<section class="section dark"><div class="wrap"><div class="eyebrow">Competências principais</div><h2>Negócio, estrutura e experiência.</h2><div class="grid">{competencies}</div></div></section>
<section class="section"><div class="wrap"><div class="eyebrow">Experiência profissional</div><h2>Atuação e responsabilidades.</h2><div class="entries">{''.join(experiences)}</div></div></section>
<section class="section paper"><div class="wrap"><div class="eyebrow">Projetos em destaque</div><h2>Problemas transformados em soluções.</h2><div class="projects">{projects}</div></div></section>
<section class="section"><div class="wrap"><div class="eyebrow">Formação acadêmica</div><h2>Formação e repertório.</h2><div class="education">{education}</div></div></section>
<section class="section paper"><div class="wrap"><div class="eyebrow">Cursos e desenvolvimento</div><h2>Conhecimento em evolução.</h2><div class="entries">{development}</div></div></section>
<section class="section dark"><div class="wrap"><div class="eyebrow">Diferenciais</div><h2>Como conecto as áreas.</h2><div class="grid">{''.join(f'<article class="card"><p>{escape(item)}</p></article>' for item in data["differentials"])}</div></div></section>
<section class="section"><div class="wrap"><div class="eyebrow">Experiências complementares</div><h2>Comunicação e autoridade.</h2>{html_list(data["complementary"])}</div></section>
<section class="closing"><div class="wrap"><h2>Contato profissional</h2><p>Disponível para oportunidades em Brasília e Distrito Federal, formatos remoto e híbrido, contratação CLT, PJ e projetos profissionais.</p><div class="contact-list">{contact_links(data)}</div></div></section>
</main>
<footer class="source"><div class="wrap"><span>Atualizado em {updated_br}</span><span>Fonte única: data/curriculo.json</span></div></footer>
<script src="/curriculo.js" defer></script>
</body>
</html>
"""


def pdf_text(value):
    return escape(value).replace(" - ", " &#8211; ")


def pdf_styles():
    base = getSampleStyleSheet()
    return {
        "name": ParagraphStyle("Name", parent=base["Title"], fontName="Helvetica-Bold", fontSize=22, leading=25, textColor=colors.HexColor("#17110f"), spaceAfter=5),
        "title": ParagraphStyle("Title", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=11.2, leading=14, textColor=colors.HexColor("#8f2459"), spaceAfter=3),
        "meta": ParagraphStyle("Meta", parent=base["Normal"], fontName="Helvetica", fontSize=8.4, leading=11, textColor=colors.HexColor("#4d2d22"), spaceAfter=2),
        "h2": ParagraphStyle("H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=12.3, leading=15, textColor=colors.HexColor("#8f2459"), spaceBefore=8, spaceAfter=5, keepWithNext=True),
        "h3": ParagraphStyle("H3", parent=base["Heading3"], fontName="Helvetica-Bold", fontSize=9.5, leading=12, textColor=colors.HexColor("#17110f"), spaceBefore=4, spaceAfter=2, keepWithNext=True),
        "body": ParagraphStyle("Body", parent=base["BodyText"], fontName="Helvetica", fontSize=8.5, leading=11.3, textColor=colors.HexColor("#292321"), spaceAfter=4),
        "small": ParagraphStyle("Small", parent=base["BodyText"], fontName="Helvetica", fontSize=7.8, leading=10, textColor=colors.HexColor("#4d4541"), spaceAfter=3),
        "bullet": ParagraphStyle("Bullet", parent=base["BodyText"], fontName="Helvetica", fontSize=8.2, leading=10.6, leftIndent=10, firstLineIndent=-6, bulletIndent=0, textColor=colors.HexColor("#292321"), spaceAfter=1.5),
        "footer": ParagraphStyle("Footer", parent=base["Normal"], fontName="Helvetica", fontSize=7, leading=8, alignment=TA_CENTER, textColor=colors.HexColor("#6f625c")),
    }


def bullets(items, styles, limit=None):
    selected = items[:limit] if limit else items
    return [Paragraph("• " + pdf_text(item), styles["bullet"]) for item in selected]


class CurriculumDoc(BaseDocTemplate):
    def __init__(self, filename, styles, **kwargs):
        super().__init__(filename, **kwargs)
        self.styles = styles
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="main")
        self.addPageTemplates(PageTemplate(id="curriculum", frames=frame, onPage=self.draw_page))

    def draw_page(self, canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#c72f75"))
        canvas.setLineWidth(0.8)
        canvas.line(self.leftMargin, A4[1] - 13 * mm, A4[0] - self.rightMargin, A4[1] - 13 * mm)
        footer = f"Renata Gomes Araujo | Currículo profissional | Página {doc.page}"
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#6f625c"))
        width = stringWidth(footer, "Helvetica", 7)
        canvas.drawString((A4[0] - width) / 2, 10 * mm, footer)
        canvas.restoreState()


def build_pdf(data):
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    styles = pdf_styles()
    identity = data["identity"]
    story = [
        Paragraph(pdf_text(identity["name"]), styles["name"]),
        Paragraph(pdf_text(identity["title"]), styles["title"]),
        Paragraph(pdf_text(identity["subtitle"]), styles["meta"]),
        Paragraph(pdf_text(identity["location"] + " | " + identity["availability"]), styles["meta"]),
        Paragraph(
            " | ".join(
                f'<link href="{escape(item["url"], quote=True)}" color="#8f2459">{pdf_text(item["value"])}</link>'
                for item in data["contacts"]
            ),
            styles["small"],
        ),
        Spacer(1, 3 * mm),
        Paragraph("RESUMO PROFISSIONAL", styles["h2"]),
        Paragraph(pdf_text(data["summary"]), styles["body"]),
        Paragraph(pdf_text(data["focus"]), styles["body"]),
        Paragraph("COMPETÊNCIAS PRINCIPAIS", styles["h2"]),
    ]
    for group in data["competencies"]:
        story.append(
            KeepTogether(
                [
                    Paragraph(pdf_text(group["title"]), styles["h3"]),
                    Paragraph(pdf_text("; ".join(group["items"])) + ".", styles["small"]),
                ]
            )
        )
    story.extend([PageBreak(), Paragraph("EXPERIÊNCIA PROFISSIONAL", styles["h2"])])
    for item in data["experience"]:
        heading = item["role"]
        if item.get("organization"):
            heading += " | " + item["organization"]
        story.append(
            KeepTogether(
                [
                    Paragraph(pdf_text(heading), styles["h3"]),
                    Paragraph(pdf_text(item["period"]), styles["small"]),
                    Paragraph(pdf_text(item["summary"]), styles["body"]),
                ]
                + bullets(item["highlights"], styles, limit=3)
            )
        )
        story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("FORMAÇÃO ACADÊMICA", styles["h2"]))
    for item in data["education"]:
        line = f'<b>{pdf_text(item["course"])}</b> - {pdf_text(item["status"])}'
        if item.get("year"):
            line += f" ({pdf_text(item['year'])})"
        if item.get("note"):
            line += f". {pdf_text(item['note'])}"
        story.append(Paragraph(line, styles["body"]))
    story.extend([PageBreak(), Paragraph("CURSOS E DESENVOLVIMENTO", styles["h2"])])
    for item in data["development"]:
        heading = item["course"]
        if item.get("institution"):
            heading += " | " + item["institution"]
        story.append(Paragraph(pdf_text(heading), styles["h3"]))
        story.append(Paragraph(pdf_text(item["status"]), styles["small"]))
        story.extend(bullets(item["topics"], styles))
    story.append(Paragraph("PROJETOS EM DESTAQUE", styles["h2"]))
    for item in data["projects"][:4]:
        story.append(
            KeepTogether(
                [
                    Paragraph(pdf_text(item["name"]), styles["h3"]),
                    Paragraph(
                        "<b>Contexto e solução:</b> "
                        + pdf_text(item["context"] + " " + item["solution"])
                        + " <b>Evidência:</b> "
                        + pdf_text(item["evidence"]),
                        styles["small"],
                    ),
                ]
            )
        )
    story.append(Paragraph("DIFERENCIAIS", styles["h2"]))
    story.extend(bullets(data["differentials"], styles, limit=5))
    doc = CurriculumDoc(
        str(PDF_PATH),
        styles,
        pagesize=A4,
        rightMargin=17 * mm,
        leftMargin=17 * mm,
        topMargin=18 * mm,
        bottomMargin=17 * mm,
        title=f"Currículo - {identity['name']}",
        author=identity["name"],
        subject="Currículo profissional",
        creator="Renata Join",
    )
    doc.build(story)


def main():
    data = load_data()
    HTML_PATH.write_text(build_html(data), encoding="utf-8")
    build_pdf(data)
    print(f"Gerado: {HTML_PATH.relative_to(ROOT)}")
    print(f"Gerado: {PDF_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
