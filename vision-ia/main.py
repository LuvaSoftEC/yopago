
# Reordenar imports y definir app al inicio
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import openai
import tempfile
import base64
import os
import binascii
import json
import re
import mimetypes
import imghdr
from typing import Any
from pydantic import BaseModel
import fitz  # PyMuPDF para convertir PDFs a imágenes

app = FastAPI()

api_key = os.getenv("OPENAI_API_KEY")
if api_key:
    print("[INFO] OPENAI_API_KEY configurada")
else:
    print("[WARN] OPENAI_API_KEY no configurada")
client = openai.OpenAI(api_key=api_key)
VISION_MODEL = os.getenv("OCR_VISION_MODEL", "gpt-4o-mini")

class Base64ImageRequest(BaseModel):
    fileBase64: str
    fileName: str | None = None


def extract_with_vision(image_path: str) -> dict[str, Any]:
    with open(image_path, "rb") as img_file:
        raw_bytes = img_file.read()

    if not raw_bytes:
        raise ValueError("El archivo convertido está vacío; no se pudo generar imagen válida")

    mime_type, _ = mimetypes.guess_type(image_path)
    if not mime_type:
        detected = imghdr.what(None, h=raw_bytes)
        if detected:
            mime_type = f"image/{detected}"
    if not mime_type:
        mime_type = "image/jpeg"

    print(f"[OCR] Procesando entrada {image_path} como {mime_type} ({len(raw_bytes)} bytes)")
    detected_format = imghdr.what(None, h=raw_bytes)
    if detected_format:
        print(f"[OCR] Formato detectado: {detected_format}")
    else:
        print("[OCR] No se pudo detectar formato con imghdr")
    print(f"[OCR] Encabezado bytes: {raw_bytes[:8].hex()}")

    image_b64 = base64.b64encode(raw_bytes).decode("utf-8")

    prompt = (
        "Eres un experto en facturas y tickets. Analiza el contenido adjunto y devuelve EXCLUSIVAMENTE "
        "un JSON con la forma {\"text\": string, \"structured\": { ... }}. En 'text' coloca una "
        "transcripción legible del ticket. En 'structured' incluye los campos: 'amount', 'fecha', "
        "'items' (lista de objetos con 'descripcion', 'cantidad', 'monto'), 'propina', 'iva', "
        "'subtotal'. Si algún dato falta, usa null. Asegúrate de que el JSON sea válido."
    )

    try:
        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_b64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=700
        )
    except openai.BadRequestError as exc:
        response_obj = getattr(exc, "response", None)
        payload = None
        if response_obj is not None:
            try:
                payload = response_obj.json()
            except Exception:  # pragma: no cover - logging best-effort
                try:
                    payload = response_obj.text
                except Exception:
                    payload = str(response_obj)
        print("[OCR] OpenAI rechazó el archivo:", payload or str(exc))
        raise ValueError(f"OpenAI rechazó el archivo: {exc}") from exc

    # Extraer el texto de la respuesta
    output_text = response.choices[0].message.content if response.choices else ""
    output_text = output_text.strip() if output_text else ""
    if not output_text:
        raise ValueError("La IA de visión no generó respuesta utilizable.")

    fenced_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", output_text, re.DOTALL | re.IGNORECASE)
    candidate_payload = fenced_match.group(1) if fenced_match else output_text

    try:
        parsed = json.loads(candidate_payload)
    except json.JSONDecodeError as exc:
        raise ValueError(f"No se pudo interpretar la respuesta de la IA: {output_text}") from exc

    if "structured" not in parsed:
        parsed = {"text": parsed.get("text", ""), "structured": parsed}

    structured = parsed.get("structured", {})
    if not isinstance(structured, dict):
        structured = {"value": structured}

    text = parsed.get("text", "")
    
    # DEBUG: Imprimir el resultado final
    print(f"[OCR] Resultado final - text: {text[:50] if text else 'None'}...")
    print(f"[OCR] Structured JSON: {json.dumps(structured, indent=2)}")
    
    
    return {"text": text, "structured": structured}


def is_pdf_file(path: str) -> bool:
    return os.path.splitext(path)[1].lower() == ".pdf"


def convert_pdf_to_image(pdf_path: str) -> str:
    try:
        doc = fitz.open(pdf_path)
    except Exception as exc:  # pragma: no cover - errores de biblioteca
        raise ValueError(f"No se pudo abrir el PDF: {exc}") from exc

    try:
        if doc.page_count == 0:
            raise ValueError("El PDF no contiene páginas")

        page = doc.load_page(0)
        zoom_matrix = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=zoom_matrix, colorspace=fitz.csRGB, alpha=False)
        if pix.width == 0 or pix.height == 0:
            raise ValueError("La página del PDF es inválida o está vacía")

        image_path = pdf_path + "_page0.png"
        pix.save(image_path)

        if not os.path.exists(image_path) or os.path.getsize(image_path) == 0:
            raise ValueError("La conversión del PDF no generó una imagen válida")

        print(
            "[OCR] PDF convertido a PNG",
            {
                "pdf": pdf_path,
                "png": image_path,
                "width": pix.width,
                "height": pix.height,
                "size": os.path.getsize(image_path),
                "format": imghdr.what(image_path),
            },
        )

        return image_path
    except Exception as exc:  # pragma: no cover - errores de conversión
        raise ValueError(f"No se pudo convertir el PDF a imagen: {exc}") from exc
    finally:
        doc.close()


def run_ocr_pipeline(source_path: str):
    temp_image_path = None
    try:
        working_path = source_path
        if is_pdf_file(source_path):
            temp_image_path = convert_pdf_to_image(source_path)
            working_path = temp_image_path

        result = extract_with_vision(working_path)
        if not result.get("structured"):
            raise ValueError("La IA de visión no pudo estructurar la información del recibo.")
        return result
    finally:
        if temp_image_path and os.path.exists(temp_image_path):
            os.remove(temp_image_path)


# Endpoint para procesar imagen como archivo
@app.post("/vision-ia")
async def vision_ia_endpoint(file: UploadFile = File(...)):
    print("[INFO] Llamando a OpenAI Vision API...")
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    try:
        result = run_ocr_pipeline(tmp_path)
        return JSONResponse(result)
    except ValueError as exc:
        print(f"[OCR] Error procesando archivo base64: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/vision-ia/base64")
async def vision_ia_base64_endpoint(payload: Base64ImageRequest):
    if not payload.fileBase64:
        raise HTTPException(status_code=400, detail="Se requiere fileBase64")

    try:
        file_bytes = base64.b64decode(payload.fileBase64)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Base64 inválido: {exc}")

    original_ext = os.path.splitext(payload.fileName)[1].lower() if payload.fileName else ""
    is_pdf_payload = original_ext == ".pdf" or file_bytes.startswith(b"%PDF")
    suffix = ".pdf" if is_pdf_payload else ".png"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        result = run_ocr_pipeline(tmp_path)
        return JSONResponse(result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
