"""Inkwell — PDF Studio · stateless serverless edition for Vercel.

Every request carries the PDF bytes up; the function transforms them and
returns the new bytes. Nothing is written to disk — each invocation is
isolated and stateless, which is exactly what serverless wants.
"""
import base64
import io
import json
import math
import re
import zipfile
from pathlib import Path

import pymupdf as fitz
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import Response

app = FastAPI(title="Inkwell — PDF Studio (online)", version="1.0.0")

MAX_BYTES = 4_300_000  # Vercel Hobby caps request bodies at 4.5 MB
MAX_PAGE_RENDER_ZOOM = 2.5


def err(status: int, detail: str):
    return Response(json.dumps({"detail": detail}), status_code=status,
                    media_type="application/json")


async def load_pdf(file: UploadFile, password: str | None = None) -> fitz.Document:
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise ValueError("File too large for the online version (max ≈ 4 MB). Use the desktop build for bigger PDFs.")
    doc = fitz.open(stream=data, filetype="pdf")
    doc._byte_len = len(data)
    if doc.needs_pass:
        if password and doc.authenticate(password):
            doc._user_pw = password
        else:
            doc.close()
            raise ValueError("This PDF is password protected — enter its password to open it.")
    else:
        doc._user_pw = None
    return doc


def info_dict(doc: fitz.Document) -> dict:
    meta = doc.metadata or {}
    return {
        "pages": doc.page_count,
        "size_bytes": getattr(doc, "_byte_len", 0),
        "encrypted": bool(doc.is_encrypted),
        "field_count": sum(len(list(p.widgets())) for p in doc),
        "metadata": {k: (v or "") for k, v in meta.items()},
    }


def stream_pdf(doc: fitz.Document) -> Response:
    """Serialize, re-applying the session password if the doc was opened with one."""
    pw = getattr(doc, "_user_pw", None)
    page_count = doc.page_count
    if pw:
        raw = doc.tobytes(garbage=3, deflate=True, clean=True,
                          encryption=fitz.PDF_ENCRYPT_AES_256,
                          user_pw=pw, owner_pw=pw,
                          permissions=fitz.PDF_PERM_PRINT | fitz.PDF_PERM_COPY | fitz.PDF_PERM_ANNOTATE)
    else:
        raw = doc.tobytes(garbage=3, deflate=True, clean=True)
    doc.close()
    headers = {
        "X-Page-Count": str(page_count),
        "X-Size-Bytes": str(len(raw)),
        "X-Encrypted": "1" if pw else "0",
    }
    return Response(content=raw, media_type="application/pdf", headers=headers)


def params_dict(params: str) -> dict:
    try:
        return json.loads(params or "{}")
    except json.JSONDecodeError:
        return {}


@app.get("/api/health")
def health():
    return {"ok": True, "service": "Inkwell — PDF Studio (online)"}


@app.post("/api/op/sample")
def make_sample():
    doc = make_sample_document()
    raw = doc.tobytes(garbage=3, deflate=True)
    pages = doc.page_count
    doc.close()
    return Response(content=raw, media_type="application/pdf",
                    headers={"X-Page-Count": str(pages), "X-Size-Bytes": str(len(raw)), "X-Encrypted": "0"})


