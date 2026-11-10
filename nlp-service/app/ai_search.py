import json
import logging
from typing import Dict, Any, List, Optional
from .nine_router import nine_router_client, NineRouterClient

logger = logging.getLogger("pulsescope.ai_search")

SEARCH_QUERY_PROMPT = """Anda adalah spesialis pemantauan media dan perancang kata kunci pencarian berita untuk 17 Program Prioritas Nasional Indonesia.
Berikan variasi kata kunci pencarian berita (Google News) dan media sosial (YouTube) yang paling efektif, mencakup istilah resmi, bahasa santai publik, dan isu kontroversi/reaksi masyarakat untuk program: "{program_name}".

Format keluaran WAJIB berupa JSON:
{
  "program_name": "{program_name}",
  "google_news_queries": ["query 1", "query 2", "query 3"],
  "social_media_keywords": ["keyword 1", "keyword 2", "keyword 3"],
  "exclude_keywords": ["kata negatif 1", "kata negatif 2"]
}
"""

PROGRAM_KNOWLEDGE_BASE = {
    "Makan Bergizi Gratis (MBG)": {
        "queries": ["Makan Bergizi Gratis", "MBG uji coba sekolah", "Badan Gizi Nasional SPK"],
        "social": ["makan siang gratis", "mbg", "menu mbg", "dapur gizi"],
        "exclude": ["lowongan", "loker", "catering resepsi"]
    },
    "Cek Kesehatan Gratis (CKG)": {
        "queries": ["Cek Kesehatan Gratis", "CKG Kemenkes", "skrining kesehatan ulang tahun puskesmas"],
        "social": ["cek kesehatan gratis", "skrining gratis", "medical check up gratis"],
        "exclude": ["lowongan", "loker", "klinik kecantikan"]
    },
    "Sekolah Rakyat": {
        "queries": ["Sekolah Rakyat", "akses pendidikan sekolah rakyat prasejahtera"],
        "social": ["sekolah rakyat", "sekolah gratis rakyat"],
        "exclude": ["sejarah sekolah rakyat kolonial"]
    },
    "Sekolah Unggul Garuda": {
        "queries": ["Sekolah Unggul Garuda", "SMA Unggul Garuda", "Sekolah Garuda Nusantara"],
        "social": ["sekolah garuda", "sekolah unggul garuda"],
        "exclude": ["maskapai garuda", "garuda indonesia"]
    },
    "Revitalisasi Sekolah": {
        "queries": ["Revitalisasi Sekolah", "renovasi gedung sekolah rusak berat", "perbaikan ruang kelas rusak"],
        "social": ["sekolah rusak", "revitalisasi ruang kelas"],
        "exclude": ["tender proyek perumahan"]
    },
    "Digitalisasi Pembelajaran": {
        "queries": ["Digitalisasi Pembelajaran", "digitalisasi pendidikan kemendikdasmen", "laptop sekolah gratis"],
        "social": ["smart classroom", "digitalisasi pembelajaran", "bantuan laptop sekolah"],
        "exclude": ["promo laptop gaming"]
    },
    "Magang Nasional": {
        "queries": ["Magang Nasional Kemnaker", "program magang nasional bumn", "magang fresh graduate bersertifikat"],
        "social": ["magang nasional", "info magang nasional"],
        "exclude": ["magang jepang swasta"]
    },
    "Koperasi Desa/Kelurahan Merah Putih": {
        "queries": ["Koperasi Desa Merah Putih", "Koperasi Merah Putih", "pemberdayaan ekonomi desa merah putih"],
        "social": ["koperasi merah putih", "koperasi desa merah putih"],
        "exclude": ["beras merah putih", "bendera merah putih"]
    },
    "Program 3 Juta Rumah": {
        "queries": ["Program 3 Juta Rumah", "3 juta rumah rakyat kementerian perumahan", "kpr subsidi 3 juta rumah"],
        "social": ["3 juta rumah", "rumah subsidi prabowo", "rumah murah rakyat"],
        "exclude": ["sewa rumah harian", "homestay"]
    },
    "Kampung Nelayan Merah Putih": {
        "queries": ["Kampung Nelayan Merah Putih", "revitalisasi kampung nelayan modern", "bantuan nelayan cold storage"],
        "social": ["kampung nelayan merah putih", "kampung nelayan modern"],
        "exclude": ["paket wisata mancing"]
    },
    "PNM Mekaar": {
        "queries": ["PNM Mekaar pembiayaan ultra mikro", "nasabah PNM Mekaar ibu prasejahtera", "kelompok mekaar pnm"],
        "social": ["pnm mekaar", "nasabah mekaar", "ibu mekaar"],
        "exclude": ["loker account officer pnm"]
    },
    "Penghapusan Piutang Macet UMKM": {
        "queries": ["Penghapusan Piutang Macet UMKM", "PP 47 2024 hapus utang umkm", "hapus tagih kredit macet petani nelayan"],
        "social": ["hapus utang umkm", "hapus piutang macet", "pp 47 2024"],
        "exclude": ["pinjol ilegal", "jasa joki pinjol"]
    },
    "Swasembada Pangan": {
        "queries": ["Swasembada Pangan nasional", "cetak sawah lumbung pangan", "produksi beras panen raya"],
        "social": ["swasembada pangan", "cetak sawah", "lumbung pangan"],
        "exclude": ["resep masakan", "kuliner"]
    },
    "Hilirisasi Nasional": {
        "queries": ["Hilirisasi Nasional nikel tembaga", "smelter tembaga bauksit nasional", "nilai tambah hilirisasi komoditas"],
        "social": ["hilirisasi", "hilirisasi nikel", "smelter nasional"],
        "exclude": ["trading saham crypto"]
    },
    "Ketahanan Energi": {
        "queries": ["Ketahanan Energi nasional", "swasembada energi biodiesel B40 B50", "transisi energi terbarukan plts"],
        "social": ["ketahanan energi", "swasembada energi", "biodiesel b40"],
        "exclude": ["minuman suplemen energi"]
    },
    "Gerakan Indonesia ASRI": {
        "queries": ["Gerakan Indonesia ASRI", "Indonesia Aman Sehat Rapi Indah", "penghijauan kebersihan lingkungan asri"],
        "social": ["indonesia asri", "gerakan indonesia asri"],
        "exclude": ["perumahan bumi asri", "villa asri"]
    },
    "Bank Emas (Bullion Bank)": {
        "queries": ["Bank Emas Bullion Bank Indonesia", "layanan bullion services pegadaian", "ekosistem emas batangan nasional"],
        "social": ["bank emas", "bullion bank", "tabungan emas batangan"],
        "exclude": ["toko perhiasan emas", "toko emas online"]
    }
}

