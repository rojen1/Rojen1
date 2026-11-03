import { ref, get } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { getFirebaseDb } from '../firebase.js';

const RECEIPT_PROMPT =
  'Извлечи от касова бележка за гориво (EKO, Shell, OMV и др.) JSON с полета: ' +
  'date (YYYY-MM-DD), vendor, liters (число), unitPrice (€/л), total (€), odometerKm (ако има). ' +
  'Само JSON без markdown.';

/** @returns {Promise<string | null>} */
async function getGeminiApiKey() {
  const snap = await get(ref(getFirebaseDb(), '_config/gemini'));
  if (!snap.exists()) return null;
  const key = snap.val()?.apiKey;
  return typeof key === 'string' && key.length > 10 ? key : null;
}

/** @param {File} file */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Неуспешно четене на снимката.'));
    reader.readAsDataURL(file);
  });
}

/**
 * @param {File} file
 * @returns {Promise<{ date?: string, vendor?: string, liters?: number, unitPrice?: number, total?: number, odometerKm?: number }>}
 */
export async function extractReceiptFromImage(file) {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Няма Gemini ключ. Добавете _config/gemini/apiKey в Firebase или въведете ръчно.');
  }

  const base64 = await fileToBase64(file);
  const mime = file.type || 'image/jpeg';

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
    encodeURIComponent(apiKey);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: RECEIPT_PROMPT },
            { inline_data: { mime_type: mime, data: base64 } }
          ]
        }
      ],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || 'Gemini грешка';
    throw new Error(msg);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Празен отговор от AI.');

  const parsed = JSON.parse(text);
  return {
    date: parsed.date,
    vendor: parsed.vendor || parsed.station,
    liters: Number(parsed.liters),
    unitPrice: Number(parsed.unitPrice ?? parsed.pricePerLiter),
    total: Number(parsed.total ?? parsed.amount),
    odometerKm: Number(parsed.odometerKm ?? parsed.km)
  };
}
