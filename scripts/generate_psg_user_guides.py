from pathlib import Path
from html import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'artifacts' / 'PSG-User-Guides'
LOGO = ROOT / 'src' / 'public' / 'PSG favicon.png'
LOGIN_URL = 'https://colourpixdev.github.io/psgrebrand/#/login'
TUTORIAL_URL = 'https://drive.google.com/file/d/1pQvQXpgVhZs--PeN4vebP6CaFkeHktnm/view?usp=sharing'
SUPPORT_EMAIL = 'francois@colourpix.co.za'
TEMP_PASSWORD = 'PSG123'

USERS = [
    ('Aleza van Zyl', 'aleza.vanzyl@psg.co.za'),
    ('Judith Claassens', 'judith.claassens@psg.co.za'),
    ('Kweku Gavor', 'gavor.kweku@psg.co.za'),
    ('Sheyaam Hill', 'sheyaam.hill@psg.co.za'),
    ('Tharwah Solomon', 'tharwah.solomon@psg.co.za'),
]

SECTIONS = [
    ('Dashboard', 'See the current project snapshot, project counts, recent activity, and work that needs attention.'),
    ('Branches', 'Browse PSG branches and open the linked rebrand workspace for a branch.'),
    ('Projects', 'Review project status, dates, stages, tasks, files, comments, and the project journal.'),
    ('Reports', 'Filter project records and export report data to Excel or PDF.'),
    ('Search', 'Find visible projects by branch, town, status, stage, manager, or project reference.'),
    ('Your access', 'PSG users have view-only access. You cannot edit projects or branches, upload files, change stages, or delete records.'),
]


def make_styles():
    styles = getSampleStyleSheet()
    return {
        'title': ParagraphStyle('Title', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=21, leading=25, textColor=colors.HexColor('#0f3d56'), alignment=TA_CENTER, spaceAfter=5),
        'subtitle': ParagraphStyle('Subtitle', parent=styles['BodyText'], fontName='Helvetica', fontSize=9, leading=11, textColor=colors.HexColor('#475569'), alignment=TA_CENTER, spaceAfter=10),
        'heading': ParagraphStyle('Heading', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=colors.HexColor('#0f3d56'), spaceBefore=7, spaceAfter=4),
        'body': ParagraphStyle('Body', parent=styles['BodyText'], fontName='Helvetica', fontSize=8.5, leading=11, textColor=colors.HexColor('#334155'), spaceAfter=4),
        'small': ParagraphStyle('Small', parent=styles['BodyText'], fontName='Helvetica', fontSize=7.6, leading=9.5, textColor=colors.HexColor('#475569'), spaceAfter=3),
        'white': ParagraphStyle('White', parent=styles['BodyText'], fontName='Helvetica-Bold', fontSize=8.2, leading=10, textColor=colors.white),
    }


def p(text, style):
    return Paragraph(escape(text).replace('\n', '<br/>'), style)


def link(text, url, style):
    return Paragraph(f'<a href="{escape(url)}" color="#0f7894">{escape(text)}</a>', style)


def build_user_pdf(name, email):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    filename = OUTPUT / f'{name.lower().replace(" ", "-")}.pdf'
    styles = make_styles()
    doc = SimpleDocTemplate(str(filename), pagesize=A4, rightMargin=1.5 * cm, leftMargin=1.5 * cm, topMargin=1 * cm, bottomMargin=1.2 * cm, title=f'PSG Rebrand guide for {name}', author='Colourpix')
    story = []

    if LOGO.exists():
        logo = Image(str(LOGO))
        logo.drawHeight = 1.2 * cm
        logo.drawWidth = 1.2 * cm
        story.append(logo)
    story.append(Spacer(1, 0.15 * cm))
    story.append(p('PSG Rebrand Portal', styles['title']))
    story.append(p(f'Personal login and quick-start guide for {name}', styles['subtitle']))

    credentials = [
        [p('Your login', styles['white']), p('Details', styles['white'])],
        [p('Email', styles['body']), p(email, styles['body'])],
        [p('Temporary password', styles['body']), p(TEMP_PASSWORD, styles['body'])],
        [p('Login page', styles['body']), link(LOGIN_URL, LOGIN_URL, styles['small'])],
        [p('Role', styles['body']), p('PSG user', styles['body'])],
        [p('Tutorial video', styles['body']), link('Open tutorial video', TUTORIAL_URL, styles['small'])],
    ]
    table = Table(credentials, colWidths=[4.2 * cm, 13.2 * cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f3d56')),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f0f9ff')),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.2 * cm))
    story.append(p('The PSG Rebrand app is fully responsive and works perfectly on cell phones as well as desktop computers.', styles['body']))
    story.append(p('Please keep these login details private. The temporary password is provided for initial access. For a password change, email Francois at ', styles['body']))
    story.append(link(SUPPORT_EMAIL, f'mailto:{SUPPORT_EMAIL}', styles['body']))

    story.append(p('Start here', styles['heading']))
    steps = [
        'Open the login page and enter your PSG email address and temporary password.',
        'Start on Dashboard, then use the navigation to open Projects, Branches, Reports, or Search.',
        'Open a project to review its stage, status, dates, files, tasks, comments, and journal history.',
    ]
    story.append(p('\n'.join(f'{i}. {item}' for i, item in enumerate(steps, 1)), styles['body']))

    story.append(p('What you can do', styles['heading']))
    feature_rows = [[p('Area', styles['white']), p('Use it to', styles['white'])]]
    for area, description in SECTIONS:
        feature_rows.append([p(area, styles['body']), p(description, styles['body'])])
    feature_table = Table(feature_rows, colWidths=[4.2 * cm, 13.2 * cm])
    feature_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f7894')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0, 0), (-1, -1), 0.35, colors.HexColor('#d7e3ea')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(feature_table)

    story.append(p('Project workflow', styles['heading']))
    workflow = Table([
        [p('1. Find', styles['white']), p('2. Review', styles['white']), p('3. Act', styles['white']), p('4. Track', styles['white'])],
        [p('Use Search or Branches to locate the right project.', styles['small']), p('Open the project record and check status, dates, tasks, files, and comments.', styles['small']), p('Review the available project information and contact the workspace team when changes or uploads are needed.', styles['small']), p('Use Dashboard and Reports to monitor progress and export a clear summary.', styles['small'])],
    ], colWidths=[4.35 * cm] * 4)
    workflow.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f3d56')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f0f9ff')),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(workflow)
    story.append(Spacer(1, 0.25 * cm))
    story.append(p('Good practice', styles['heading']))
    story.append(p('Review project information carefully and contact the workspace team when a correction, stage change, or file upload is needed. Keep local copies of important files where required by your team.', styles['body']))
    story.append(p('Need help?', styles['heading']))
    story.append(p('For password changes or access problems, email ', styles['body']))
    story.append(link(SUPPORT_EMAIL, f'mailto:{SUPPORT_EMAIL}', styles['body']))
    story.append(p('. Include your full name and the email address used to sign in. Never send your current password in an email.', styles['body']))
    story.append(Spacer(1, 0.25 * cm))
    story.append(p('PSG Rebrand | Private workspace | PSG user access', styles['small']))
    doc.build(story)


if __name__ == '__main__':
    for user_name, user_email in USERS:
        build_user_pdf(user_name, user_email)
    print(f'Generated {len(USERS)} PDFs in {OUTPUT}')