def generate_search_queries(
    program_name: str,
    client: Optional[NineRouterClient] = None
) -> Dict[str, Any]:
    """
    Generate optimized queries for news/social search using 9Router, with local knowledge-base fallback.
    """
    router = client or nine_router_client

    prompt = SEARCH_QUERY_PROMPT.replace("{program_name}", program_name)
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": f"Hasilkan kata kunci pencarian terkini untuk: {program_name}"}
    ]

    res = router.chat_completion(messages=messages, temperature=0.3, max_tokens=350, json_mode=True)
    if res.get("success") and res.get("content"):
        try:
            content = res["content"].strip()
            if content.startswith("```"):
                lines = content.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                content = "\n".join(lines).strip()
            parsed = json.loads(content)
            parsed["engine"] = "9router-ai"
            return parsed
        except Exception as e:
            logger.warning(f"Error parsing AI search queries: {e}")

    # Fallback to curated dictionary
    default_entry = PROGRAM_KNOWLEDGE_BASE.get(program_name, {
        "queries": [program_name],
        "social": [program_name.lower()],
        "exclude": ["lowongan", "loker"]
    })

    return {
        "program_name": program_name,
        "google_news_queries": default_entry.get("queries", [program_name]),
        "social_media_keywords": default_entry.get("social", [program_name.lower()]),
        "exclude_keywords": default_entry.get("exclude", []),
        "engine": "knowledge-base-fallback"
    }

def filter_relevance(
    program_name: str,
    title: str,
    snippet: str,
    client: Optional[NineRouterClient] = None
) -> Dict[str, Any]:
    """
    Verify if a scraped headline/snippet is truly relevant to the government program.
    """
    router = client or nine_router_client
    messages = [
        {
            "role": "system",
            "content": f"Anda adalah filter relevansi berita PulseScope. Tentukan apakah berita ini BENAR-BENAR relevan dengan program '{program_name}' atau hanya kebetulan memiliki kata yang sama. Balas dengan JSON: {{\"relevant\": true|false, \"reason\": \"alasan singkat\"}}"
        },
        {"role": "user", "content": f"Judul: {title}\nRingkasan: {snippet}"}
    ]

    res = router.chat_completion(messages=messages, temperature=0.1, max_tokens=100, json_mode=True)
    if res.get("success") and res.get("content"):
        try:
            content = res["content"].strip()
            if content.startswith("```"):
                lines = content.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                content = "\n".join(lines).strip()
            parsed = json.loads(content)
            return {"relevant": bool(parsed.get("relevant", True)), "reason": parsed.get("reason", "AI verified")}
        except Exception:
            pass

    # Heuristic fallback: check negative keywords from knowledge base
    kb = PROGRAM_KNOWLEDGE_BASE.get(program_name, {})
    full_text = (title + " " + snippet).lower()
    for ex in kb.get("exclude", []):
        if ex.lower() in full_text:
            return {"relevant": False, "reason": f"Mengandung kata eksklusi '{ex}'"}

    return {"relevant": True, "reason": "Heuristic match"}

