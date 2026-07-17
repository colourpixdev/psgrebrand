from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, PageBreak


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "artifacts" / "screenshots"
OUTPUT = ROOT / "artifacts" / "PSG-Rollout-Portal-Guide.pdf"


SECTIONS = [
    {
        "title": "Login",
        "file": "login.png",
        "description": "Secure entry point for Supabase sign-in, with role preview buttons for local testing.",
    },
    {
        "title": "Dashboard",
        "file": "dashboard.png",
        "description": "A summary view of project counts, recent activity, and today's actions.",
    },
    {
        "title": "Projects",
        "file": "projects.png",
        "description": "The core rollout board where projects are reviewed, filtered, and created.",
    },
    {
        "title": "Project Detail",
        "file": "project-detail.png",
        "description": "The full record for one rollout, including files, notes, timeline, and communication log.",
    },
    {
        "title": "Reports",
        "file": "reports.png",
        "description": "Report cards for exports and operational summaries.",
    },
    {
        "title": "Users",
        "file": "users.png",
        "description": "User profile management for Colourpix, PSG staff, and sign company roles.",
    },
    {
        "title": "Settings",
        "file": "settings.png",
        "description": "Authentication and security settings with Supabase environment guidance.",
    },
    {
        "title": "Search",
        "file": "search.png",
        "description": "Searchable project cards for branch, town, province, installer, status, and ID.",
    },
    {
        "title": "Map",
        "file": "map.png",
        "description": "A geographic-style summary of branches and their rollout status.",
    },
]


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawRightString(doc.pagesize[0] - 1.5 * cm, 1.0 * cm, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf() -> None:
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title="PSG Rollout Portal Guide",
        author="GitHub Copilot",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "GuideTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=30,
        textColor=colors.HexColor("#0f172a"),
        alignment=TA_CENTER,
        spaceAfter=10,
    )
    subtitle_style = ParagraphStyle(
        "GuideSubtitle",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#475569"),
        alignment=TA_CENTER,
        spaceAfter=14,
    )
    section_title_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "GuideBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        textColor=colors.HexColor("#334155"),
        spaceAfter=8,
    )
    note_style = ParagraphStyle(
        "GuideNote",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#475569"),
        backColor=colors.HexColor("#f8fafc"),
        borderColor=colors.HexColor("#cbd5e1"),
        borderWidth=0.5,
        borderPadding=8,
        borderRadius=6,
        spaceAfter=10,
    )

    story = []

    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph("PSG Signage Rollout Portal", title_style))
    story.append(Paragraph("Screenshots, feature summary, and usage guide", subtitle_style))
    story.append(Paragraph(
        "This portal manages rollout projects for PSG signage work. It tracks projects from intake through installation, shows dashboard metrics, stores notes and files, and supports live reads and writes through Supabase.",
        body_style,
    ))
    story.append(Paragraph(
        "How to use it: sign in with a Supabase user, open Projects to add a rollout, open Users to add user profiles, then use Search, Reports, and Map to review the live dataset. The dashboard gives a quick snapshot of the work queue and recent activity.",
        body_style,
    ))
    story.append(Spacer(1, 0.3 * cm))

    quick_start = [
        "1. Sign in on the Login page with Supabase credentials or use the role preview buttons for a local session.",
        "2. Add a rollout from the Projects page using the create form.",
        "3. Add a user profile from the Users page so the profile table stays in sync with Auth.",
        "4. Use the Dashboard, Search, Reports, and Map pages to monitor progress and find records quickly.",
    ]
    for item in quick_start:
        story.append(Paragraph(item, body_style))

    story.append(Spacer(1, 0.25 * cm))
    story.append(Paragraph("Captured Pages", section_title_style))

    for index, section in enumerate(SECTIONS):
        image_path = SCREENSHOTS / section["file"]
        if not image_path.exists():
            continue

        if index > 0:
            story.append(PageBreak())

        story.append(Paragraph(section["title"], section_title_style))
        story.append(Paragraph(section["description"], note_style))

        image = Image(str(image_path))
        max_width = doc.width
        max_height = 18.5 * cm
        scale = min(max_width / image.imageWidth, max_height / image.imageHeight)
        image.drawWidth = image.imageWidth * scale
        image.drawHeight = image.imageHeight * scale
        story.append(image)
        story.append(Spacer(1, 0.35 * cm))

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)


if __name__ == "__main__":
    build_pdf()