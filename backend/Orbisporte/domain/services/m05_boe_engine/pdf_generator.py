"""
M05 — BoE PDF Generator  (SOP BOE-006)
=======================================
Generates a downloadable Bill of Entry PDF document from the filed BoE data.

Uses ReportLab for PDF generation. Falls back to a JSON-formatted text
if ReportLab is not installed.

Output format mirrors the standard Indian Customs BoE form layout:
  Page 1: Header (importer, shipment, financial summary)
  Page 2+: Line items table

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import io
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def generate_boe_pdf(
    boe_fields: Dict[str, Any],
    line_items: List[Dict[str, Any]],
    icegate_response: Optional[Dict[str, Any]] = None,
) -> bytes:
    """
    Generate a BoE PDF and return the raw bytes.

    Parameters
    ----------
    boe_fields        : All header-level BoE fields
    line_items        : List of line item dicts
    icegate_response  : Optional ICEGATE response (ack_number, boe_number, status)

    Returns
    -------
    bytes — PDF (or plain-text fallback) content
    """
    try:
        return _generate_with_reportlab(boe_fields, line_items, icegate_response)
    except ImportError:
        logger.warning("[M05 PDF] ReportLab not installed — generating text fallback")
        return _generate_text_fallback(boe_fields, line_items, icegate_response)


def _generate_with_reportlab(
    boe_fields: Dict[str, Any],
    line_items: List[Dict[str, Any]],
    icegate_response: Optional[Dict[str, Any]],
) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=14, spaceAfter=4,
                                 textColor=colors.HexColor("#1a3a5c"))
    section_style = ParagraphStyle("section", parent=styles["Heading2"], fontSize=10, spaceBefore=8, spaceAfter=4,
                                   textColor=colors.HexColor("#1a3a5c"))
    normal = styles["Normal"]
    small = ParagraphStyle("small", parent=normal, fontSize=8)

    story = []

    # ── Title ────────────────────────────────────────────────────────────────
    story.append(Paragraph("BILL OF ENTRY — INDIAN CUSTOMS", title_style))
    story.append(Paragraph("Government of India | Ministry of Finance | Dept. of Revenue", small))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1a3a5c")))
    story.append(Spacer(1, 6))

    # ── ICEGATE acknowledgement ──────────────────────────────────────────────
    if icegate_response:
        ack = icegate_response.get("ack_number", "")
        boe_num = icegate_response.get("boe_number", boe_fields.get("boe_number", ""))
        status = icegate_response.get("status", "")
        status_color = colors.green if status == "ACCEPTED" else colors.red
        story.append(Paragraph(f"<b>BoE Number:</b> {boe_num} &nbsp;&nbsp; "
                                f"<b>Ack No.:</b> {ack} &nbsp;&nbsp; "
                                f"<b>Status:</b> <font color='{status_color}'>{status}</font>", normal))
        story.append(Spacer(1, 6))

    # ── Header table: Filing / Importer / Shipment ────────────────────────────
    def _v(key: str, default: str = "—") -> str:
        v = boe_fields.get(key)
        return str(v).strip() if v else default

    filing_data = [
        ["Date of Filing", _v("date_of_filing"), "Type of BoE", _v("boe_type", "HOME_CONSUMPTION")],
        ["Port of Import", _v("port_of_import"), "Arrival Date", _v("arrival_date")],
    ]
    importer_data = [
        ["Importer Name", _v("importer_name"), "IEC", _v("importer_iec")],
        ["Address", _v("importer_address"), "GSTIN", _v("importer_gstin", "—")],
    ]
    shipment_data = [
        ["Bill of Lading No.", _v("bill_of_lading_number"), "Shipping Line", _v("shipping_line")],
        ["Port of Shipment", _v("port_of_shipment"), "Country of Origin", _v("country_of_origin")],
        ["Country of Shipment", _v("country_of_shipment"), "Currency", _v("currency", "USD")],
    ]

    def _build_kv_table(data, col_widths=None):
        col_widths = col_widths or [4 * cm, 8 * cm, 4 * cm, 8 * cm]
        tbl = Table(data, colWidths=col_widths)
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8f0fe")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#e8f0fe")),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
            ("PADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        return tbl

    story.append(Paragraph("Filing Details", section_style))
    story.append(_build_kv_table(filing_data))
    story.append(Spacer(1, 4))

    story.append(Paragraph("Importer Details", section_style))
    story.append(_build_kv_table(importer_data))
    story.append(Spacer(1, 4))

    story.append(Paragraph("Shipment Details", section_style))
    story.append(_build_kv_table(shipment_data))
    story.append(Spacer(1, 6))

    # ── Financial summary ─────────────────────────────────────────────────────
    def _inr(key: str) -> str:
        try:
            v = float(boe_fields.get(key) or 0)
            return f"₹{v:,.2f}"
        except (TypeError, ValueError):
            return "—"

    fin_data = [
        ["Custom Value (INR)", _inr("custom_value_inr"), "Custom Duty", _inr("custom_duty")],
        ["GST / IGST", _inr("gst"), "Total Payable", _inr("total_payable")],
    ]
    story.append(Paragraph("Financial Summary", section_style))
    story.append(_build_kv_table(fin_data))
    story.append(Spacer(1, 8))

    # ── Line items table ──────────────────────────────────────────────────────
    story.append(Paragraph("Line Items", section_style))

    li_headers = ["#", "Description", "HSN Code", "Qty / Unit", "CIF (INR)", "Duty (INR)"]
    li_rows = [li_headers]
    for idx, item in enumerate(line_items, start=1):
        desc = str(item.get("description_of_goods") or item.get("product_description") or "")[:60]
        hsn = str(item.get("hsn_code") or "")
        qty = f"{item.get('quantity', '')} {item.get('unit', 'NOS')}"
        try:
            cif = f"₹{float(item.get('custom_value_inr') or item.get('assessable_value') or 0):,.2f}"
        except (TypeError, ValueError):
            cif = "—"
        try:
            duty = f"₹{float(item.get('total_duty') or 0):,.2f}"
        except (TypeError, ValueError):
            duty = "—"
        li_rows.append([str(idx), desc, hsn, qty, cif, duty])

    li_tbl = Table(li_rows, colWidths=[0.7 * cm, 7 * cm, 2.5 * cm, 2.5 * cm, 3.5 * cm, 3 * cm])
    li_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a3a5c")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f8ff")]),
        ("PADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(li_tbl)
    story.append(Spacer(1, 12))

    # ── Signature block ───────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Spacer(1, 6))
    sig_data = [
        ["Importer Signature:", _v("importer_signature", "DIGITAL / PENDING"),
         "Custom Officer Signature:", _v("custom_officer_signature", "PENDING")],
        ["Custom Officer:", _v("custom_officer", "—"),
         "Date of Clearance:", _v("date_of_clearance", "PENDING")],
    ]
    story.append(_build_kv_table(sig_data))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"Generated by OrbisPorté — SPECTRA AI PTE. LTD., Singapore | {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        ParagraphStyle("footer", parent=small, textColor=colors.grey, alignment=1),
    ))

    doc.build(story)
    return buf.getvalue()


def _generate_text_fallback(
    boe_fields: Dict[str, Any],
    line_items: List[Dict[str, Any]],
    icegate_response: Optional[Dict[str, Any]],
) -> bytes:
    """Plain-text BoE when ReportLab is absent."""
    lines = [
        "BILL OF ENTRY — INDIAN CUSTOMS",
        "=" * 60,
        f"BoE Number     : {boe_fields.get('boe_number', '')}",
        f"Date of Filing : {boe_fields.get('date_of_filing', '')}",
        f"Port of Import : {boe_fields.get('port_of_import', '')}",
        f"Type           : {boe_fields.get('boe_type', 'HOME_CONSUMPTION')}",
        "",
        "IMPORTER",
        f"  Name    : {boe_fields.get('importer_name', '')}",
        f"  Address : {boe_fields.get('importer_address', '')}",
        f"  IEC     : {boe_fields.get('importer_iec', '')}",
        "",
        "SHIPMENT",
        f"  B/L No.          : {boe_fields.get('bill_of_lading_number', '')}",
        f"  Shipping Line    : {boe_fields.get('shipping_line', '')}",
        f"  Port of Shipment : {boe_fields.get('port_of_shipment', '')}",
        f"  Arrival Date     : {boe_fields.get('arrival_date', '')}",
        f"  Country of Origin: {boe_fields.get('country_of_origin', '')}",
        f"  Country of Ship. : {boe_fields.get('country_of_shipment', '')}",
        "",
        "FINANCIALS",
        f"  Custom Value (INR): {boe_fields.get('custom_value_inr', '')}",
        f"  Custom Duty       : {boe_fields.get('custom_duty', '')}",
        f"  GST               : {boe_fields.get('gst', '')}",
        f"  Total Payable     : {boe_fields.get('total_payable', '')}",
        "",
        "LINE ITEMS",
        "-" * 60,
    ]
    for idx, item in enumerate(line_items, start=1):
        lines.append(
            f"  {idx}. {item.get('description_of_goods') or item.get('product_description', '')} | "
            f"HSN: {item.get('hsn_code', '')} | "
            f"Qty: {item.get('quantity', '')} {item.get('unit', '')} | "
            f"Duty: {item.get('total_duty', '')}"
        )
    if icegate_response:
        lines += [
            "",
            "ICEGATE RESPONSE",
            f"  Status    : {icegate_response.get('status', '')}",
            f"  Ack No.   : {icegate_response.get('ack_number', '')}",
            f"  BoE Ref   : {icegate_response.get('boe_number', '')}",
        ]
    lines += [
        "",
        f"Generated: {datetime.utcnow().isoformat()} UTC",
        "OrbisPorté — SPECTRA AI PTE. LTD., Singapore",
    ]
    return "\n".join(lines).encode("utf-8")
