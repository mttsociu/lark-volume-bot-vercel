import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  let body = req.body;

  // ✅ Lark có thể gửi body là chuỗi, cần parse
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.error('❌ Invalid JSON:', e);
      return res.status(400).json({ error: 'Invalid JSON format' });
    }
  }

  // ✅ Trả về challenge để xác minh webhook
  if (body.challenge) {
    return res.status(200).json({ challenge: body.challenge });
  }

  try {
    const keyword = body.event?.message?.content?.text?.trim();
    if (!keyword) {
      return res.status(200).json({ status: 'No keyword found' });
    }

    const apiUrl = `https://api.keywordtool.io/v2/search/keywords/google?apikey=${process.env.KEYWORDTOOL_API_KEY}&keyword=${encodeURIComponent(keyword)}&metrics=true&language=vi&country=vn`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    const result = data.results?.google?.[0];

    if (!result) {
      await replyToLark(body.event.message.chat_id, `❌ Không tìm thấy dữ liệu cho từ khóa: "${keyword}"`);
      return res.status(200).json({ status: 'No data' });
    }

    const volume = result.search_volume || 0;
    const cpc = result.cpc?.USD || 0;
    const competition = result.competition || 0;

    const message = `📈 *${keyword}*\n• Volume: ${volume}\n• CPC: $${cpc}\n• Cạnh tranh: ${competition}`;
    await replyToLark(body.event.message.chat_id, message);

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Lỗi xử lý:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function replyToLark(chatId, text) {
  const tokenRes = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.APP_ID,
      app_secret: process.env.APP_SECRET
    })
  });

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.tenant_access_token;

  await fetch('https://open.larksuite.com/open-apis/im/v1/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      receive_id: chatId,
      receive_id_type: 'chat_id',
      msg_type: 'text',
      content: JSON.stringify({ text })
    })
  });
}

// ✅ ⚙️ Cấu hình để Next.js không chặn body dạng JSON
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
      raw: false
    }
  }
};
