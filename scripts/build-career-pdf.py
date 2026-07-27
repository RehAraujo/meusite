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
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = [
    ROOT / "public/documents/renata-gomes-araujo-curriculo-ats.pdf",
    ROOT / "output/pdf/renata-gomes-araujo-curriculo-ats.pdf",
]
PINK = colors.HexColor("#8E1749")
TEXT = colors.HexColor("#202020")
MUTED = colors.HexColor("#4A4A4A")


def styles():
    base = getSampleStyleSheet()
    return {
        "name": ParagraphStyle(
            "Name",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=20,
            textColor=TEXT,
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
        "role": ParagraphStyle(
            "Role",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=PINK,
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
        "contact": ParagraphStyle(
            "Contact",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.6,
            leading=10,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=7,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12,
            textColor=PINK,
            spaceBefore=5,
            spaceAfter=3,
            keepWithNext=True,
        ),
        "job": ParagraphStyle(
            "Job",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=8.6,
            leading=10.5,
            textColor=TEXT,
            spaceBefore=3,
            spaceAfter=1,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.7,
            leading=10.1,
            textColor=TEXT,
            spaceAfter=2.5,
        ),
        "compact": ParagraphStyle(
            "Compact",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.35,
            leading=9.4,
            leftIndent=8,
            firstLineIndent=-5,
            textColor=TEXT,
            spaceAfter=1.2,
        ),
    }


def section(title, style):
    return Paragraph(title.upper(), style["section"])


def bullet(text, style):
    return Paragraph(f"- {text}", style["compact"])


def footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D1D1D1"))
    canvas.line(18 * mm, 12 * mm, 192 * mm, 12 * mm)
    canvas.setFont("Helvetica", 6.8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 8 * mm, "Renata Gomes Araujo | Currículo profissional ATS")
    page = f"Página {document.page}"
    canvas.drawRightString(192 * mm, 8 * mm, page)
    canvas.restoreState()


def story():
    style = styles()
    content = [
        Paragraph("Renata Gomes Araujo", style["name"]),
        Paragraph("Analista de Soluções Digitais", style["role"]),
        Paragraph(
            "Brasília - Distrito Federal | Remoto | Híbrido | CLT, PJ e projetos<br/>"
            "renatajoin.com | linkedin.com/in/renatajoin | github.com/RehAraujo | "
            "+55 61 99219-1272",
            style["contact"],
        ),
        section("Resumo profissional", style),
        Paragraph(
            "Profissional formada em Análise e Desenvolvimento de Sistemas e Design Gráfico, "
            "com atuação na integração entre negócio, tecnologia, processos, comunicação e "
            "experiência do usuário. Compreende necessidades, organiza informações e traduz "
            "problemas pouco estruturados em requisitos, fluxos, documentação, sistemas e "
            "experiências digitais claras. Facilita a comunicação entre clientes, usuários, "
            "gestores e pessoas técnicas para apoiar decisões e construir soluções sustentáveis.",
            style["body"],
        ),
        section("Competencias", style),
        Paragraph(
            "<b>Negócio:</b> descoberta, entendimento de contexto, análise de necessidades, "
            "stakeholders, comunicação, planejamento e apoio à tomada de decisão.",
            style["body"],
        ),
        Paragraph(
            "<b>Produto:</b> levantamento de requisitos, requisitos funcionais e não funcionais, "
            "user stories, critérios de aceitação, documentação funcional, arquitetura da "
            "informação, UX e priorização.",
            style["body"],
        ),
        Paragraph(
            "<b>Processos:</b> mapeamento de processos, fluxogramas, melhoria contínua, Scrum, "
            "Kanban, Lean e fundamentos de PMBOK.",
            style["body"],
        ),
        Paragraph(
            "<b>Tecnologia:</b> React, JavaScript, HTML, CSS, Git, GitHub, Cloudflare, Notion, "
            "inteligência artificial aplicada e pensamento computacional.",
            style["body"],
        ),
        Paragraph(
            "<b>Design como diferencial:</b> experiência do usuário, hierarquia da informação, "
            "prototipação, interfaces, comunicação visual e Figma.",
            style["body"],
        ),
        section("Experiencia profissional", style),
        KeepTogether(
            [
                Paragraph(
                    "Profissional independente | Estratégia, Tecnologia e Processos | Atuação atual",
                    style["job"],
                ),
                bullet(
                    "Contexto: necessidades de profissionais e organizações ainda sem escopo, fluxo "
                    "ou linguagem comum para orientar uma solução.",
                    style,
                ),
                bullet(
                    "Atuação: descoberta, organização de informações, definição de prioridades, "
                    "arquitetura da informação e documentação.",
                    style,
                ),
                bullet(
                    "Soluções: sites, sistemas no Notion, CRM, dashboards, processos comerciais e "
                    "produtos digitais adequados a cada contexto.",
                    style,
                ),
                bullet(
                    "Impacto: informações mais compartilháveis, menor dependência da memória e "
                    "decisões e próximos passos mais claros.",
                    style,
                ),
            ]
        ),
        KeepTogether(
            [
                Paragraph(
                    "Analista de Comunicação, Processos e Soluções Digitais | Potência Solar | 2024 - 2026",
                    style["job"],
                ),
                bullet(
                    "Contexto: serviço técnico de alto investimento com informações comerciais "
                    "distribuídas e necessidade de comunicação compreensível.",
                    style,
                ),
                bullet(
                    "Atuação: mapeamento de necessidades entre gestão, operação, vendas e "
                    "comunicação; organização de funil, documentos e pontos de contato.",
                    style,
                ),
                bullet(
                    "Solução: CRM no Notion, estrutura comercial, relatórios, campanhas e tradução "
                    "de conteúdos técnicos para públicos não técnicos.",
                    style,
                ),
                bullet(
                    "Impacto: maior coerência entre comunicação e operação, com acompanhamento "
                    "comercial apoiado por informações centralizadas.",
                    style,
                ),
            ]
        ),
        PageBreak(),
        section("Experiência profissional - continuação", style),
        KeepTogether(
            [
                Paragraph("Comunicação Institucional e Design | VIJ/DF | Até janeiro de 2024", style["job"]),
                bullet(
                    "Contexto: demandas institucionais e informações sensíveis para públicos "
                    "distintos, com necessidade de clareza e responsabilidade.",
                    style,
                ),
                bullet(
                    "Atuação: interpretação de contexto, adaptação de linguagem, organização de "
                    "demandas e articulação entre áreas.",
                    style,
                ),
                bullet(
                    "Solução e impacto: materiais, campanhas e padrões de comunicação que tornaram "
                    "informações complexas mais compreensíveis sem perder o contexto institucional.",
                    style,
                ),
            ]
        ),
        section("Projetos selecionados", style),
        Paragraph(
            "<b>renatajoin.com:</b> produto, requisitos, arquitetura da informação, UX e "
            "implementação. Migração para React e Vite com componentes reutilizáveis, "
            "pré-renderização, testes, SEO, acessibilidade, GitHub Actions e Cloudflare.",
            style["body"],
        ),
        Paragraph(
            "<b>Sistemas de gestão no Notion:</b> descoberta, modelagem de informação, fluxos e "
            "implantação de CRM, financeiro, calendários, dashboards e bases de conhecimento.",
            style["body"],
        ),
        Paragraph(
            "<b>Potência Solar:</b> integração entre comunicação, CRM, documentação e processos "
            "para aproximar a experiência externa da realidade operacional.",
            style["body"],
        ),
        section("Formacao", style),
        Paragraph(
            "<b>Análise e Desenvolvimento de Sistemas</b> - Graduação concluída, 2025<br/>"
            "<b>Design Gráfico</b> - Graduação concluída, 2019",
            style["body"],
        ),
        section("Cursos e estudos atuais", style),
        Paragraph(
            "<b>Lógica de programação: explore funções e listas</b> - Alura - Certificação concluída<br/>"
            "<b>Pensamento Computacional: Fundamentos da Computação e Lógica de Programação</b> - "
            "Alura - Em andamento",
            style["body"],
        ),
        Paragraph(
            "Estudos atuais: pensamento computacional, React e JavaScript, segurança da informação, "
            "arquitetura de software e inteligência artificial aplicada.",
            style["body"],
        ),
        section("Tecnologias e ferramentas", style),
        Paragraph(
            "React | JavaScript | HTML | CSS | Git | GitHub | Cloudflare | Notion | Figma | "
            "GitHub Actions | Inteligência artificial aplicada | Excel | Visio | MS Project",
            style["body"],
        ),
        section("Filosofia de trabalho", style),
        Paragraph(
            "Clareza para decidir. Estrutura para construir. Simplicidade para continuar. Contexto "
            "vem antes da ferramenta, e documentação faz parte da solução.",
            style["body"],
        ),
        section("Contatos", style),
        Paragraph(
            "Site: renatajoin.com | LinkedIn: linkedin.com/in/renatajoin | "
            "GitHub: github.com/RehAraujo | Instagram: @renatajoin | "
            "WhatsApp profissional: +55 61 99219-1272",
            style["body"],
        ),
    ]
    return content


def build(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    document = BaseDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        title="Currículo ATS - Renata Gomes Araujo",
        author="Renata Gomes Araujo",
        subject="Currículo profissional para oportunidades em tecnologia e soluções digitais",
        creator="Renata Join",
    )
    frame = Frame(
        document.leftMargin,
        document.bottomMargin,
        document.width,
        document.height,
        id="body",
    )
    document.addPageTemplates(PageTemplate(id="ats", frames=[frame], onPage=footer))
    document.build(story())
    if stringWidth("Analista de Soluções Digitais", "Helvetica-Bold", 10) <= 0:
        raise RuntimeError("Falha ao validar a fonte do PDF.")


for output in OUTPUTS:
    build(output)
    print(output)
