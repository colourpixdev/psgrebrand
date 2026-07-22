from __future__ import annotations

from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "PSG Rebrand-Backup-Instructions.pdf"


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawRightString(doc.pagesize[0] - 1.5 * cm, 1.0 * cm, f"Page {doc.page}")
    canvas.restoreState()


def paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(text), style)


def command(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(text), style)


def add_section(story: list, title: str, items: list[str], title_style: ParagraphStyle, body_style: ParagraphStyle) -> None:
    story.append(Spacer(1, 0.25 * cm))
    story.append(paragraph(title, title_style))
    for item in items:
        story.append(paragraph(item, body_style))


def build_pdf() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title="PSG Rebrand Backup Instructions",
        author="GitHub Copilot",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "GuideTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=23,
        leading=29,
        textColor=colors.HexColor("#0f172a"),
        alignment=TA_CENTER,
        spaceAfter=8,
    )
    subtitle_style = ParagraphStyle(
        "GuideSubtitle",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        textColor=colors.HexColor("#475569"),
        alignment=TA_CENTER,
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=8,
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        "GuideBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.8,
        leading=14,
        textColor=colors.HexColor("#334155"),
        spaceAfter=5,
    )
    note_style = ParagraphStyle(
        "GuideNote",
        parent=body_style,
        textColor=colors.HexColor("#334155"),
        backColor=colors.HexColor("#f8fafc"),
        borderColor=colors.HexColor("#cbd5e1"),
        borderWidth=0.5,
        borderPadding=8,
        borderRadius=6,
        spaceAfter=8,
    )
    code_style = ParagraphStyle(
        "GuideCode",
        parent=body_style,
        fontName="Courier",
        fontSize=7.8,
        leading=10,
        textColor=colors.HexColor("#0f172a"),
        backColor=colors.HexColor("#eef2ff"),
        borderColor=colors.HexColor("#c7d2fe"),
        borderWidth=0.4,
        borderPadding=6,
        borderRadius=4,
        spaceAfter=7,
    )

    story: list = []
    story.append(paragraph("PSG Rebrand Backup Instructions", title_style))
    story.append(paragraph("GitHub Pages, Supabase database, user records, images, documents, and app email routing", subtitle_style))
    story.append(paragraph("Use this guide to create restorable backups for the PSG Rebrand workspace. Keep backup files in an encrypted location such as a protected external drive, company SharePoint, or a password-managed cloud vault. Do not store service-role keys, database passwords, API keys, or exported user data in a public repository.", note_style))

    add_section(story, "1. What Must Be Backed Up", [
        "- GitHub repository: source code, Supabase SQL files, Edge Functions, scripts, Vite configuration, website files, and GitHub Pages deployment settings.",
        "- Supabase database: public.projects, public.profiles, comments, tasks, activity, file metadata, workspace fields, and any future tables.",
        "- Supabase Auth: user accounts are managed by Supabase Auth; profiles are mirrored in public.profiles. Back up profiles with the database export and keep an admin list of Auth users separately.",
        "- Supabase Storage: project-files contains uploaded documents and images; voice-updates contains uploaded voice notes.",
        "- Edge Functions and secrets: invite-user, notify-project-change, transcribe-voice-update, plus configured secrets such as RESEND_API_KEY, PROJECT_NOTIFICATION_TO, PROJECT_NOTIFICATION_FROM, and transcription provider keys.",
        "- App email: PSG Rebrand user-facing mail now routes through rollout@colourpix.co.za for sending and receiving user communication.",
    ], section_style, body_style)

    add_section(story, "2. GitHub Pages and Repository Backup", [
        "- GitHub Pages is built from the repository. The most important backup is a complete clone of the Git repository, including all branches and tags.",
        "- Once a week, create a bare mirror clone and store it outside the working folder.",
    ], section_style, body_style)
    story.append(command("git clone --mirror https://github.com/francois2botha-star/rebrandreport.git backups/rebrandreport.git", code_style))
    story.append(command("cd backups/rebrandreport.git\ngit fetch --all --tags --prune", code_style))
    add_section(story, "Also Save These GitHub Settings", [
        "- GitHub Pages source settings: branch or GitHub Actions workflow used for deployment.",
        "- Repository secrets and variables: record the secret names, not the secret values. Secret values cannot be read back from GitHub, so store them separately in a password manager.",
        "- Custom domain and DNS records if a custom domain is later connected.",
        "- Release assets or manually uploaded files, if any are added later.",
    ], section_style, body_style)

    add_section(story, "3. Supabase SQL Database Backup", [
        "- Use Supabase CLI for a repeatable SQL dump. The command below was checked against the installed CLI in this workspace.",
        "- Run the command from the project folder after logging in to Supabase CLI and linking the project, or provide the database password when prompted.",
    ], section_style, body_style)
    story.append(command("npx supabase db dump --linked --file backups/supabase/psg-rebrand-full-YYYY-MM-DD.sql", code_style))
    story.append(command("npx supabase db dump --linked --data-only --use-copy --file backups/supabase/psg-rebrand-data-YYYY-MM-DD.sql", code_style))
    story.append(command("npx supabase db dump --linked --schema public --file backups/supabase/psg-rebrand-public-schema-YYYY-MM-DD.sql", code_style))
    add_section(story, "Database Restore Check", [
        "- At least monthly, restore the dump into a separate local or staging Supabase project and confirm the app can read projects, profiles, tasks, comments, and files metadata.",
        "- Never test restore into the production Supabase project unless you intentionally want to replace live data.",
    ], section_style, body_style)

    add_section(story, "4. Supabase Auth and Users", [
        "- The application profile data is backed up in public.profiles as part of the database dump.",
        "- Supabase Auth users live in the managed auth schema. Use the Supabase Dashboard to export or review the Auth user list when doing a user audit.",
        "- Keep a secure admin-only record of invited users, roles, branch scope, and whether each user should remain active.",
        "- Passwords cannot and should not be backed up. If Auth needs to be rebuilt, recreate or invite users and let them reset passwords.",
    ], section_style, body_style)

    add_section(story, "5. Images, Documents, and Voice Notes", [
        "- Uploaded project images and documents are stored in the private Supabase Storage bucket project-files.",
        "- Voice-note uploads are stored in the private Supabase Storage bucket voice-updates.",
        "- Use the Supabase Dashboard Storage page for manual download checks, or use the CLI recursive copy command below.",
    ], section_style, body_style)
    story.append(command("npx supabase storage cp -r --linked ss:///project-files backups/storage/project-files", code_style))
    story.append(command("npx supabase storage cp -r --linked ss:///voice-updates backups/storage/voice-updates", code_style))
    add_section(story, "Storage Restore Check", [
        "- Pick one PDF, one image, and one voice-note file from the backup and verify they open locally.",
        "- Keep storage backups and SQL backups from the same date together so file metadata in projects.files matches the downloaded objects.",
    ], section_style, body_style)

    add_section(story, "6. Edge Functions, Email, and Secrets", [
        "- Edge Function source is stored in supabase/functions and is covered by the GitHub repository backup.",
        "- Secret values are not readable after they are set. Record current values in a password manager, not in GitHub and not in the PDF.",
        "- The project notification function should use PROJECT_NOTIFICATION_TO=rollout@colourpix.co.za and PROJECT_NOTIFICATION_FROM=PSG Rebrand <rollout@colourpix.co.za>.",
        "- The email address rollout@colourpix.co.za must exist as a mailbox or alias that can receive replies from users.",
        "- For sending through Resend, verify colourpix.co.za or the exact sender address in Resend. If sender verification is missing, outbound email may fail even when the app code is correct.",
    ], section_style, body_style)
    story.append(command("npx supabase secrets set PROJECT_NOTIFICATION_TO=rollout@colourpix.co.za \"PROJECT_NOTIFICATION_FROM=PSG Rebrand <rollout@colourpix.co.za>\" --project-ref plqrjfylolaukazldnuz", code_style))

    add_section(story, "7. Recommended Backup Schedule", [
        "- Daily: Supabase database dump and Storage copy for project-files.",
        "- Weekly: GitHub repository mirror clone and voice-updates Storage copy.",
        "- Monthly: restore test into a separate staging project and verify login, project list, project detail, uploaded files, and notification email settings.",
        "- Before major changes: create an on-demand Git mirror, SQL dump, and Storage copy before importing data, changing RLS policies, changing Edge Functions, or clearing live data.",
    ], section_style, body_style)

    add_section(story, "8. One-Page Backup Checklist", [
        "1. Create backup folders for the current date.",
        "2. Run git fetch or git clone --mirror for the repository.",
        "3. Run Supabase db dump for schema and data.",
        "4. Copy project-files and voice-updates buckets.",
        "5. Export or audit Auth users in Supabase Dashboard.",
        "6. Record secret names and store secret values in the password manager.",
        "7. Confirm rollout@colourpix.co.za can receive mail and Resend can send from it.",
        "8. Open sample backup files and record the backup date, operator, and restore-test result.",
    ], section_style, body_style)

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)


if __name__ == "__main__":
    build_pdf()