@app.post("/api/op/info")
async def op_info(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    try:
        return info_dict(doc)
    finally:
        doc.close()


@app.post("/api/op/page-image")
async def op_page_image(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    try:
        page = int(p.get("page", 1))
        zoom = max(0.1, min(float(p.get("zoom", 0.62)), MAX_PAGE_RENDER_ZOOM))
        if page < 1 or page > doc.page_count:
            return err(400, f"Page {page} does not exist.")
        pg = doc.load_page(page - 1)
        png_bytes = None
        for z in (zoom, max(0.1, zoom / 2), max(0.1, zoom / 4)):
            try:
                pix = pg.get_pixmap(matrix=fitz.Matrix(z, z), alpha=False)
                png_bytes = pix.tobytes("png")
                break
            except Exception:  # giant scanned pages — fall back to smaller renders
                png_bytes = None
        if png_bytes is None:
            return err(500, f"Couldn't render page {page} at any zoom level.")
        return Response(content=png_bytes, media_type="image/png",
                        headers={"Cache-Control": "no-store"})
    finally:
        doc.close()


@app.post("/api/op/fields")
async def op_fields(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    try:
        type_names = {fitz.PDF_WIDGET_TYPE_TEXT: "text", fitz.PDF_WIDGET_TYPE_CHECKBOX: "checkbox",
                      fitz.PDF_WIDGET_TYPE_RADIOBUTTON: "radio", fitz.PDF_WIDGET_TYPE_COMBOBOX: "combobox",
                      fitz.PDF_WIDGET_TYPE_LISTBOX: "listbox", fitz.PDF_WIDGET_TYPE_BUTTON: "button",
                      fitz.PDF_WIDGET_TYPE_SIGNATURE: "signature"}
        fields, seen = [], set()
        for page in doc:
            for w in page.widgets():
                if not w.field_name or w.field_name in seen:
                    continue
                seen.add(w.field_name)
                value = w.field_value
                if w.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
                    value = bool(value) and str(value).lower() not in ("off", "false", "no", "0")
                else:
                    value = "" if value is None else str(value)
                ftype = type_names.get(w.field_type, "text")
                entry = {"page": page.number + 1, "name": w.field_name, "type": ftype,
                         "value": value, "label": (getattr(w, "field_label", None) or w.field_name)}
                if ftype in ("combobox", "listbox", "radio"):
                    entry["choices"] = list(getattr(w, "choice_values", None) or getattr(w, "button_states", None) or [])
                fields.append(entry)
        return {"fields": fields}
    finally:
        doc.close()


def simple_pages(p: dict, n: int):
    pages = sorted({int(x) for x in p.get("pages", [])})
    if not pages:
        return None, "Select at least one page."
    bad = [x for x in pages if x < 1 or x > n]
    if bad:
        return None, f"Page(s) out of range: {bad}"
    return pages, None


@app.post("/api/op/rotate")
async def op_rotate(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    try:
        pages, e_msg = simple_pages(p, doc.page_count)
        if e_msg:
            return err(400, e_msg)
        angle = int(p.get("angle", 90))
        for page in pages:
            pg = doc.load_page(page - 1)
            pg.set_rotation((pg.rotation + angle) % 360)
        return stream_pdf(doc)
    finally:
        try:
            if not doc.is_closed:
                doc.close()
        except Exception:
            pass


@app.post("/api/op/delete")
async def op_delete(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    try:
        pages, e_msg = simple_pages(p, doc.page_count)
        if e_msg:
            return err(400, e_msg)
        if len(pages) >= doc.page_count:
            return err(400, "A PDF needs at least one page.")
        doc.delete_pages([x - 1 for x in pages])
        return stream_pdf(doc)
    finally:
        try:
            if not doc.is_closed:
                doc.close()
        except Exception:
            pass


@app.post("/api/op/reorder")
async def op_reorder(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    order = [int(x) for x in p.get("order", [])]
    n = doc.page_count
    if sorted(order) != list(range(1, n + 1)):
        doc.close()
        return err(400, "Order must be a permutation of all pages.")
    new = fitz.open()
    for pg in order:
        new.insert_pdf(doc, from_page=pg - 1, to_page=pg - 1)
    new._user_pw = getattr(doc, "_user_pw", None)
    doc.close()
    return stream_pdf(new)


@app.post("/api/op/extract")
async def op_extract(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    pages, e_msg = simple_pages(p, doc.page_count)
    if e_msg:
        doc.close()
        return err(400, e_msg)
    new = fitz.open()
    for pg in pages:
        new.insert_pdf(doc, from_page=pg - 1, to_page=pg - 1)
    new._user_pw = getattr(doc, "_user_pw", None)
    doc.close()
    return stream_pdf(new)


@app.post("/api/op/insert")
async def op_insert(file: UploadFile = File(...), source: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    try:
        src = await load_pdf(source, p.get("source_password"))
    except ValueError as e:
        doc.close()
        return err(400, f"Inserted PDF: {e}")
    at = int(p.get("at", doc.page_count + 1))
    if at < 1 or at > doc.page_count + 1:
        doc.close(); src.close()
        return err(400, f"Insert position must be 1–{doc.page_count + 1}.")
    doc.insert_pdf(src, start_at=at - 1)
    src.close()
    return stream_pdf(doc)


@app.post("/api/op/merge")
async def op_merge(file: UploadFile = File(...),
                   others: list[UploadFile] = File(default=[]),
                   params: str = Form("{}")):
    """Merge the current PDF with any number of uploaded PDFs (multipart field 'others').

    Everything is streamed through memory; nothing touches disk. Each input is
    capped at MAX_BYTES, and Vercel additionally caps the whole request body
    at ~4.5 MB, which bounds how much merging can fit in one request.
    """
    p = params_dict(params)
    include_current = bool(p.get("include_current", True))
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    pw = getattr(doc, "_user_pw", None)
    new = fitz.open()
    try:
        if include_current:
            new.insert_pdf(doc)
        for extra in others or []:
            try:
                src = await load_pdf(extra, None)
            except ValueError as e:
                return err(400, f"“{extra.filename or 'PDF'}”: {e}")
            new.insert_pdf(src)
            src.close()
        if new.page_count == 0:
            return err(400, "Nothing to merge — include the current document or add at least one PDF.")
        new._user_pw = pw
        return stream_pdf(new)
    finally:
        doc.close()
        if not new.is_closed:
            new.close()


@app.post("/api/op/split")
async def op_split(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    spec = (p.get("ranges") or "").strip()
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    import re as _re
    parts = []
    try:
        for chunk in spec.split(","):
            chunk = chunk.strip()
            if not chunk:
                continue
            m = _re.fullmatch(r"(\d+)\s*-\s*(\d+)", chunk)
            if m:
                a, b = int(m.group(1)), int(m.group(2))
            elif _re.fullmatch(r"\d+", chunk):
                a = b = int(chunk)
            else:
                return err(400, f"Couldn't parse “{chunk}” — use like 1-3, 5, 8-10")
            a, b = max(1, a), min(doc.page_count, b)
            if a > b:
                a, b = b, a
            parts.append((a, b))
        if not parts:
            return err(400, "Enter a page range, e.g. 1-3, 5, 8-10")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, (a, b) in enumerate(parts, 1):
                part = fitz.open()
                part.insert_pdf(doc, from_page=a - 1, to_page=b - 1)
                raw = part.tobytes(garbage=3, deflate=True)
                part.close()
                label = f"pages-{a}-{b}" if a != b else f"page-{a}"
                zf.writestr(f"split-part-{i}-{label}.pdf", raw)
        return Response(content=buf.getvalue(), media_type="application/zip",
                        headers={"Content-Disposition": 'attachment; filename="inkwell-split.zip"'})
    finally:
        doc.close()


@app.post("/api/op/fill")
async def op_fill(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    values = p.get("values", {})
    flatten = bool(p.get("flatten", False))
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    try:
        count = 0
        for page in doc:
            for w in page.widgets():
                if w.field_name in values:
                    val = values[w.field_name]
                    if w.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
                        w.field_value = bool(val) if isinstance(val, bool) else str(val).lower() in ("true", "1", "yes", "on")
                    else:
                        w.field_value = "" if val is None else str(val)
                    w.update()
                    count += 1
        if flatten:
            doc.bake(annots=False, widgets=True)
        resp = stream_pdf(doc)
        doc = None
        return resp
    finally:
        try:
            if doc is not None and not doc.is_closed:
                doc.close()
        except Exception:
            pass


@app.post("/api/op/stamp")
async def op_stamp(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    raw_b64 = p.get("image_base64", "")
    if "," in raw_b64 and raw_b64.split(",", 1)[0].startswith("data:"):
        raw_b64 = raw_b64.split(",", 1)[1]
    try:
        image_bytes = base64.b64decode(raw_b64, validate=True)
    except Exception:
        return err(400, "Signature image is not valid base64.")
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    n = doc.page_count
    if p.get("all_pages"):
        targets = list(range(1, n + 1))
    else:
        targets, e_msg = simple_pages({"pages": p.get("pages") or ([p.get("page")] if p.get("page") else [])}, n)
        if e_msg:
            doc.close()
            return err(400, e_msg)
    try:
        fx = min(max(float(p.get("x", 0.1)), 0.0), 0.95)
        fy = min(max(float(p.get("y", 0.8)), 0.0), 0.95)
        fw = min(max(float(p.get("width", 0.35)), 0.02), 1 - fx)
        fh = min(max(float(p.get("height", 0.12)), 0.02), 1 - fy)
        for pg in targets:
            page = doc.load_page(pg - 1)
            r = page.rect
            rect = fitz.Rect(fx * r.width, fy * r.height, (fx + fw) * r.width, (fy + fh) * r.height)
            page.insert_image(rect, stream=image_bytes, overlay=True)
        return stream_pdf(doc)
    finally:
        try:
            if not doc.is_closed:
                doc.close()
        except Exception:
            pass


def _hex_to_rgb(hex_color: str):
    h = (hex_color or "#808080").lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except Exception:
        return (0.5, 0.5, 0.5)


@app.post("/api/op/watermark")
async def op_watermark(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    text = (p.get("text") or "CONFIDENTIAL").strip() or "CONFIDENTIAL"
    size = int(max(8, min(int(p.get("size", 54)), 220)))
    opacity = max(0.02, min(float(p.get("opacity", 0.16)), 1.0))
    angle = float(p.get("angle", -45))
    color = _hex_to_rgb(p.get("color"))
    tiled = bool(p.get("tiled", False))
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    if p.get("all_pages", True):
        targets = list(range(1, doc.page_count + 1))
    else:
        targets, e_msg = simple_pages(p, doc.page_count)
        if e_msg:
            doc.close()
            return err(400, e_msg)
    font = _ed_bundled_measure_font()
    rad = math.radians(angle)
    d = (math.cos(rad), math.sin(rad))
    rad_m = math.radians(-angle)
    cm, sm = math.cos(rad_m), math.sin(rad_m)
    morph_matrix = fitz.Matrix(-angle)
    try:
        for pg in targets:
            page = doc.load_page(pg - 1)
            r = page.rect
            centers = [(r.width / 2, r.height / 2)]
            if tiled:
                centers = [(r.width * fx, r.height * fy) for fx in (0.2, 0.5, 0.8) for fy in (0.22, 0.5, 0.78)]
            font_size = max(8, size // (2 if tiled else 1))
            for cx, cy in centers:
                w = font.text_length(text, fontsize=font_size)
                sx, sy = cx - d[0] * w / 2, cy - d[1] * w / 2 + font_size * 0.35
                raw = fitz.Point(sx * cm - sy * sm, sx * sm + sy * cm)
                tw = fitz.TextWriter(page.rect)
                tw.append(raw, text, font=font, fontsize=font_size)
                tw.write_text(page, color=color, opacity=opacity, morph=(fitz.Point(0, 0), morph_matrix))
        return stream_pdf(doc)
    finally:
        try:
            if not doc.is_closed:
                doc.close()
        except Exception:
            pass


@app.post("/api/op/metadata")
async def op_metadata(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    meta = dict(doc.metadata or {})
    for k in ("title", "author", "subject", "keywords", "creator", "producer"):
        if k in p and p[k] is not None:
            meta[k] = str(p[k])
    meta["modDate"] = fitz.get_pdf_now()
    doc.set_metadata(meta)
    return stream_pdf(doc)


@app.post("/api/op/encrypt")
async def op_encrypt(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    user_pw = (p.get("user_password") or "").strip()
    if len(user_pw) < 3:
        return err(400, "Password must be at least 3 characters.")
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    page_count = doc.page_count
    raw = doc.tobytes(garbage=3, deflate=True, clean=True,
                      encryption=fitz.PDF_ENCRYPT_AES_256,
                      user_pw=user_pw,
                      owner_pw=(p.get("owner_password") or "").strip() or user_pw,
                      permissions=fitz.PDF_PERM_PRINT | fitz.PDF_PERM_COPY | fitz.PDF_PERM_ANNOTATE)
    doc.close()
    return Response(content=raw, media_type="application/pdf",
                    headers={"X-Page-Count": str(page_count), "X-Size-Bytes": str(len(raw)), "X-Encrypted": "1"})


@app.post("/api/op/decrypt")
async def op_decrypt(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    doc._user_pw = None
    return stream_pdf(doc)


@app.post("/api/op/optimize")
async def op_optimize(file: UploadFile = File(...), params: str = Form("{}")):
    p = params_dict(params)
    quality = int(max(30, min(int(p.get("image_quality", 72)), 95)))
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    try:
        if hasattr(doc, "subset_fonts"):
            try:
                doc.subset_fonts()
            except Exception:
                pass
        if p.get("recompress_images"):
            try:
                doc.rewrite_images(dpi_threshold=110, dpi_target=150, quality=quality,
                                   lossy=True, lossless=True, gray=True, color=True)
            except Exception:
                pass
        page_count = doc.page_count
        raw = doc.tobytes(garbage=4, deflate=True, clean=True,
                          deflate_images=True, deflate_fonts=True, use_objstms=1)
        doc.close()
        return Response(content=raw, media_type="application/pdf",
                        headers={"X-Page-Count": str(page_count), "X-Size-Bytes": str(len(raw)), "X-Encrypted": "0"})
    finally:
        try:
            if not doc.is_closed:
                doc.close()
        except Exception:
            pass


# ───────────────────────────── sample doc ─────────────────────────────

def make_sample_document() -> fitz.Document:
    doc = fitz.open()
    p = doc.new_page(width=595, height=842)
    p.draw_rect(fitz.Rect(0, 0, 595, 210), color=None, fill=(0.72, 0.11, 0.11))
    p.draw_rect(fitz.Rect(0, 206, 595, 212), color=None, fill=(0.937, 0.267, 0.267))
    p.insert_text((56, 96), "INKWELL", fontsize=15, fontname="hebo", color=(1, 0.82, 0.82))
    p.insert_text((56, 138), "Sample Document", fontsize=34, fontname="hebo", color=(1, 1, 1))
    p.insert_text((56, 172), "The online edition — nothing is stored on any server", fontsize=12, fontname="helv", color=(1, 0.88, 0.88))
    y = 260
    for heading, body in [
        ("1. Organize", "Drag thumbnails to reorder, rotate, delete, extract, insert and merge pages."),
        ("2. Forms", "Page 2 is a live AcroForm — open Forms, type values, apply."),
        ("3. Sign", "Create a signature, click a spot on the page, confirm with the green check."),
        ("4. Protect & Optimize", "Encrypt with AES-256, watermark, scrub metadata and shrink the file."),
    ]:
        p.insert_text((56, y), heading, fontsize=15, fontname="hebo", color=(0.25, 0.13, 0.15))
        y += 20
        for line in _wrap(body, 74):
            p.insert_text((56, y), line, fontsize=11, fontname="helv", color=(0.38, 0.29, 0.29))
            y += 16
        y += 14

    p = doc.new_page(width=595, height=842)
    p.insert_text((56, 72), "Interactive Form", fontsize=22, fontname="hebo", color=(0.25, 0.13, 0.15))
    p.insert_text((56, 94), "Fill these with the Forms panel:", fontsize=10, fontname="helv", color=(0.56, 0.46, 0.46))

    def text_widget(name, rect, multiline=False):
        w = fitz.Widget()
        w.field_name = name
        w.field_type = fitz.PDF_WIDGET_TYPE_TEXT
        w.rect = fitz.Rect(*rect)
        w.field_value = ""
        w.text_fontsize = 11
        w.text_color = (0.18, 0.13, 0.13)
        w.fill_color = (0.99, 0.96, 0.96)
        w.border_color = (0.87, 0.75, 0.75)
        if multiline:
            w.field_flags = fitz.PDF_TX_FIELD_IS_MULTILINE
        p.add_widget(w)

    def label(text, ypos):
        p.insert_text((56, ypos), text, fontsize=10, fontname="hebo", color=(0.36, 0.27, 0.29))

    label("Full name", 140);          text_widget("full_name", (56, 148, 340, 172))
    label("Email", 200);              text_widget("email", (56, 208, 340, 232))
    label("Company", 260);            text_widget("company", (56, 268, 340, 292))
    label("Notes", 320);              text_widget("notes", (56, 328, 540, 420), multiline=True)

    cb = fitz.Widget()
    cb.field_name = "newsletter"
    cb.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
    cb.rect = fitz.Rect(56, 452, 74, 470)
    cb.field_value = False
    p.add_widget(cb)
    p.insert_text((84, 466), "Subscribe me to the Inkwell newsletter", fontsize=11, fontname="helv", color=(0.32, 0.24, 0.25))

    label("Plan", 512)
    combo = fitz.Widget()
    combo.field_name = "plan"
    combo.field_type = fitz.PDF_WIDGET_TYPE_COMBOBOX
    combo.rect = fitz.Rect(56, 520, 260, 546)
    combo.choice_values = ["Studio", "Pro", "Enterprise"]
    combo.field_value = "Pro"
    combo.text_fontsize = 11
    combo.fill_color = (0.99, 0.96, 0.96)
    combo.border_color = (0.87, 0.75, 0.75)
    p.add_widget(combo)

    label("Signature", 600)
    p.draw_line(fitz.Point(56, 660), fitz.Point(340, 660), color=(0.55, 0.43, 0.43), width=1)
    p.insert_text((56, 676), "Use the Sign panel to stamp your signature above the line.", fontsize=9, fontname="helv", color=(0.62, 0.52, 0.52))

    p = doc.new_page(width=595, height=842)
    p.insert_text((56, 72), "Quarterly Snapshot", fontsize=22, fontname="hebo", color=(0.25, 0.13, 0.15))
    p.insert_text((56, 94), "Placeholder chart — try the watermark and optimize tools on it", fontsize=10, fontname="helv", color=(0.56, 0.46, 0.46))
    bars = [("Q1", 0.42, (0.937, 0.267, 0.267)), ("Q2", 0.66, (0.863, 0.149, 0.149)), ("Q3", 0.54, (0.973, 0.443, 0.443)), ("Q4", 0.83, (0.498, 0.114, 0.114))]
    base_y = 640
    p.draw_line(fitz.Point(72, base_y), fitz.Point(539, base_y), color=(0.82, 0.73, 0.73), width=1.5)
    for i, (q, frac, col) in enumerate(bars):
        bw, gap = 74, 52
        x = 92 + i * (bw + gap)
        bh = 380 * frac
        p.draw_rect(fitz.Rect(x, base_y - bh, x + bw, base_y), color=None, fill=col)
        p.insert_text((x + bw / 2 - 8, base_y + 22), q, fontsize=12, fontname="hebo", color=(0.55, 0.43, 0.43))
        p.insert_text((x + bw / 2 - 16, base_y - bh - 10), f"{int(frac * 100)}%", fontsize=10, fontname="hebo", color=(0.47, 0.35, 0.35))
    return doc


def _wrap(text: str, width: int):
    words, lines, cur = text.split(), [], ""
    for word in words:
        if len(cur) + len(word) + 1 <= width:
            cur = f"{cur} {word}".strip()
        else:
            lines.append(cur); cur = word
    if cur:
        lines.append(cur)
    return lines



# ───────────────────────────── inline editor ─────────────────────────────

# ---------------------------------------------------------------- font pack ---
# Picker labels keep the requested names; bundled faces are free, open,
# metric-compatible or lookalike substitutes — see fonts/FONTS.md + licenses.

def _inkwell_fonts_dir():
    """Locate the bundled open fonts."""
    here = Path(__file__).resolve().parent
    for candidate in (here / "static" / "fonts",           # local edition
                      here.parent / "public" / "fonts",     # online (repo root)
                      here / "fonts",                       # alongside the function
                      here.parent / "src" / "public" / "fonts",   # online (src/ layout)
                      here.parent.parent / "src" / "public" / "fonts",
                      Path("/var/task/public/fonts"),
                      Path("/var/task/src/public/fonts")):
        if (candidate.is_dir()
                and (any(candidate.glob("*.ttf")) or any(candidate.glob("*.otf")))):
            return candidate
    return None


_INKWELL_FONTS_DIR = _inkwell_fonts_dir()

_FONT_FACES = {
    "arial": {"regular": "Arimo-Regular.ttf", "bold": "Arimo-Bold.ttf", "italic": "Arimo-Italic.ttf", "bolditalic": "Arimo-BoldItalic.ttf"},
    "helvetica": {"regular": "NimbusSans-Regular.otf", "bold": "NimbusSans-Bold.otf", "italic": "NimbusSans-Italic.otf", "bolditalic": "NimbusSans-BoldItalic.otf"},
    "times-new-roman": {"regular": "Tinos-Regular.ttf", "bold": "Tinos-Bold.ttf", "italic": "Tinos-Italic.ttf", "bolditalic": "Tinos-BoldItalic.ttf"},
    "calibri": {"regular": "Carlito-Regular.ttf", "bold": "Carlito-Bold.ttf", "italic": "Carlito-Italic.ttf", "bolditalic": "Carlito-BoldItalic.ttf"},
    "roboto": {"regular": "Roboto-Regular.ttf", "bold": "Roboto-Bold.ttf", "italic": "Roboto-Italic.ttf", "bolditalic": "Roboto-BoldItalic.ttf"},
    "open-sans": {"regular": "OpenSans-Regular.ttf", "bold": "OpenSans-Bold.ttf", "italic": "OpenSans-Italic.ttf", "bolditalic": "OpenSans-BoldItalic.ttf"},
    "georgia": {"regular": "Gelasio-Regular.ttf", "bold": "Gelasio-Bold.ttf", "italic": "Gelasio-Italic.ttf", "bolditalic": "Gelasio-BoldItalic.ttf"},
    "verdana": {"regular": "DejaVuSans.ttf", "bold": "DejaVuSans-Bold.ttf", "italic": "DejaVuSans-Oblique.ttf", "bolditalic": "DejaVuSans-BoldOblique.ttf"},
    "garamond": {"regular": "EBGaramond-Regular.ttf", "bold": "EBGaramond-Bold.ttf", "italic": "EBGaramond-Italic.ttf", "bolditalic": "EBGaramond-BoldItalic.ttf"},
    "montserrat": {"regular": "Montserrat-Regular.ttf", "bold": "Montserrat-Bold.ttf", "italic": "Montserrat-Italic.ttf", "bolditalic": "Montserrat-BoldItalic.ttf"},
    "futura": {"regular": "Jost-Regular.ttf", "bold": "Jost-Bold.ttf", "italic": "Jost-Italic.ttf", "bolditalic": "Jost-BoldItalic.ttf"},
    "lato": {"regular": "Lato-Regular.ttf", "bold": "Lato-Bold.ttf", "italic": "Lato-Italic.ttf", "bolditalic": "Lato-BoldItalic.ttf"},
    "segoe-ui": {"regular": "Selawik-Regular.ttf", "bold": "Selawik-Bold.ttf", "italic": "Selawik-Regular.ttf", "bolditalic": "Selawik-Bold.ttf"},
    "cambria": {"regular": "Caladea-Regular.ttf", "bold": "Caladea-Bold.ttf", "italic": "Caladea-Italic.ttf", "bolditalic": "Caladea-BoldItalic.ttf"},
    "courier-new": {"regular": "Cousine-Regular.ttf", "bold": "Cousine-Bold.ttf", "italic": "Cousine-Italic.ttf", "bolditalic": "Cousine-BoldItalic.ttf"},
    "tahoma": {"regular": "PTSans-Regular.ttf", "bold": "PTSans-Bold.ttf", "italic": "PTSans-Italic.ttf", "bolditalic": "PTSans-BoldItalic.ttf"},
    "trebuchet-ms": {"regular": "FiraSans-Regular.ttf", "bold": "FiraSans-Bold.ttf", "italic": "FiraSans-Italic.ttf", "bolditalic": "FiraSans-BoldItalic.ttf"},
    "century-gothic": {"regular": "LeagueSpartan-Regular.ttf", "bold": "LeagueSpartan-Bold.ttf", "italic": "LeagueSpartan-Regular.ttf", "bolditalic": "LeagueSpartan-Bold.ttf"},
    "gill-sans": {"regular": "AlegreyaSans-Regular.ttf", "bold": "AlegreyaSans-Bold.ttf", "italic": "AlegreyaSans-Italic.ttf", "bolditalic": "AlegreyaSans-BoldItalic.ttf"},
    "franklin-gothic": {"regular": "LibreFranklin-Regular.ttf", "bold": "LibreFranklin-Bold.ttf", "italic": "LibreFranklin-Italic.ttf", "bolditalic": "LibreFranklin-BoldItalic.ttf"},
    "palatino-linotype": {"regular": "Pagella-Regular.otf", "bold": "Pagella-Bold.otf", "italic": "Pagella-Italic.otf", "bolditalic": "Pagella-BoldItalic.otf"},
    "book-antiqua": {"regular": "P052-Roman.otf", "bold": "P052-Bold.otf", "italic": "P052-Italic.otf", "bolditalic": "P052-BoldItalic.otf"},
    "impact": {"regular": "Anton-Regular.ttf", "bold": "Anton-Regular.ttf", "italic": "Anton-Regular.ttf", "bolditalic": "Anton-Regular.ttf"},
    "comic-sans-ms": {"regular": "ComicNeue-Regular.ttf", "bold": "ComicNeue-Bold.ttf", "italic": "ComicNeue-Italic.ttf", "bolditalic": "ComicNeue-BoldItalic.ttf"},
    "lucida-console": {"regular": "DejaVuSansMono.ttf", "bold": "DejaVuSansMono-Bold.ttf", "italic": "DejaVuSansMono-Oblique.ttf", "bolditalic": "DejaVuSansMono-BoldOblique.ttf"},
    "consolas": {"regular": "Inconsolata-Regular.ttf", "bold": "Inconsolata-Bold.ttf", "italic": "Inconsolata-Regular.ttf", "bolditalic": "Inconsolata-Bold.ttf"},
    "inter": {"regular": "Inter-Regular.ttf", "bold": "Inter-Bold.ttf", "italic": "Inter-Italic.ttf", "bolditalic": "Inter-BoldItalic.ttf"},
    "poppins": {"regular": "Poppins-Regular.ttf", "bold": "Poppins-Bold.ttf", "italic": "Poppins-Italic.ttf", "bolditalic": "Poppins-BoldItalic.ttf"},
    "source-sans-pro": {"regular": "SourceSansPro-Regular.ttf", "bold": "SourceSansPro-Bold.ttf", "italic": "SourceSansPro-Italic.ttf", "bolditalic": "SourceSansPro-BoldItalic.ttf"},
    "playfair-display": {"regular": "PlayfairDisplay-Regular.ttf", "bold": "PlayfairDisplay-Bold.ttf", "italic": "PlayfairDisplay-Italic.ttf", "bolditalic": "PlayfairDisplay-BoldItalic.ttf"},
    "merriweather": {"regular": "Merriweather-Regular.ttf", "bold": "Merriweather-Bold.ttf", "italic": "Merriweather-Italic.ttf", "bolditalic": "Merriweather-BoldItalic.ttf"},
    "ocr-a": {"regular": "OCRA-Regular.ttf", "bold": "OCRA-Bold.ttf", "italic": "OCRA-Italic.ttf", "bolditalic": "OCRA-Bold.ttf"},
    "ocr-b": {"regular": "OCRB-Regular.otf", "bold": "OCRB-Regular.otf", "italic": "OCRB-Oblique.otf", "bolditalic": "OCRB-Oblique.otf"},
    "ocr-a-extended": {"regular": "OCRA-Regular.ttf", "bold": "OCRA-Bold.ttf", "italic": "OCRA-Italic.ttf", "bolditalic": "OCRA-Bold.ttf"},
    "micr-cmc-7": {"regular": "CMC7-Regular.ttf", "bold": "CMC7-Regular.ttf", "italic": "CMC7-Regular.ttf", "bolditalic": "CMC7-Regular.ttf"},
    "farrington-7b": {"regular": "Farrington7B-Regular.ttf", "bold": "Farrington7B-Regular.ttf", "italic": "Farrington7B-Regular.ttf", "bolditalic": "Farrington7B-Regular.ttf"},
}
_FONT_ALIASES = [
    ("arimo", "arial"),
    ("arial", "arial"),
    ("nimbussans", "helvetica"),
    ("helvetica", "helvetica"),
    ("helv", "helvetica"),
    ("tinos", "times-new-roman"),
    ("timesnewroman", "times-new-roman"),
    ("times-roman", "times-new-roman"),
    ("times", "times-new-roman"),
    ("carlito", "calibri"),
    ("calibri", "calibri"),
    ("roboto", "roboto"),
    ("opensans", "open-sans"),
    ("open-sans", "open-sans"),
    ("gelasio", "georgia"),
    ("georgia", "georgia"),
    ("dejavusans", "verdana"),
    ("verdana", "verdana"),
    ("ebgaramond", "garamond"),
    ("garamond", "garamond"),
    ("montserrat", "montserrat"),
    ("jost", "futura"),
    ("futura", "futura"),
    ("lato", "lato"),
    ("selawik", "segoe-ui"),
    ("selawk", "segoe-ui"),
    ("segoeui", "segoe-ui"),
    ("segoe", "segoe-ui"),
    ("caladea", "cambria"),
    ("cambria", "cambria"),
    ("cousine", "courier-new"),
    ("couriernew", "courier-new"),
    ("courier", "courier-new"),
    ("ptsans", "tahoma"),
    ("tahoma", "tahoma"),
    ("firasans", "trebuchet-ms"),
    ("trebuchet", "trebuchet-ms"),
    ("leaguespartan", "century-gothic"),
    ("centurygothic", "century-gothic"),
    ("alegreyasans", "gill-sans"),
    ("gillsans", "gill-sans"),
    ("librefranklin", "franklin-gothic"),
    ("franklingothic", "franklin-gothic"),
    ("franklin", "franklin-gothic"),
    ("pagella", "palatino-linotype"),
    ("texgyrepagella", "palatino-linotype"),
    ("palatino", "palatino-linotype"),
    ("p052", "book-antiqua"),
    ("bookantiqua", "book-antiqua"),
    ("anton", "impact"),
    ("impact", "impact"),
    ("comicneue", "comic-sans-ms"),
    ("comicsans", "comic-sans-ms"),
    ("dejavusansmono", "lucida-console"),
    ("lucidaconsole", "lucida-console"),
    ("lucida", "lucida-console"),
    ("inconsolata", "consolas"),
    ("consolas", "consolas"),
    ("inter", "inter"),
    ("poppins", "poppins"),
    ("sourcesans", "source-sans-pro"),
    ("sourcesans3", "source-sans-pro"),
    ("playfair", "playfair-display"),
    ("merriweather", "merriweather"),
    ("ocra", "ocr-a"),
    ("ocrb", "ocr-b"),
    ("ocraextended", "ocr-a-extended"),
    ("cmc7", "micr-cmc-7"),
    ("cmc-7", "micr-cmc-7"),
    ("farrington", "farrington-7b"),
]
_LEGACY_FAMILY = {"sans": "helvetica", "serif": "times-new-roman", "mono": "courier-new"}

_FONT_ALIAS_LOOKUP = sorted(
    ((("".join(ch for ch in a.lower() if ch.isalnum())), k) for a, k in _FONT_ALIASES),
    key=lambda t: -len(t[0]),
)


def _ed_norm_family(family: str) -> str:
    fam = (family or "").lower().strip()
    fam = _LEGACY_FAMILY.get(fam, fam)
    return fam if fam in _FONT_FACES else "helvetica"


def _ed_font_ref(family: str, bold: bool, italic: bool):
    """(fontname, fontfile) for text insertion — pymupdf embeds the bundled face."""
    key = _ed_norm_family(family)
    bold = bool(bold)
    italic = bool(italic)
    face = "bolditalic" if (bold and italic) else "bold" if bold else "italic" if italic else "regular"
    fname = _FONT_FACES[key].get(face) or _FONT_FACES[key]["regular"]
    d = _INKWELL_FONTS_DIR
    if d:
        p = d / fname
        if p.is_file():
            fontname = "Inkwell" + "".join(part.capitalize() for part in key.split("-"))
            return fontname, str(p)
    return "helv", None


def _ed_bundled_measure_font():
    """Metrics matching the embedded faces (watermark width)."""
    d = _INKWELL_FONTS_DIR
    if d:
        p = d / "NimbusSans-Regular.otf"
        if p.is_file():
            try:
                return fitz.Font(fontfile=str(p))
            except Exception:
                pass
    return fitz.Font("helv")


def _ed_family_from_font(name: str) -> str:
    n = (name or "").lower()
    if "+" in n:                       # subset prefix, e.g. "ABCDEF+Arimo-Bold"
        n = n.split("+", 1)[1]
    n = "".join(ch for ch in n if ch.isalnum())
    for alias, key in _FONT_ALIAS_LOOKUP:
        if alias in n:
            return key
    if any(k in n for k in ("courier", "monaco", "menlo", "consol", "mono")):
        return "courier-new"
    if any(k in n for k in ("times", "serif", "georgia", "roman", "garamond", "p052")):
        return "times-new-roman"
    return "helvetica"


def _hex_color(value) -> str:
    try:
        v = int(value) & 0xFFFFFF
        return f"#{v:06x}"
    except Exception:
        return "#000000"


@app.post("/api/op/page-text")
async def op_page_text(file: UploadFile = File(...), params: str = Form("{}")):
    """Line boxes + style info for one page — the editor overlays inputs on them."""
    p = params_dict(params)
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    try:
        page_no = int(p.get("page", 1))
        if page_no < 1 or page_no > doc.page_count:
            return err(400, f"Page {page_no} does not exist.")
        page = doc.load_page(page_no - 1)
        raw = page.get_text("dict")
        spans_out = []
        sid = 0
        for block in raw.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                l_spans = line.get("spans", [])
                if not l_spans:
                    continue
                x0 = y0 = float("inf")
                x1 = y1 = float("-inf")
                text = ""
                max_size = 0.0
                bold = italic = False
                color = 0
                family = "sans"
                origin = None
                for s in l_spans:
                    b = s.get("bbox") or (0, 0, 0, 0)
                    x0, y0 = min(x0, b[0]), min(y0, b[1])
                    x1, y1 = max(x1, b[2]), max(y1, b[3])
                    text += s.get("text", "")
                    max_size = max(max_size, float(s.get("size", 0)))
                    flags = int(s.get("flags", 0))
                    bold = bold or bool(flags & 2 ** 4) or "bold" in (s.get("font") or "").lower()
                    italic = italic or bool(flags & 2 ** 1) or "italic" in (s.get("font") or "").lower() or "oblique" in (s.get("font") or "").lower()
                    if origin is None:
                        origin = s.get("origin") or (b[0], b[3])
                        color = int(s.get("color", 0))
                        family = _ed_family_from_font(s.get("font"))
                text = text.strip()
                if not text:
                    continue
                spans_out.append({
                    "id": sid,
                    "rect": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
                    "origin": [round(origin[0], 2), round(origin[1], 2)],
                    "text": text,
                    "size": round(max_size, 2),
                    "color": _hex_color(color),
                    "family": family,
                    "bold": bool(bold),
                    "italic": bool(italic),
                })
                sid += 1
        return {
            "page_width": round(page.rect.width, 2),
            "page_height": round(page.rect.height, 2),
            "page_rotation": page.rotation,
            "spans": spans_out,
        }
    finally:
        doc.close()


def _validate_image_bytes(img: bytes):
    if img.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if img.startswith(b"\xff\xd8\xff"):
        return True
    return False


def _place_image(page, e: dict):
    raw_b64 = e.get("image_b64", "")
    if "," in raw_b64 and raw_b64.split(",", 1)[0].startswith("data:"):
        raw_b64 = raw_b64.split(",", 1)[1]
    if len(raw_b64) > 3_000_000:
        raise ValueError("One of the images is too large (max ~2 MB each).")
    try:
        img = base64.b64decode(raw_b64, validate=True)
    except Exception:
        raise ValueError("An image could not be decoded (bad base64).")
    if not _validate_image_bytes(img):
        raise ValueError("Images must be PNG or JPEG.")
    r = e.get("rect") or [10, 10, 110, 110]
    if len(r) != 4:
        raise ValueError("Image rect must be [x0, y0, x1, y1].")
    rect = fitz.Rect(float(r[0]), float(r[1]), float(r[2]), float(r[3]))
    if rect.is_empty or rect.width < 2 or rect.height < 2:
        raise ValueError("Image is too small.")
    rot = float(e.get("rotation", 0) or 0) % 360
    behind = bool(e.get("behind"))
    if rot:
        # Bake the rotation into the pixels so the result matches the overlay,
        # which rotates around the centre of an unchanged box.
        try:
            from PIL import Image
            src_im = Image.open(io.BytesIO(img))
            src_im.load()
            if src_im.mode not in ("RGBA", "LA", "P"):
                src_im = src_im.convert("RGBA")
            else:
                src_im = src_im.convert("RGBA")
            rotated = src_im.rotate(-rot, expand=True, resample=Image.BICUBIC,
                                    fillcolor=(0, 0, 0, 0))
            buf = io.BytesIO()
            rotated.save(buf, format="PNG")
            scale = rect.width / src_im.width if src_im.width else 1.0
            new_w, new_h = rotated.width * scale, rotated.height * scale
            cx, cy = (rect.x0 + rect.x1) / 2.0, (rect.y0 + rect.y1) / 2.0
            rect = fitz.Rect(cx - new_w / 2.0, cy - new_h / 2.0,
                             cx + new_w / 2.0, cy + new_h / 2.0)
            page.insert_image(rect, stream=buf.getvalue(),
                              overlay=not behind, keep_proportion=False)
            return
        except Exception:
            pass  # fall back to inserting the unrotated image
    page.insert_image(rect, stream=img, overlay=not behind,
                      keep_proportion=False,
                      rotate=int(rot) if rot in (90, 180, 270) else 0)


def _apply_edits_to_page(page, ops: list):
    # 1) behind-text images first, so everything else paints on top of them
    for e in ops:
        if e.get("type") == "image" and e.get("behind"):
            _place_image(page, e)

    # 2) redact the geometry of edited/deleted lines (text only, keep background)
    line_ops = [e for e in ops if e.get("type") == "line"]
    if line_ops:
        for e in line_ops:
            r = e.get("rect")
            if r and len(r) == 4:
                page.add_redact_annot(fitz.Rect(float(r[0]), float(r[1]), float(r[2]), float(r[3])), fill=None)
        try:
            page.apply_redactions(images=getattr(fitz, "PDF_REDACT_IMAGE_NONE", 0))
        except TypeError:
            page.apply_redactions()

    # 3) insert replacement / brand-new text
    for e in ops:
        etype = e.get("type")
        if etype not in ("line", "text"):
            continue
        text = e.get("text") or ""
        if not text.strip():
            continue  # deleted line — stays erased
        size = max(4.0, min(float(e.get("size", 11)), 200.0))
        fontname, fontfile = _ed_font_ref(e.get("family", "helvetica"), e.get("bold"), e.get("italic"))
        color = _hex_to_rgb(e.get("color"))
        if etype == "line":
            origin = e.get("origin") or [e["rect"][0], e["rect"][3]]
        else:
            origin = e.get("point") or [0, 0]
        _ikw = {"fontsize": size, "fontname": fontname, "color": color,
                "rotate": page.rotation}
        if fontfile:
            _ikw["fontfile"] = fontfile
        page.insert_text(fitz.Point(float(origin[0]), float(origin[1])), text, **_ikw)

    # 4) foreground images on top of everything
    for e in ops:
        if e.get("type") == "image" and not e.get("behind"):
            _place_image(page, e)


@app.post("/api/op/apply-edits")
async def op_apply_edits(file: UploadFile = File(...), params: str = Form("{}")):
    """Replay the browser-side edit list onto the PDF, atomically."""
    p = params_dict(params)
    edits = p.get("edits") or []
    if not isinstance(edits, list) or len(edits) > 500:
        return err(400, "Edit list is missing or unreasonably large.")
    try:
        doc = await load_pdf(file, p.get("password"))
    except ValueError as e:
        return err(400, str(e))
    by_page: dict[int, list] = {}
    for e in edits:
        try:
            pg = int(e.get("page", 1))
        except Exception:
            continue
        if 1 <= pg <= doc.page_count and isinstance(e, dict):
            by_page.setdefault(pg, []).append(e)
    try:
        for page_no, ops in by_page.items():
            page = doc.load_page(page_no - 1)
            try:
                _apply_edits_to_page(page, ops)
            except ValueError as e:
                doc.close()
                return err(400, str(e))
        return stream_pdf(doc)
    finally:
        try:
            if not doc.is_closed:
                doc.close()
        except Exception:
            pass
# ---------------------------------------------------------------------------
# Static frontend fallback.
#
# Vercel's fastapi preset normally serves /public at the root and routes only
# dynamic requests to this function. If routing ever lands here instead, serve
# the same files ourselves so the app still works. Declared LAST so every
# /api/* route above wins; the path is confined to the public directory.
# ---------------------------------------------------------------------------
_PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"

_STATIC_MEDIA = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".md": "text/plain; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}


@app.get("/{full_path:path}", include_in_schema=False)
def serve_static(full_path: str):
    rel = (full_path or "index.html").lstrip("/")
    if rel == "":
        rel = "index.html"
    try:
        target = (_PUBLIC_DIR / rel).resolve()
        target.relative_to(_PUBLIC_DIR.resolve())
    except Exception:
        return Response(status_code=404, content=b"Not Found", media_type="text/plain")
    if target.is_dir():
        target = target / "index.html"
    if not target.is_file():
        return Response(status_code=404, content=b"Not Found", media_type="text/plain")
    media = _STATIC_MEDIA.get(target.suffix.lower(), "application/octet-stream")
    headers = {"Cache-Control": "public, max-age=3600"} if target.suffix.lower() in (
        ".ttf", ".otf", ".woff", ".woff2", ".css", ".js") else {}
    return Response(content=target.read_bytes(), media_type=media, headers=headers)
