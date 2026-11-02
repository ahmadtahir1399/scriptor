"""
Builds a 4-page test thesis for the Reference Health feature.

Deliberate shape:
  p1  COVER
  p2  BODY   — 4 parenthetical citations
  p3  BODY   — 5 citations, then the "References" heading PARTWAY DOWN
              followed by the first 3 entries  (the layout that used to lose
              every entry above the page break)
  p4  the remaining 7 entries, wrapped across lines

Every citation is PARENTHETICAL on purpose. No other parenthesised four-digit
number appears anywhere in the body, so the extractor's citation count is exact.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak,
)

OUT = "reference-health-test-paper.pdf"

body = ParagraphStyle(
    "body", fontName="Times-Roman", fontSize=11, leading=15.5,
    spaceAfter=9, alignment=4,
)
h1 = ParagraphStyle(
    "h1", fontName="Times-Bold", fontSize=12.5, leading=17,
    spaceBefore=13, spaceAfter=7,
)
title = ParagraphStyle(
    "title", fontName="Times-Bold", fontSize=19, leading=25,
    alignment=1, spaceAfter=16,
)
sub = ParagraphStyle(
    "sub", fontName="Times-Roman", fontSize=12.5, leading=18, alignment=1,
)
ref = ParagraphStyle(
    "ref", fontName="Times-Roman", fontSize=10.5, leading=14.5,
    spaceAfter=7, alignment=0,
)

S = []

# ---------------------------------------------------------------- page 1
S += [
    Spacer(1, 5.2 * cm),
    Paragraph("Motivation, Judgement and Measurement in Hybrid Work", title),
    Paragraph("A Short Review of Competing Explanations", sub),
    Spacer(1, 3.4 * cm),
    Paragraph("A. T. Mahmood", sub),
    Spacer(1, 0.5 * cm),
    Paragraph("Department of Organisational Studies", sub),
    Spacer(1, 0.3 * cm),
    Paragraph("Submitted in partial fulfilment of the requirements", sub),
    Paragraph("for the degree of Master of Science", sub),
    PageBreak(),
]

# ---------------------------------------------------------------- page 2
S += [
    Paragraph("1. Introduction", h1),
    Paragraph(
        "The question of why people work hard when nobody is watching them has "
        "occupied organisational research for half a century, and it has "
        "acquired a new urgency now that a great deal of work is no longer "
        "watched at all. Two traditions dominate the literature. The first "
        "treats effort as a function of belief: a worker who expects to succeed "
        "invests more, and that expectation is itself built from prior "
        "experience of succeeding (Bandura, 1977). The second treats effort as "
        "a function of need: autonomy, competence and relatedness are satisfied "
        "or frustrated by the conditions of the job, and motivation follows "
        "(Deci &amp; Ryan, 2000).",
        body,
    ),
    Paragraph(
        "These are not rival theories so much as descriptions of different "
        "layers, and the present review treats them as complementary. What "
        "neither tradition anticipated is the measurement problem introduced by "
        "distributed work, where the observable signal of effort is thin and "
        "easily gamed.",
        body,
    ),
    Paragraph("2. Judgement under uncertainty", h1),
    Paragraph(
        "Any account of how managers respond to that thin signal must reckon "
        "with the systematic asymmetry between how losses and gains are "
        "weighed, which was set out most influentially in the framing of choice "
        "as a departure from expected-utility axioms (Kahneman &amp; Tversky, "
        "1979). Managers do not evaluate a distributed team against an absolute "
        "standard. They evaluate it against a reference point, usually the "
        "office arrangement that preceded it, and a loss relative to that point "
        "is felt more sharply than an equivalent gain.",
        body,
    ),
    Paragraph(
        "The historical literature offers a caution that is worth stating "
        "plainly even in a review of this kind. Institutions rarely fail "
        "because of a single shock; they fail because a sequence of "
        "individually defensible responses to successive shocks normalises the "
        "exception (Evans, 2003). The parallel to management practice is loose "
        "but not empty. Each individual concession to monitoring appears "
        "proportionate on its own terms, and the aggregate effect is to "
        "establish that autonomy is conditional.",
        body,
    ),
    PageBreak(),
]

# ---------------------------------------------------------------- page 3
S += [
    Paragraph("3. Instruments and evidence", h1),
    Paragraph(
        "Instrumented approaches to the measurement problem have multiplied. "
        "Scaffolding that adapts to a learner's demonstrated competence has "
        "been proposed as a template for adaptive management systems "
        "(Marchetti, 2021), and comparable techniques have been borrowed from "
        "environmental monitoring, where triage under sparse observation is a "
        "long-standing concern (Okonkwo, 2019). The transformer architectures "
        "that now underpin most of this instrumentation derive from a single "
        "widely cited paper (Vaswani et al., 2017), and their availability has "
        "made continuous inference cheap enough to deploy casually.",
        body,
    ),
    Paragraph(
        "Two qualifications should be entered. First, an earlier synthesis of "
        "agency and self-regulation anticipated much of the current discussion "
        "and is not always credited (Bandura, 1997). Second, the only "
        "longitudinal study to compare instrumented and non-instrumented teams "
        "in the same firm reports effects an order of magnitude smaller than "
        "the cross-sectional literature (Halvorsen, 2016).",
        body,
    ),
    Paragraph("4. Conclusion", h1),
    Paragraph(
        "The measurement problem is not solved by measuring harder. Belief and "
        "need remain the better predictors of sustained effort, and the "
        "instruments now available mostly measure the shadow that effort casts "
        "rather than effort itself. Further work should compare instrumented "
        "and non-instrumented teams within a single organisation over a full "
        "budget cycle.",
        body,
    ),
    Paragraph("References", h1),
    Paragraph(
        "Bandura, A. (1977). Self-efficacy: Toward a unifying theory of "
        "behavioral change. Psychological Review, 84(2), 191&#8211;215. "
        "https://doi.org/10.1037/0033-295X.84.2.191",
        ref,
    ),
    Paragraph(
        "Deci, E. L., &amp; Ryan, R. M. (2000). The what and why of goal "
        "pursuits: Human needs and the self-determination of behavior. "
        "Psychological Inquiry, 11(4), 227&#8211;268.",
        ref,
    ),
    Paragraph(
        "Evans, R. J. (2003). The Coming of the Third Reich. London: Penguin.",
        ref,
    ),
    PageBreak(),
]

# ---------------------------------------------------------------- page 4
S += [
    Paragraph(
        "International Organization for Standardization. (2008). Quantities and "
        "units &#8212; Part 13: Information science and technology "
        "(ISO 80000-13:2008). Geneva: ISO.",
        ref,
    ),
    Paragraph(
        "Kahneman, D., &amp; Tversky, A. (1979). Prospect theory: An analysis "
        "of decision under risk. Econometrica, 47(2), 263&#8211;291.",
        ref,
    ),
    Paragraph(
        "Lindqvist, S. (2022). Estimating hybrid work intensity from badge "
        "telemetry in mid-size firms (Working Paper No. 22-14). Stockholm "
        "Institute of Labour Studies.",
        ref,
    ),
    Paragraph(
        "Marchetti, L. (2021). Adaptive scaffolding in distributed learning "
        "environments. Journal of Digital Learning, 8(3), 44&#8211;61. "
        "https://doi.org/10.9999/jdle.2021.00427",
        ref,
    ),
    Paragraph(
        "Nowak, P. (2020). Chromatic drift compensation in longitudinal survey "
        "panels using inverse braid weighting. Quarterly Review of Survey "
        "Methods, 14(1), 5&#8211;29.",
        ref,
    ),
    Paragraph(
        "Okonkwo, R. T. (2019). Recursive heuristics for polychromatic sediment "
        "triage in urban watersheds. Journal of Applied Hydro-Informatics, "
        "12(4), 210&#8211;229.",
        ref,
    ),
    Paragraph(
        "Vaswani, A., Shazeer, N., &amp; Parmar, N. (2017). Attention is all "
        "you need. Advances in Neural Information Processing Systems, 30. "
        "https://doi.org/10.1037/0033-295X.84.2.191",
        ref,
    ),
]

doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=2.6 * cm, rightMargin=2.6 * cm,
    topMargin=2.4 * cm, bottomMargin=2.4 * cm,
    title="Motivation, Judgement and Measurement in Hybrid Work",
    author="A. T. Mahmood",
)
frame = Frame(
    doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f",
)
doc.addPageTemplates([PageTemplate(id="p", frames=[frame])])
doc.build(S)
print("wrote", OUT)
