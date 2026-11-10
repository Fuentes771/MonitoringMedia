import json
import logging
from typing import Dict, Any, List, Optional
from .nine_router import nine_router_client, NineRouterClient

logger = logging.getLogger("pulsescope.ai_chat")

STRICT_RAG_SYSTEM_PROMPT = """Anda adalah PulseScope Intelligence Officer, asisten analisis data intelijen untuk pimpinan dan eksekutif yang memantau 17 Program Prioritas Nasional Indonesia:
1. Makan Bergizi Gratis (MBG)
2. Cek Kesehatan Gratis (CKG)
3. Sekolah Rakyat
4. Sekolah Unggul Garuda
5. Revitalisasi Sekolah
6. Digitalisasi Pembelajaran
7. Magang Nasional
8. Koperasi Desa/Kelurahan Merah Putih
9. Program 3 Juta Rumah
10. Kampung Nelayan Merah Putih
11. PNM Mekaar
12. Penghapusan Piutang Macet UMKM
13. Swasembada Pangan
14. Hilirisasi Nasional
15. Ketahanan Energi
16. Gerakan Indonesia ASRI
17. Bank Emas (Bullion Bank)

PRINSIP & GAYA PENYAJIAN EKSEKUTIF:
1. STRUKTUR JAWABAN (WAJIB):
   Sajikan jawaban dalam struktur yang rapi, to-the-point, kaya angka dan fakta:

   ### 📌 Ringkasan Eksekutif
   (1-2 kalimat padat to-the-point mengenai situasi lapangan dan persepsi utama)

   ### 📊 Distribusi Sentimen Publik
   🟢 Positif: X% (N sebutan) | ⚪ Netral: Y% (N sebutan) | 🔴 Negatif: Z% (N sebutan)

   ### 🔍 Sorotan Isu Strategis
   - Katalis Positif: [Poin kunci perkembangan positif, capaian, ekspansi, atau dukungan di lapangan]
   - Tantangan & Risiko: [Poin kritis, kendala administrasi, penutupan unit, keluhan gaji, atau catatan pengawasan]
   - Tata Kelola & Kebijakan: [Poin regulasi, alokasi anggaran, atau koordinasi antar lembaga]

2. LARANGAN KERAS:
   - DILARANG MENYERTAKAN SITASI ATAU NAMA MEDIA/TANGGAL DALAM TANDA KURUNG (misal: DILARANG ada "(Kompas, 06 Nov)", "(Disway, 07 Nov)", "[InfoPublik]"). Langsung sampaikan fakta dan data angka secara lugas tanpa menyebutkan sumbernya.
   - DILARANG menyebut nama model AI (misal GPT, Gemini, Claude, Llama) atau nama gateway/router (seperti 9Router).
   - DILARANG menggunakan kata-kata defensif klise seperti "Seluruh jawaban saya dibatasi secara ketat".
   - DILARANG berhalusinasi atau menambahkan angka/isu yang tidak ada dalam data konteks.
   - JANGAN membuat format berantakan berupa daftar panjang satu per satu berita. Rangkum menjadi wawasan eksekutif.

3. KETIDAKTERSEDIAAN DATA:
   Jika tidak ada data yang relevan dalam konteks, sampaikan dengan lugas:
   "Saat ini belum ada data sebutan berita atau media sosial 7 hari terakhir yang tersimpan di sistem terkait topik tersebut."
"""

def process_rag_chat(
    query: str,
    context_mentions: List[Dict[str, Any]],
    topic_name: Optional[str] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    client: Optional[NineRouterClient] = None
) -> Dict[str, Any]:
    """
    Execute context-bounded chat with strict guardrails via 9Router.
    """
    router = client or nine_router_client

    # 1. Check if context is completely empty
    if not context_mentions:
        target_focus = f"topik '{topic_name}'" if topic_name else "17 Program Prioritas Nasional"
        return {
            "answer": f"Berdasarkan data monitoring PulseScope saat ini, belum ada sebutan berita atau media sosial yang tersimpan untuk {target_focus} terkait pertanyaan Anda. Silakan lakukan sinkronisasi sumber berita pada halaman Topics atau pastikan kata kunci pencarian telah aktif.",
            "citations": [],
            "mentions_count": 0,
            "grounded": False,
            "engine": "strict-guardrail-no-data"
        }

    # 2. Build indexed context snippets with provenance metadata
    formatted_context = []
    citations = []

    for idx, m in enumerate(context_mentions[:25], 1):
        m_id = m.get("id", idx)
        author = m.get("author_name") or m.get("provider", "Media").upper()
        date = m.get("published_at", "Tanggal tidak diketahui")
        sentiment = m.get("sentiment") or "neutral"
        url = m.get("source_url", "")
        text = m.get("text", "").replace("\n", " ")

        citation_tag = f"[{author}, {date}, Sentimen: {sentiment.upper()}]"
        citations.append({
            "index": idx,
            "mention_id": m_id,
            "author": author,
            "published_at": date,
            "sentiment": sentiment,
            "url": url,
            "snippet": text[:140] + "..." if len(text) > 140 else text
        })

        formatted_context.append(
            f"--- BUKTI [{idx}] {citation_tag} ---\n{text}"
        )

    context_str = "\n\n".join(formatted_context)

    # 3. Assemble prompt messages
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": STRICT_RAG_SYSTEM_PROMPT}
    ]

    # Append brief recent history if available (limit to last 4 turns)
    if conversation_history:
        for turn in conversation_history[-4:]:
            if turn.get("role") in ["user", "assistant"]:
                messages.append({"role": turn["role"], "content": turn.get("content", "")})

    user_prompt = f"""DATA KONTEKS MONITORING PULSESCOPE (Total: {len(context_mentions)} sebutan):
{context_str}

PERTANYAAN PENGGUNA:
"{query}"

Instruksi: Jawab pertanyaan di atas HANYA berdasarkan DATA KONTEKS di atas. Cantumkan sitasi sumber [Penulis/Media, Tanggal, Sentimen] pada setiap temuan."""

    messages.append({"role": "user", "content": user_prompt})

    # 4. Invoke 9Router
    res = router.chat_completion(
        messages=messages,
        temperature=0.2,
        max_tokens=850
    )

    if res.get("success") and res.get("content"):
        return {
            "answer": res["content"].strip(),
            "citations": citations,
            "mentions_count": len(context_mentions),
            "grounded": True,
            "engine": "9router-rag",
            "model": res.get("model")
        }

    # 5. Fallback response if 9Router is offline
    summary_preview = []
    for m in context_mentions[:3]:
        txt = m.get("text", "")[:120].replace("\n", " ")
        summary_preview.append(f"- {txt}...")

    offline_msg = (
        f"Layanan pemrosesan AI sedang tidak terhubung. "
        f"Rangkuman awal dari {len(context_mentions)} sebutan data terkini:\n\n"
        + "\n".join(summary_preview)
    )

    return {
        "answer": offline_msg,
        "citations": citations,
        "mentions_count": len(context_mentions),
        "grounded": True,
        "engine": "local-context-fallback",
        "error": res.get("error")
    }

