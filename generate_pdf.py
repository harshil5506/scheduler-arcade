import os
from reportlab.lib.pagesizes import letter, landscape, portrait
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from PIL import Image as PILImage

def build_pdf():
    img_path = r'C:\Users\Harshil Thakkar\.gemini\antigravity-ide\brain\7d2b4aa2-9f7c-457f-af1a-d7e9b3278895\cpu_scheduling_revision_chart_1791895637373.jpg'
    output_pdf = r'c:\Schedular Arcade\cpu_scheduling_revision_guide.pdf'
    chart_only_pdf = r'c:\Schedular Arcade\cpu_scheduling_concept_chart.pdf'

    # 1. Generate standalone Chart PDF (Full Page Landscape)
    im = PILImage.open(img_path)
    im.save(chart_only_pdf, 'PDF', resolution=100.0)
    print(f"Standalone chart PDF created: {chart_only_pdf}")

    # 2. Generate Complete Multi-page Revision Guide PDF (Chart + Comprehensive Notes)
    # Target size: Landscape Letter (11 x 8.5 inches = 792 x 612 pt)
    page_w, page_h = landscape(letter)

    doc = SimpleDocTemplate(
        output_pdf,
        pagesize=landscape(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0d1117'),
        spaceAfter=6
    )

    h2_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1f6feb'),
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#24292f')
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    story = []

    # --- PAGE 1: Full High-Res Revision Chart ---
    chart_title = Paragraph("<b>CPU SCHEDULING ALGORITHMS - REVISION CONCEPT CHART</b>", title_style)
    sub = Paragraph("<i>3rd-Year B.Tech Computer Science & Engineering - OS Viva & Exam Revision Guide</i>", body_style)
    story.append(chart_title)
    story.append(sub)
    story.append(Spacer(1, 8))

    # Available printable area: 792 - 72 = 720 width, 612 - 72 - 50 = ~490 height
    img_w, img_h = im.size
    aspect = img_w / img_h
    target_w = 720
    target_h = target_w / aspect
    if target_h > 470:
        target_h = 470
        target_w = target_h * aspect

    rl_img = RLImage(img_path, width=target_w, height=target_h)
    story.append(rl_img)
    story.append(PageBreak())

    # --- PAGE 2: Quick Reference Matrix & Mathematical Formulas ---
    story.append(Paragraph("<b>1. ALGORITHM COMPARISON MATRIX</b>", h2_style))

    table_data = [
        [
            Paragraph("<b>Algorithm</b>", body_bold),
            Paragraph("<b>Preemptive?</b>", body_bold),
            Paragraph("<b>Dispatch Criteria</b>", body_bold),
            Paragraph("<b>Optimal Advantage</b>", body_bold),
            Paragraph("<b>Primary Pitfall / Fix</b>", body_bold)
        ],
        [
            Paragraph("<b>FCFS</b>", body_bold),
            Paragraph("No", body_style),
            Paragraph("Earliest arrival in FIFO queue", body_style),
            Paragraph("Simple, 0 context-switch overhead", body_style),
            Paragraph("<b>Convoy Effect:</b> short jobs blocked by long CPU burst", body_style)
        ],
        [
            Paragraph("<b>SJF / SRTF</b>", body_bold),
            Paragraph("SJF: No<br/>SRTF: Yes", body_style),
            Paragraph("Minimum burst / remaining time", body_style),
            Paragraph("<b>Provably minimal avg WT</b>", body_style),
            Paragraph("<b>Starvation</b> of long jobs; requires burst prediction", body_style)
        ],
        [
            Paragraph("<b>Round Robin (RR)</b>", body_bold),
            Paragraph("Yes", body_style),
            Paragraph("FIFO rotation with time slice <i>q</i>", body_style),
            Paragraph("High responsiveness for interactive tasks", body_style),
            Paragraph("Small <i>q</i> creates heavy <b>context-switch tax</b>", body_style)
        ],
        [
            Paragraph("<b>Priority</b>", body_bold),
            Paragraph("Both supported", body_style),
            Paragraph("Highest rank (lowest integer value)", body_style),
            Paragraph("Enforces mission-critical execution", body_style),
            Paragraph("Starvation of low priority; Solved by <b>Aging</b>", body_style)
        ],
        [
            Paragraph("<b>MLFQ</b>", body_bold),
            Paragraph("Yes", body_style),
            Paragraph("Top priority tier down to bottom", body_style),
            Paragraph("Adapts automatically without advance burst knowledge", body_style),
            Paragraph("Parameter tuning sensitivity; Solved by <b>Periodic Boost</b>", body_style)
        ]
    ]

    col_widths = [110, 80, 150, 170, 210]
    t = Table(table_data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f6f8fa')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0d1117')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d0d7de')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    story.append(Paragraph("<b>2. CORE PERFORMANCE METRICS & FORMULAS</b>", h2_style))
    formulas_text = """
    • <b>Turnaround Time (TAT)</b> = Completion Time - Arrival Time &nbsp;&nbsp;|&nbsp;&nbsp; <i>Total time spent from submission to termination.</i><br/>
    • <b>Waiting Time (WT)</b> = Turnaround Time - Burst Time &nbsp;&nbsp;|&nbsp;&nbsp; <i>Total time spent idle inside the ready queue.</i><br/>
    • <b>Response Time (RT)</b> = First Execution Time - Arrival Time &nbsp;&nbsp;|&nbsp;&nbsp; <i>Crucial for time-sharing interactive operating systems.</i><br/>
    • <b>Exponential Burst Smoothing:</b> &tau;<sub>n+1</sub> = &alpha;&middot;t<sub>n</sub> + (1 - &alpha;)&middot;&tau;<sub>n</sub> &nbsp;&nbsp;|&nbsp;&nbsp; <i>Predicts next burst using historical weighted averages (&alpha; usually 0.5).</i><br/>
    • <b>Context Switch Rule of Thumb:</b> Set time quantum <i>q</i> such that 80% of CPU bursts are shorter than <i>q</i>.
    """
    story.append(Paragraph(formulas_text, body_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("<b>3. HIGH-YIELD VIVA QUESTIONS</b>", h2_style))
    viva_text = """
    <b>Q1: Why can't general-purpose operating systems directly implement pure SJF?</b><br/>
    <i>Ans:</i> Pure SJF requires exact advance knowledge of future CPU burst lengths, which is undecidable in general-purpose computing. Systems use exponential smoothing or MLFQ to approximate it dynamically.<br/><br/>
    <b>Q2: What is the Convoy Effect in FCFS and how does Round Robin eliminate it?</b><br/>
    <i>Ans:</i> The Convoy Effect occurs when a CPU-bound process with a huge burst monopolizes the processor, forcing multiple short I/O-bound jobs to wait. Round Robin pre-empts the heavy job after time <i>q</i>, allowing short jobs to run and proceed to I/O devices.<br/><br/>
    <b>Q3: How does Priority Aging prevent starvation?</b><br/>
    <i>Ans:</i> Aging gradually increments the priority of processes that have waited in the ready queue for a defined interval (e.g. +1 priority rank every <i>k</i> ticks). Eventually, even the lowest priority task reaches the highest rank and executes.
    """
    story.append(Paragraph(viva_text, body_style))

    doc.build(story)
    print(f"Comprehensive revision guide PDF created: {output_pdf}")

if __name__ == '__main__':
    build_pdf()
