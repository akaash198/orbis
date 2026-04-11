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
import importlib.util
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)
_HAS_REPORTLAB = importlib.util.find_spec("reportlab") is not None
_HAS_PYMUPDF = importlib.util.find_spec("fitz") is not None
_BACKEND_LOGGED = False

_MANDATORY_FIELDS = {
    "importer_name": "Importer Name",
    "importer_iec": "Importer IEC",
    "importer_address": "Importer Address",
    "bill_of_lading_number": "Bill of Lading Number",
    "invoice_number": "Invoice Number",
    "invoice_date": "Invoice Date",
    "hsn_code": "HSN Code",
    "description_of_goods": "Description of Goods",
    "country_of_origin": "Country of Origin",
    "port_of_import": "Port of Import",
    "port_of_shipment": "Port of Shipment",
    "arrival_date": "Arrival Date",
    "custom_value_inr": "Invoice/CIF Value (INR)",
    "custom_duty": "Custom Duty (INR)",
    "gst": "IGST/GST (INR)",
    "total_payable": "Total Payable (INR)",
}


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
    boe_fields = _prepare_download_fields(boe_fields, line_items, icegate_response)
    global _BACKEND_LOGGED
    if _HAS_REPORTLAB:
        try:
            return _generate_with_reportlab(boe_fields, line_items, icegate_response)
        except Exception as exc:
            logger.warning("[M05 PDF] ReportLab generation failed: %s — trying PyMuPDF fallback", exc)

    if _HAS_PYMUPDF:
        try:
            if not _BACKEND_LOGGED and not _HAS_REPORTLAB:
                logger.warning("[M05 PDF] ReportLab unavailable — using PyMuPDF fallback")
            _BACKEND_LOGGED = True
            return _generate_with_pymupdf(boe_fields, line_items, icegate_response)
        except Exception as exc:
            logger.warning("[M05 PDF] PyMuPDF fallback failed: %s — generating text fallback", exc)

    if not _BACKEND_LOGGED:
        logger.warning("[M05 PDF] Neither ReportLab nor PyMuPDF available — using text fallback")
        _BACKEND_LOGGED = True
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
    title_style = ParagraphStyle(
        "title",
        parent=styles["Heading1"],
        fontSize=20,
        leading=24,
        alignment=1,
        spaceAfter=6,
        textColor=colors.HexColor("#0f172a"),
    )
    subtitle_style = ParagraphStyle(
        "subtitle",
        parent=styles["Normal"],
        fontSize=9,
        alignment=1,
        textColor=colors.HexColor("#475569"),
        spaceAfter=6,
    )
    section_style = ParagraphStyle(
        "section",
        parent=styles["Heading2"],
        fontSize=11,
        leading=13,
        spaceBefore=10,
        spaceAfter=5,
        textColor=colors.HexColor("#1e3a8a"),
    )
    normal = ParagraphStyle("normal", parent=styles["Normal"], fontSize=9, leading=12)
    small = ParagraphStyle("small", parent=normal, fontSize=8, textColor=colors.HexColor("#64748b"))

    story = []

    # ── Title ────────────────────────────────────────────────────────────────
    story.append(Paragraph("Bill of Entry", title_style))
    story.append(Paragraph("Indian Customs Filing Document", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor("#1e3a8a")))
    story.append(Spacer(1, 6))

    # ── ICEGATE acknowledgement ──────────────────────────────────────────────
    if icegate_response:
        ack = str(icegate_response.get("ack_number", "") or "—")
        boe_num = str(icegate_response.get("boe_number", boe_fields.get("boe_number", "")) or "—")
        status = str(icegate_response.get("status", "") or "—")
        story.append(Paragraph(f"<b>BoE Number:</b> {boe_num} &nbsp;&nbsp; <b>Ack No.:</b> {ack} &nbsp;&nbsp; <b>Status:</b> {status}", normal))
        story.append(Spacer(1, 6))

    # ── Header table: Filing / Importer / Shipment ────────────────────────────
    def _v(key: str, default: str = "—") -> str:
        v = boe_fields.get(key)
        if v is None:
            return default
        s = str(v).strip()
        return s if s else default

    filing_data = [
        ["Date of Filing", _v("date_of_filing"), "Type of BoE", _v("boe_type", "HOME_CONSUMPTION")],
        ["Port of Import", _v("port_of_import"), "Arrival Date", _v("arrival_date")],
        ["Invoice Number", _v("invoice_number"), "Invoice Date", _v("invoice_date")],
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
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eff6ff")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#eff6ff")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
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

    # ── Mandatory customs information checklist ──────────────────────────────
    story.append(Paragraph("Mandatory Customs Information", section_style))
    mandatory_rows = [["Field", "Value", "Status"]]
    for key, label in _MANDATORY_FIELDS.items():
        val = boe_fields.get(key)
        if isinstance(val, (dict, list)):
            val_str = json.dumps(val, default=str)
        else:
            val_str = "—" if val is None or str(val).strip() == "" else str(val)
        status = "Present" if val_str != "—" else "Missing"
        mandatory_rows.append([label, val_str, status])

    mandatory_tbl = Table(mandatory_rows, colWidths=[6.5 * cm, 9.5 * cm, 2 * cm], repeatRows=1)
    mandatory_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    for r in range(1, len(mandatory_rows)):
        if mandatory_rows[r][2] == "Missing":
            mandatory_tbl.setStyle(TableStyle([
                ("TEXTCOLOR", (2, r), (2, r), colors.HexColor("#b91c1c")),
                ("BACKGROUND", (0, r), (-1, r), colors.HexColor("#fef2f2")),
            ]))
    story.append(mandatory_tbl)
    story.append(Spacer(1, 8))

    # ── All submitted fields (complete key/value map) ───────────────────────
    story.append(Paragraph("Submitted Fields", section_style))
    kv_rows = [["Field", "Value"]]
    for key in sorted(boe_fields.keys()):
        val_str = _format_field_value(boe_fields.get(key), max_len=180)
        kv_rows.append([str(key), val_str])

    kv_table = Table(kv_rows, colWidths=[7 * cm, 11 * cm], repeatRows=1)
    kv_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(kv_table)
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

    li_tbl = Table(li_rows, colWidths=[0.7 * cm, 7 * cm, 2.5 * cm, 2.5 * cm, 3.5 * cm, 3 * cm], repeatRows=1)
    li_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("PADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
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
        f"Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        ParagraphStyle("footer", parent=small, alignment=1),
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
        "MANDATORY CUSTOMS INFORMATION",
        "-" * 60,
    ]
    for key, label in _MANDATORY_FIELDS.items():
        val = boe_fields.get(key)
        v = str(val).strip() if val is not None and str(val).strip() else "MISSING"
        lines.append(f"  {label}: {v}")
    lines += [
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


def _format_field_value(value: Any, max_len: int = 180) -> str:
    """Fast, bounded serializer for PDF tables to avoid expensive large JSON dumps."""
    if value is None:
        return "—"
    if isinstance(value, dict):
        preview_keys = list(value.keys())[:8]
        suffix = "..." if len(value) > len(preview_keys) else ""
        out = f"<dict keys={preview_keys}{suffix}>"
    elif isinstance(value, list):
        out = f"<list len={len(value)}>"
    else:
        out = str(value).strip() or "—"
    if len(out) > max_len:
        return f"{out[: max_len - 3]}..."
    return out


def _prepare_download_fields(
    boe_fields: Dict[str, Any],
    line_items: List[Dict[str, Any]],
    icegate_response: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Ensure download output contains a complete mandatory customs set.
    Backfills missing header values from line items and response context.
    """
    out = dict(boe_fields or {})
    first_item = line_items[0] if line_items else {}

    def _pick(*vals):
        for v in vals:
            if v is None:
                continue
            s = str(v).strip()
            if s:
                return v
        return None

    def _is_zero_like(v: Any) -> bool:
        if v is None:
            return False
        if isinstance(v, str) and v.strip().lower() == "nil":
            return True
        try:
            return float(v) == 0.0
        except Exception:
            return False

    out["hsn_code"] = _pick(out.get("hsn_code"), first_item.get("hsn_code"))
    out["description_of_goods"] = _pick(
        out.get("description_of_goods"),
        first_item.get("description_of_goods"),
        first_item.get("product_description"),
    )
    out["country_of_origin"] = _pick(out.get("country_of_origin"), first_item.get("country_of_origin"))
    out["quantity"] = _pick(out.get("quantity"), first_item.get("quantity"))
    out["unit"] = _pick(out.get("unit"), first_item.get("unit"))
    out["custom_value_inr"] = _pick(
        out.get("custom_value_inr"),
        first_item.get("custom_value_inr"),
        first_item.get("assessable_value"),
    )
    out["custom_duty"] = _pick(out.get("custom_duty"), first_item.get("total_duty"))
    out["invoice_number"] = _pick(out.get("invoice_number"), out.get("commercial_invoice_number"))
    out["invoice_date"] = _pick(out.get("invoice_date"), out.get("date_of_invoice"))
    out["boe_number"] = _pick(out.get("boe_number"), (icegate_response or {}).get("boe_number"))
    # Display requirement: show zero BCD/SWS as "Nil" in BOE PDF
    if _is_zero_like(out.get("bcd_amount")):
        out["bcd_amount"] = "Nil"
    if _is_zero_like(out.get("sws_amount")):
        out["sws_amount"] = "Nil"

    if not _pick(out.get("total_payable")):
        try:
            cif = float(out.get("custom_value_inr") or 0)
            duty = float(out.get("custom_duty") or 0)
            out["total_payable"] = round(cif + duty, 2)
        except Exception:
            out["total_payable"] = out.get("total_payable")

    for key in _MANDATORY_FIELDS:
        out.setdefault(key, "")

    return out


def _generate_with_pymupdf(
    boe_fields: Dict[str, Any],
    line_items: List[Dict[str, Any]],
    icegate_response: Optional[Dict[str, Any]],
) -> bytes:
    """
    PDF fallback generator when ReportLab is unavailable.
    Produces a valid PDF using PyMuPDF (fitz).
    """
    import fitz  # PyMuPDF

    def _value(v: Any) -> str:
        if v is None:
            return "—"
        s = str(v).strip()
        return s if s else "—"

    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4 points

    y = 42
    left = 42
    right = 553
    line_h = 16

    # Title
    page.insert_text((left, y), "Bill of Entry", fontsize=22, fontname="helv")
    y += 24
    page.insert_text((left, y), "Indian Customs Filing Document", fontsize=10, fontname="helv")
    y += 12
    page.draw_line((left, y), (right, y), color=(0.12, 0.23, 0.54), width=1.0)
    y += 20

    if icegate_response:
        status = _value(icegate_response.get("status"))
        ack = _value(icegate_response.get("ack_number"))
        boe_num = _value(icegate_response.get("boe_number") or boe_fields.get("boe_number"))
        page.insert_text((left, y), f"Status: {status}   Ack No: {ack}   BoE No: {boe_num}", fontsize=9, fontname="helv")
        y += line_h

    # Render all fields
    page.insert_text((left, y), "Submitted Fields", fontsize=12, fontname="helv")
    y += 12
    page.draw_line((left, y), (right, y), color=(0.75, 0.8, 0.9), width=0.8)
    y += 10

    field_items = sorted(boe_fields.items(), key=lambda kv: kv[0])
    for k, v in field_items:
        v_str = _format_field_value(v, max_len=220)
        text = f"{k}: {v_str}"
        lines = [text[i:i + 110] for i in range(0, len(text), 110)] or ["—"]
        for ln in lines:
            if y > 790:
                page = doc.new_page(width=595, height=842)
                y = 42
            page.insert_text((left, y), ln, fontsize=8.5, fontname="cour")
            y += 11
        y += 2

    # Line items section
    if y > 700:
        page = doc.new_page(width=595, height=842)
        y = 42
    page.insert_text((left, y), "Line Items", fontsize=12, fontname="helv")
    y += 12
    page.draw_line((left, y), (right, y), color=(0.75, 0.8, 0.9), width=0.8)
    y += 10

    for idx, item in enumerate(line_items, start=1):
        desc = _value(item.get("description_of_goods") or item.get("product_description"))
        hsn = _value(item.get("hsn_code"))
        qty = f"{_value(item.get('quantity'))} {_value(item.get('unit'))}"
        duty = _value(item.get("total_duty"))
        row = f"{idx}. HSN={hsn} | Qty={qty} | Duty={duty} | Desc={desc}"
        lines = [row[i:i + 110] for i in range(0, len(row), 110)]
        for ln in lines:
            if y > 790:
                page = doc.new_page(width=595, height=842)
                y = 42
            page.insert_text((left, y), ln, fontsize=8.5, fontname="cour")
            y += 11
        y += 2

    # Footer
    stamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    if y > 810:
        page = doc.new_page(width=595, height=842)
        y = 42
    y += 8
    page.draw_line((left, y), (right, y), color=(0.8, 0.8, 0.8), width=0.6)
    y += 12
    page.insert_text((left, y), f"Generated on {stamp}", fontsize=8, fontname="helv")

    return doc.tobytes()
